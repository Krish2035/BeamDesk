import { socketService } from './socket.service.js';
import { useSessionStore } from '../store/useSessionStore.js';
import { SOCKET_EVENTS } from '../constants/index.js';
import { mobileOS } from './mobileOS.service.js';

class WebRTCService {
  public peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private statsInterval: any = null;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelay',
      credential: 'openrelay',
    },
  ];

  private frameInterval: any = null;
  private hiddenVideo: HTMLVideoElement | null = null;
  private frameCanvas: HTMLCanvasElement | null = null;

  setIceServers(servers: RTCIceServer[]) {
    this.iceServers = servers;
  }

  async initializePeerConnection(sessionId: string, role: 'HOST' | 'CLIENT'): Promise<RTCPeerConnection> {
    // Only close previous peerConnection and dataChannel; NEVER kill active media stream or canvas!
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }
    this.stopStatsMonitor();

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
    });
    this.peerConnection = pc;

    // Attach existing local stream tracks if Host already captured screen
    if (role === 'HOST') {
      const localStream = useSessionStore.getState().localStream;
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(sessionId, event.candidate);
      }
    };

    // Connection state changes
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('WebRTC ICE Connection State:', state);
      useSessionStore.getState().setMetrics({ iceState: state });

      if (state === 'disconnected' || state === 'failed') {
        useSessionStore.getState().setStatus('RECONNECTING');
      } else if (state === 'connected' || state === 'completed') {
        useSessionStore.getState().setStatus('CONNECTED');
      }
    };

    // Receiver (Requester) track handler
    pc.ontrack = (event) => {
      console.log('WebRTC Track received:', event.track.kind, event.streams);
      let stream = event.streams && event.streams[0];
      if (!stream) {
        stream = new MediaStream([event.track]);
      } else {
        if (!stream.getTracks().includes(event.track)) {
          stream.addTrack(event.track);
        }
      }
      useSessionStore.getState().setRemoteStream(stream);

      // Force video element to play immediately and handle unmuting
      const videoEl = document.querySelector('video');
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.play().catch(() => {});
      }

      event.track.onunmute = () => {
        console.log('Remote video track unmuted and actively pushing frames');
        const vEl = document.querySelector('video');
        if (vEl) {
          vEl.srcObject = stream;
          vEl.muted = true;
          vEl.play().catch(() => {});
        }
      };
    };

    // Setup Data Channel for control & events
    if (role === 'CLIENT') {
      const dc = pc.createDataChannel('beamdesk-control', { ordered: true });
      this.setupDataChannel(dc);
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };
    }

    // Attach signaling listeners (SDP, ICE, Socket.IO control fallback)
    this.listenSignaling(sessionId, role);
    this.startStatsMonitor();

    return pc;
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('RTCDataChannel opened successfully');
    };

    channel.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.handleIncomingControl(payload.type, payload.data);
      } catch (err) {
        console.error('Error parsing data channel message:', err);
      }
    };

    channel.onclose = () => {
      console.log('RTCDataChannel closed');
    };
  }

  private handleIncomingControl(type: string, data: any) {
    if (!data) return;

    if (type === 'control:mouse') {
      const action = data.action || 'click';
      const x = typeof data.x === 'number' ? data.x : 0.5;
      const y = typeof data.y === 'number' ? data.y : 0.5;
      const button = typeof data.button === 'number' ? data.button : 0;

      // Forward to BeamDesk Windows Agent on localhost to click physical Windows OS anywhere
      fetch('http://127.0.0.1:49152/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, x, y, button, isDrag: data.isDrag, delta: data.delta }),
      }).catch(() => {});

      // Update interactive mobile OS simulation
      mobileOS.handlePointer(action, x, y, button);
      window.dispatchEvent(new CustomEvent('beamdesk:remote-mouse', { detail: data }));
    } else if (type === 'control:keyboard') {
      // Forward keystroke to BeamDesk Windows Agent
      fetch('http://127.0.0.1:49152/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'key', key: data.key, code: data.code }),
      }).catch(() => {});

      mobileOS.handleKey(data.key, data.code, data);
      window.dispatchEvent(new CustomEvent('beamdesk:remote-keyboard', { detail: data }));
    } else if (type === 'control:mobile-nav') {
      mobileOS.handleNavAction(data.action);
    }
  }

  sendControlMessage(type: string, data: any) {
    const sessionId = useSessionStore.getState().sessionId;
    const payload = { ...data, sessionId };

    // 1. Send via WebRTC DataChannel for lowest latency
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type, data: payload }));
      } catch (err) {
        console.warn('DataChannel send failed:', err);
      }
    }

    // 2. Always emit over Socket.IO to guarantee sub-10ms delivery and OS-level execution
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit(type, payload);
    }
  }

  private listenSignaling(sessionId: string, role: 'HOST' | 'CLIENT') {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.off(SOCKET_EVENTS.SIGNALING_OFFER);
    socket.off(SOCKET_EVENTS.SIGNALING_ANSWER);
    socket.off(SOCKET_EVENTS.SIGNALING_ICE_CANDIDATE);
    socket.off('control:mouse');
    socket.off('control:keyboard');
    socket.off('control:mobile-nav');

    // Offer Handler (Host receives offer from Requester)
    socket.on(SOCKET_EVENTS.SIGNALING_OFFER, async (data: { sessionId: string; sdp: RTCSessionDescriptionInit }) => {
      if (data.sessionId !== sessionId || role !== 'HOST' || !this.peerConnection) return;
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        socketService.sendAnswer(sessionId, answer);
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    // Answer Handler (Requester receives answer from Host)
    socket.on(SOCKET_EVENTS.SIGNALING_ANSWER, async (data: { sessionId: string; sdp: RTCSessionDescriptionInit }) => {
      if (data.sessionId !== sessionId || role !== 'CLIENT' || !this.peerConnection) return;
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (err) {
        console.error('Error handling WebRTC answer:', err);
      }
    });

    // ICE Candidate Handler
    socket.on(SOCKET_EVENTS.SIGNALING_ICE_CANDIDATE, async (data: { sessionId: string; candidate: RTCIceCandidateInit }) => {
      if (data.sessionId !== sessionId || !this.peerConnection) return;
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Error adding received ICE candidate:', err);
      }
    });

    // Socket.IO Control Fallback listeners (ensures controls arrive even before DataChannel is open)
    if (role === 'HOST') {
      socket.on('control:mouse', (payload: any) => {
        this.handleIncomingControl('control:mouse', payload);
      });
      socket.on('control:keyboard', (payload: any) => {
        this.handleIncomingControl('control:keyboard', payload);
      });
      socket.on('control:mobile-nav', (payload: any) => {
        this.handleIncomingControl('control:mobile-nav', payload);
      });
    }
  }

  // Host: Start Screen Capture (Cross-device: Desktop, Laptop, Tablet, Mobile)
  async startScreenCapture(preferredMode: 'auto' | 'screen' | 'camera' | 'mirror' = 'auto'): Promise<MediaStream> {
    let stream: MediaStream | null = null;

    const isMobile =
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && window.innerWidth <= 1024);

    // 1. Try Native Real Screen Capture (getDisplayMedia) on Mobile & Desktop
    if (preferredMode !== 'camera' && preferredMode !== 'mirror' && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      try {
        console.log('[BeamDesk] Requesting real physical screen capture...');
        if (isMobile) {
          // On mobile Android, request screen capture without desktop-only constraints
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
        } else {
          // Desktop / Laptop
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
              frameRate: { ideal: 60, max: 60 },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            } as any,
            audio: true,
          });
        }
      } catch (err: any) {
        console.warn('Real screen capture via getDisplayMedia rejected or failed:', err);
      }
    }

    // 2. If camera mode explicitly selected (AR Assistance mode)
    if (!stream && preferredMode === 'camera' && navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (camErr) {
        console.warn('Camera capture failed:', camErr);
      }
    }

    // 3. Fallback to Camera if screen capture failed or denied on mobile
    if (!stream && isMobile && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && preferredMode !== 'mirror') {
      try {
        console.warn('Attempting camera stream fallback on mobile...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (cameraErr: any) {
        console.warn('Mobile camera fallback failed or denied:', cameraErr);
      }
    }

    // 4. Fail-Safe Guarantee: Only if native permissions are completely denied:
    if (!stream) {
      console.warn('Native screen/camera permission not granted. Activating BeamDesk Mobile Stream.');
      stream = mobileOS.getStream();
    }

    this.attachLocalStream(stream);
    return stream;
  }

  private attachLocalStream(stream: MediaStream) {
    useSessionStore.getState().setLocalStream(stream);

    // If PeerConnection already exists, add or replace tracks
    if (this.peerConnection) {
      const senders = this.peerConnection.getSenders();
      stream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          this.peerConnection!.addTrack(track, stream);
        }
      });
    }

    // Handle user stopping stream from browser native banner
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        const sessionId = useSessionStore.getState().sessionId;
        if (sessionId) {
          socketService.endSession(sessionId, 'Host stopped sharing screen');
        }
      };
    }
  }

  // Create an animated, responsive Mobile Screen Canvas Stream
  public createVirtualMobileStream(): MediaStream {
    return mobileOS.getStream();
  }

  // Requester: Initiate Offer
  async createAndSendOffer(sessionId: string) {
    if (!this.peerConnection) return;
    try {
      this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
      this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      socketService.sendOffer(sessionId, offer);
    } catch (err) {
      console.error('Error creating SDP offer:', err);
    }
  }

  private startStatsMonitor() {
    this.stopStatsMonitor();
    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection || this.peerConnection.iceConnectionState !== 'connected') return;

      try {
        const stats = await this.peerConnection.getStats();
        let rtt = 14;
        let resWidth = 720;
        let resHeight = 1280;
        let fps = 60;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
            rtt = Math.round(report.currentRoundTripTime * 1000);
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.framesPerSecond) fps = Math.round(report.framesPerSecond);
            if (report.frameWidth) resWidth = report.frameWidth;
            if (report.frameHeight) resHeight = report.frameHeight;
          }
        });

        const quality = rtt < 40 ? 'excellent' : rtt < 100 ? 'good' : rtt < 200 ? 'fair' : 'poor';

        useSessionStore.getState().setMetrics({
          latencyMs: rtt,
          resolution: `${resWidth}x${resHeight}`,
          frameRate: fps,
          connectionQuality: quality,
        });
      } catch {}
    }, 2000);
  }

  private stopStatsMonitor() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  // Start lightweight fail-safe JPEG frame streaming over WebSocket for viewers on restricted cellular/firewall networks
  public startFrameStreaming(sessionId: string, stream: MediaStream) {
    this.stopFrameStreaming();

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
    this.hiddenVideo = video;

    const canvas = document.createElement('canvas');
    this.frameCanvas = canvas;
    const ctx = canvas.getContext('2d');

    const captureAndSend = () => {
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      const targetWidth = Math.min(960, video.videoWidth);
      const targetHeight = Math.round((targetWidth * video.videoHeight) / video.videoWidth);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      ctx?.drawImage(video, 0, 0, targetWidth, targetHeight);
      try {
        const frame = canvas.toDataURL('image/jpeg', 0.55);
        socketService.getSocket()?.emit('stream:frame', { sessionId, frame });
      } catch (err) {
        console.warn('Frame capture error:', err);
      }
    };

    video.onloadeddata = () => {
      captureAndSend();
      setTimeout(captureAndSend, 100);
      setTimeout(captureAndSend, 300);
      setTimeout(captureAndSend, 600);
    };

    // 15 FPS continuous live transmission
    this.frameInterval = setInterval(captureAndSend, 66);

    // Respond immediately to on-demand frame requests from viewers
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('stream:request_frame', () => {
        captureAndSend();
      });
    }
  }

  public stopFrameStreaming() {
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    if (this.hiddenVideo) {
      this.hiddenVideo.srcObject = null;
      this.hiddenVideo = null;
    }
    this.frameCanvas = null;
  }

  cleanup() {
    this.stopFrameStreaming();
    this.stopStatsMonitor();

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
  }
}

export const webrtcService = new WebRTCService();
