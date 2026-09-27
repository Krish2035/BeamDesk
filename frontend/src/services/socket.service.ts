import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, SOCKET_EVENTS } from '../constants/index.js';
import { useSessionStore } from '../store/useSessionStore.js';
import { useAuthStore } from '../store/useAuthStore.js';

class SocketService {
  private socket: Socket | null = null;
  private heartbeatTimer: any = null;

  connect() {
    if (this.socket?.connected) {
      this.registerCurrentDevice();
      this.startHeartbeat();
      return;
    }

    this.socket = io(SOCKET_URL || undefined, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[BeamDesk Socket] Connected to signaling server');
      this.registerCurrentDevice();
      this.startHeartbeat();
    });

    this.socket.on('reconnect', () => {
      console.log('[BeamDesk Socket] Reconnected to signaling server');
      this.registerCurrentDevice();
      this.startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      console.log('[BeamDesk Socket] Disconnected from signaling server');
      this.stopHeartbeat();
    });

    // Listen to incoming session requests
    this.socket.on(SOCKET_EVENTS.SESSION_REQUEST_INCOMING, (payload) => {
      console.log('Incoming session request:', payload);
      useSessionStore.getState().setIncomingRequest(payload);
    });

    // Listen to session accepted
    this.socket.on(SOCKET_EVENTS.SESSION_ACCEPTED, (payload) => {
      console.log('Session accepted:', payload);
      if (payload.permissions) {
        useSessionStore.getState().setPermissions(payload.permissions);
      }
      useSessionStore.getState().setStatus('CONNECTED');
    });

    // Listen to session rejected
    this.socket.on(SOCKET_EVENTS.SESSION_REJECTED, (payload) => {
      console.log('Session rejected:', payload);
      useSessionStore.getState().setError(payload.reason || 'Session was rejected by the target user.');
    });

    // Listen to session ended — only reset if it's our current active session
    this.socket.on(SOCKET_EVENTS.SESSION_ENDED, (payload) => {
      console.log('Session ended:', payload);
      const currentSessionId = useSessionStore.getState().sessionId;
      // Guard: only tear down if this event is for the session we are currently in
      if (!currentSessionId || currentSessionId === payload?.sessionId) {
        useSessionStore.getState().setError(payload.reason || 'Session ended');
        setTimeout(() => {
          // Double-check: if user started a new session in 1.5s window, don't reset
          const stillSameSession = useSessionStore.getState().sessionId === payload?.sessionId
            || useSessionStore.getState().sessionId === null;
          if (stillSameSession) {
            useSessionStore.getState().resetSession();
          }
        }, 1500);
      }
    });

    // Listen to permissions updated
    this.socket.on(SOCKET_EVENTS.PERMISSION_UPDATED, (payload) => {
      useSessionStore.getState().setPermissions(payload.permissions);
    });

    // In-session chat
    this.socket.on(SOCKET_EVENTS.SESSION_CHAT, (payload) => {
      const currentUserId = useAuthStore.getState().user?.id;
      useSessionStore.getState().addChatMessage({
        id: Math.random().toString(),
        senderName: payload.senderName,
        text: payload.text,
        timestamp: payload.timestamp,
        isSelf: payload.senderId === currentUserId,
      });
    });
  }

  registerCurrentDevice() {
    const device = useAuthStore.getState().currentDevice;
    if (this.socket && device?.publicDeviceId) {
      this.socket.emit(SOCKET_EVENTS.DEVICE_REGISTER, {
        deviceId: device.publicDeviceId,
      });
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const device = useAuthStore.getState().currentDevice;
      if (this.socket?.connected && device?.publicDeviceId) {
        this.socket.emit(SOCKET_EVENTS.DEVICE_HEARTBEAT, {
          deviceId: device.publicDeviceId,
        });
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Session Initiation & Response
  requestSession(targetDeviceId: string, permissions?: any) {
    if (!this.socket) {
      this.connect();
    }
    const user = useAuthStore.getState().user;
    const requesterId = user?.id || 'user-krish-001';
    const requesterName = user?.name || 'Krish';

    const send = () => {
      this.socket?.emit(SOCKET_EVENTS.SESSION_REQUEST, {
        targetDeviceId,
        requesterId,
        requesterName,
        permissions,
      });
    };

    if (this.socket?.connected) {
      send();
    } else {
      this.socket?.once('connect', send);
    }
  }

  acceptSession(sessionId: string, approvedPermissions: any, isDesktopHost: boolean = true) {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.SESSION_ACCEPT, {
      sessionId,
      approvedPermissions,
      isDesktopHost,
    });
  }

  rejectSession(sessionId: string, reason?: string) {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.SESSION_REJECT, {
      sessionId,
      reason,
    });
  }

  endSession(sessionId: string, reason?: string) {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.SESSION_END, {
      sessionId,
      reason,
    });
  }

  // WebRTC SDP & ICE
  sendOffer(sessionId: string, sdp: RTCSessionDescriptionInit) {
    this.socket?.emit(SOCKET_EVENTS.SIGNALING_OFFER, { sessionId, sdp });
  }

  sendAnswer(sessionId: string, sdp: RTCSessionDescriptionInit) {
    this.socket?.emit(SOCKET_EVENTS.SIGNALING_ANSWER, { sessionId, sdp });
  }

  sendIceCandidate(sessionId: string, candidate: RTCIceCandidate) {
    this.socket?.emit(SOCKET_EVENTS.SIGNALING_ICE_CANDIDATE, { sessionId, candidate });
  }

  // Chat
  sendChatMessage(sessionId: string, text: string) {
    const user = useAuthStore.getState().user;
    if (!this.socket || !user) return;
    this.socket.emit(SOCKET_EVENTS.SESSION_CHAT, {
      sessionId,
      senderId: user.id,
      senderName: user.name,
      text,
      timestamp: Date.now(),
    });
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
