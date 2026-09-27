import { Server as SocketIOServer, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../constants/index.js';
import { redisService } from '../services/redis.service.js';
import { sessionService } from '../services/session.service.js';
import { deviceService } from '../services/device.service.js';
import { deviceRepository } from '../repositories/device.repository.js';
import { normalizeDeviceId } from '../utils/idGenerator.js';
import { logger } from '../utils/logger.js';
import { nativeInput } from '../utils/nativeInput.js';
import { adbInput } from '../utils/adbInput.js';

interface RegisterDevicePayload {
  deviceId: string; // publicDeviceId e.g. 489-123-789
  token?: string;
  name?: string;
  platform?: string;
}

interface SessionRequestPayload {
  targetDeviceId: string;
  requesterId: string;
  requesterName: string;
  permissions?: {
    allowMouse?: boolean;
    allowKeyboard?: boolean;
    allowAudio?: boolean;
    allowClipboard?: boolean;
    allowFileTransfer?: boolean;
  };
}

interface SessionResponsePayload {
  sessionId: string;
  approvedPermissions?: {
    allowMouse?: boolean;
    allowKeyboard?: boolean;
    allowAudio?: boolean;
    allowClipboard?: boolean;
    allowFileTransfer?: boolean;
  };
  reason?: string;
}

interface SdpSignalPayload {
  sessionId: string;
  sdp: any;
}

interface IceCandidatePayload {
  sessionId: string;
  candidate: any;
}

interface ChatPayload {
  sessionId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

const sessionHosts = new Map<string, { socketId: string; isDesktopHost: boolean }>();
const sessionFrames = new Map<string, string>();

export const setupSignalingSocket = (io: SocketIOServer) => {
  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // 1. Device Registration & Presence
    socket.on(SOCKET_EVENTS.DEVICE_REGISTER, async (payload: RegisterDevicePayload) => {
      try {
        const digits = payload.deviceId.replace(/\D/g, '');
        const normalizedId = normalizeDeviceId(payload.deviceId);
        const spaceId =
          digits.length === 9
            ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`
            : payload.deviceId.trim();

        socket.join(`device:${normalizedId}`);
        socket.join(`device:${digits}`);
        socket.join(`device:${spaceId}`);

        await redisService.setDeviceOnline(normalizedId, socket.id);
        await redisService.setDeviceOnline(digits, socket.id);
        await redisService.setDeviceOnline(spaceId, socket.id);

        // Auto-create/upsert the device in repository so lookup never 404s
        await deviceRepository.createOrGetAnonymousDevice(
          normalizedId,
          payload.name || 'Android Companion Phone',
          payload.platform || 'Android'
        );

        logger.info(`Device registered online: ${normalizedId} / ${digits} (socket: ${socket.id})`);
        socket.emit(SOCKET_EVENTS.DEVICE_REGISTERED, {
          success: true,
          deviceId: normalizedId,
        });

        // Broadcast presence
        socket.broadcast.emit(SOCKET_EVENTS.DEVICE_STATUS_UPDATE, {
          deviceId: normalizedId,
          status: 'ONLINE',
        });
      } catch (err: any) {
        logger.error('Error registering device:', err);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to register device' });
      }
    });

    // 2. Heartbeat to keep presence active in Redis
    socket.on(SOCKET_EVENTS.DEVICE_HEARTBEAT, async (data: { deviceId: string }) => {
      if (data?.deviceId) {
        const normalized = normalizeDeviceId(data.deviceId);
        const digits = data.deviceId.replace(/\D/g, '');
        await redisService.refreshDeviceHeartbeat(normalized);
        if (digits) await redisService.refreshDeviceHeartbeat(digits);
      }
    });

    // 3. Session Request Initiation
    socket.on(SOCKET_EVENTS.SESSION_REQUEST, async (payload: SessionRequestPayload) => {
      try {
        const digits = payload.targetDeviceId.replace(/\D/g, '');
        const targetNormalized = normalizeDeviceId(payload.targetDeviceId);
        const spaceId =
          digits.length === 9
            ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`
            : payload.targetDeviceId.trim();

        logger.info(`Session requested to device: ${targetNormalized} from ${payload.requesterName}`);

        // Check if target device is online (check active Socket.IO rooms or redis presence)
        const roomDash = io.sockets.adapter.rooms.get(`device:${targetNormalized}`);
        const roomDigits = digits ? io.sockets.adapter.rooms.get(`device:${digits}`) : null;
        const roomSpace = io.sockets.adapter.rooms.get(`device:${spaceId}`);

        const activeRoom =
          (roomDash && roomDash.size > 0)
            ? roomDash
            : (roomDigits && roomDigits.size > 0)
            ? roomDigits
            : (roomSpace && roomSpace.size > 0)
            ? roomSpace
            : null;

        const inRoom = !!activeRoom;
        const isOnline =
          inRoom ||
          (await redisService.isDeviceOnline(targetNormalized)) ||
          (await redisService.isDeviceOnline(digits));
        let targetSocketId = await redisService.getSocketByDevice(targetNormalized);
        if (!targetSocketId && digits) targetSocketId = await redisService.getSocketByDevice(digits);
        if (!targetSocketId && inRoom && activeRoom) {
          targetSocketId = Array.from(activeRoom)[0];
        }

        logger.info(
          `Device presence check for ${targetNormalized}: inRoom=${inRoom}, isOnline=${isOnline}, targetSocketId=${targetSocketId}`
        );

        if (!isOnline && !inRoom) {
          socket.emit(SOCKET_EVENTS.SESSION_REJECTED, {
            reason: `Device ${targetNormalized} is currently offline or unreachable.`,
          });
          return;
        }

        // Create session in database
        const { session, targetDevice } = await sessionService.initiateSession(
          payload.requesterId,
          targetNormalized,
          payload.permissions
        );

        // Put requester into session room
        socket.join(`session:${session.id}`);

        const incomingPayload = {
          sessionId: session.id,
          requesterId: payload.requesterId,
          requesterName: payload.requesterName,
          targetDeviceId: targetDevice.publicDeviceId,
          permissions: session.permissions,
        };

        // Notify target device (Host) across all room formats
        io.to(`device:${targetNormalized}`)
          .to(`device:${digits}`)
          .to(`device:${spaceId}`)
          .emit(SOCKET_EVENTS.SESSION_REQUEST_INCOMING, incomingPayload);

        io.to(`device:${targetNormalized}`)
          .to(`device:${digits}`)
          .to(`device:${spaceId}`)
          .emit('session:request:incoming', incomingPayload);

        // Also emit directly to target socket if found
        if (targetSocketId) {
          io.to(targetSocketId).emit(SOCKET_EVENTS.SESSION_REQUEST_INCOMING, incomingPayload);
          io.to(targetSocketId).emit('session:request:incoming', incomingPayload);
        }
      } catch (err: any) {
        logger.error('Error initiating session request:', err);
        socket.emit(SOCKET_EVENTS.SESSION_REJECTED, {
          reason: err.message || 'Failed to initiate session request.',
        });
      }
    });

    // 4. Session Acceptance by Host
    socket.on(SOCKET_EVENTS.SESSION_ACCEPT, async (payload: any) => {
      try {
        logger.info(`Session ${payload.sessionId} ACCEPTED by host`);
        socket.join(`session:${payload.sessionId}`);

        // Track host device type to know whether physical Windows cursor driver should be used
        const isDesktopHost = payload.isDesktopHost !== false;
        sessionHosts.set(payload.sessionId, { socketId: socket.id, isDesktopHost });

        // Update database
        await sessionService.updateSessionStatus(payload.sessionId, 'CONNECTED');
        if (payload.approvedPermissions) {
          await sessionService.updatePermissions(payload.sessionId, payload.approvedPermissions);
        }

        // Notify all peers in session room
        const isNativeAppHost = payload.isNativeAppHost === true;
        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.SESSION_ACCEPTED, {
          sessionId: payload.sessionId,
          permissions: payload.approvedPermissions,
          isDesktopHost,
          isNativeAppHost,
        });
      } catch (err: any) {
        logger.error('Error accepting session:', err);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to accept session' });
      }
    });

    // 5. Session Rejection by Host
    socket.on(SOCKET_EVENTS.SESSION_REJECT, async (payload: SessionResponsePayload) => {
      try {
        logger.info(`Session ${payload.sessionId} REJECTED by host`);
        sessionHosts.delete(payload.sessionId);
        await sessionService.updateSessionStatus(
          payload.sessionId,
          'REJECTED',
          payload.reason || 'User rejected request'
        );

        io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.SESSION_REJECTED, {
          sessionId: payload.sessionId,
          reason: payload.reason || 'Connection request was declined by the remote user.',
        });
      } catch (err: any) {
        logger.error('Error rejecting session:', err);
      }
    });

    // Explicit session room join (used by client, host, and companion mobile app)
    socket.on('session:join', (data: { sessionId: string }) => {
      if (data?.sessionId) {
        socket.join(`session:${data.sessionId}`);
        logger.info(`Socket ${socket.id} joined session room: session:${data.sessionId}`);

        // Immediately send cached frame to joining viewer if available
        const cached = sessionFrames.get(data.sessionId);
        if (cached) {
          socket.emit('stream:frame', { sessionId: data.sessionId, frame: cached });
        }

        // Broadcast to mobile host in room to send a fresh frame immediately
        socket.to(`session:${data.sessionId}`).emit('stream:request_frame', { sessionId: data.sessionId });
      }
    });

    // Explicit request for a fresh screen frame
    socket.on('stream:request_frame', (data: { sessionId: string }) => {
      if (data?.sessionId) {
        const cached = sessionFrames.get(data.sessionId);
        if (cached) {
          socket.emit('stream:frame', { sessionId: data.sessionId, frame: cached });
          logger.info(`Served cached frame for session ${data.sessionId} to socket ${socket.id}`);
        }
        const roomSize = io.sockets.adapter.rooms.get(`session:${data.sessionId}`)?.size || 0;
        logger.info(`stream:request_frame from ${socket.id} for session ${data.sessionId}, room size: ${roomSize}, cached: ${!!cached}`);
        socket.to(`session:${data.sessionId}`).emit('stream:request_frame', data);
      }
    });

    // Live mobile screen frame streaming (from companion Android app)
    socket.on('stream:frame', (data: { sessionId: string; frame: string }) => {
      if (data?.sessionId && data?.frame) {
        sessionFrames.set(data.sessionId, data.frame);
        const roomSize = io.sockets.adapter.rooms.get(`session:${data.sessionId}`)?.size || 0;
        logger.info(`stream:frame from ${socket.id} for session ${data.sessionId}, broadcasting to room size: ${roomSize}`);
        io.to(`session:${data.sessionId}`).emit('stream:frame', data);
      }
    });


    // 6. WebRTC SDP Offer Relay
    socket.on(SOCKET_EVENTS.SIGNALING_OFFER, (payload: SdpSignalPayload) => {
      socket.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.SIGNALING_OFFER, {
        sessionId: payload.sessionId,
        sdp: payload.sdp,
      });
    });

    // 7. WebRTC SDP Answer Relay
    socket.on(SOCKET_EVENTS.SIGNALING_ANSWER, (payload: SdpSignalPayload) => {
      socket.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.SIGNALING_ANSWER, {
        sessionId: payload.sessionId,
        sdp: payload.sdp,
      });
    });

    // 8. WebRTC ICE Candidate Relay
    socket.on(SOCKET_EVENTS.SIGNALING_ICE_CANDIDATE, (payload: IceCandidatePayload) => {
      socket.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.SIGNALING_ICE_CANDIDATE, {
        sessionId: payload.sessionId,
        candidate: payload.candidate,
      });
    });

    // 9. In-Session Chat
    socket.on(SOCKET_EVENTS.SESSION_CHAT, (payload: ChatPayload) => {
      io.to(`session:${payload.sessionId}`).emit(SOCKET_EVENTS.SESSION_CHAT, payload);
    });

    // 10. Session Termination
    socket.on(SOCKET_EVENTS.SESSION_END, async (data: { sessionId: string; reason?: string }) => {
      try {
        logger.info(`Ending session: ${data.sessionId}`);
        sessionHosts.delete(data.sessionId);
        sessionFrames.delete(data.sessionId);
        await sessionService.updateSessionStatus(data.sessionId, 'COMPLETED', data.reason || 'USER_DISCONNECTED');

        io.to(`session:${data.sessionId}`).emit(SOCKET_EVENTS.SESSION_ENDED, {
          sessionId: data.sessionId,
          reason: data.reason || 'Session ended by participant',
        });
      } catch (err: any) {
        logger.error('Error ending session:', err);
      }
    });

    // 11. Remote Input Control (Mouse & Touch & Keyboard)
    socket.on('control:mouse', (payload: any) => {
      if (!payload || !payload.sessionId) return;
      // Broadcast to Host browser in session room
      socket.to(`session:${payload.sessionId}`).emit('control:mouse', payload);

      const hostInfo = sessionHosts.get(payload.sessionId);
      const shouldDriveWindowsCursor = hostInfo ? hostInfo.isDesktopHost : true;

      const action = payload.action;
      const x = typeof payload.x === 'number' ? payload.x : 0.5;
      const y = typeof payload.y === 'number' ? payload.y : 0.5;
      const button = typeof payload.button === 'number' ? payload.button : 0;

      if (shouldDriveWindowsCursor) {
        // HOST is Windows Laptop: drive physical Windows cursor
        if (action === 'click' || action === 'mousedown') {
          nativeInput.handleClick(x, y, button, false);
        } else if (action === 'dblclick') {
          nativeInput.handleClick(x, y, button, true);
        } else if (action === 'mousemove') {
          nativeInput.handleMove(x, y);
        }
      } else {
        // HOST is Mobile: execute physical touch tap / swipe on Android phone via ADB!
        if (action === 'click' || action === 'mousedown' || action === 'dblclick') {
          adbInput.tap(x, y);
        } else if (action === 'drag' || payload.isDrag) {
          adbInput.swipe(x, y, x, Math.max(0, y - 0.08));
        }
      }
    });

    socket.on('control:keyboard', (payload: any) => {
      if (!payload || !payload.sessionId) return;
      socket.to(`session:${payload.sessionId}`).emit('control:keyboard', payload);

      const hostInfo = sessionHosts.get(payload.sessionId);
      const shouldDriveWindowsCursor = hostInfo ? hostInfo.isDesktopHost : true;

      if (shouldDriveWindowsCursor) {
        if (payload.key) {
          nativeInput.handleKey(payload.key, payload.code);
        }
      } else {
        // HOST is Mobile: type directly into Android active app via ADB!
        if (payload.key === 'Enter') {
          adbInput.keyevent(66);
        } else if (payload.key === 'Backspace') {
          adbInput.keyevent(67);
        } else if (payload.key === ' ' || payload.key === 'Space') {
          adbInput.keyevent(62);
        } else if (payload.key === 'Escape') {
          adbInput.keyevent(4);
        } else if (payload.key && payload.key.length === 1) {
          adbInput.text(payload.key);
        }
      }
    });

    socket.on('control:mobile-nav', (payload: any) => {
      if (!payload || !payload.sessionId) return;
      socket.to(`session:${payload.sessionId}`).emit('control:mobile-nav', payload);

      // Execute on physical Android phone via ADB!
      if (payload.action === 'back') {
        adbInput.keyevent(4); // KEYCODE_BACK
      } else if (payload.action === 'home') {
        adbInput.keyevent(3); // KEYCODE_HOME
      } else if (payload.action === 'recents') {
        adbInput.keyevent(187); // KEYCODE_APP_SWITCH
      } else if (payload.action === 'notifications') {
        adbInput.toggleNotifications(true);
      } else if (payload.action === 'power') {
        adbInput.keyevent(26); // KEYCODE_POWER
      }
    });

    // 12. Disconnect Cleanup
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      const deviceId = await redisService.getDeviceBySocket(socket.id);
      if (deviceId) {
        await redisService.setDeviceOffline(deviceId);
        socket.broadcast.emit(SOCKET_EVENTS.DEVICE_STATUS_UPDATE, {
          deviceId,
          status: 'OFFLINE',
        });
        logger.info(`Device marked offline: ${deviceId}`);
      }
    });
  });
};
