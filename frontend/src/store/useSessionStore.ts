import { create } from 'zustand';
import {
  IncomingRequestData,
  SessionPermissions,
  ConnectionMetrics,
  ChatMessage,
} from '../types/index.js';
import { DEFAULT_PERMISSIONS } from '../constants/index.js';

interface SessionState {
  // Active session
  sessionId: string | null;
  role: 'HOST' | 'CLIENT' | null;
  targetDeviceId: string | null;
  status: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ENDED';
  error: string | null;

  // Streams
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;

  // Permissions & Metrics
  permissions: SessionPermissions;
  metrics: ConnectionMetrics;

  // In-session interaction
  chatMessages: ChatMessage[];
  incomingRequest: IncomingRequestData | null;

  // Actions
  setSession: (
    sessionId: string,
    role: 'HOST' | 'CLIENT',
    targetDeviceId: string
  ) => void;
  setStatus: (status: SessionState['status']) => void;
  setError: (error: string | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setPermissions: (permissions: Partial<SessionPermissions>) => void;
  setMetrics: (metrics: Partial<ConnectionMetrics>) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setIncomingRequest: (request: IncomingRequestData | null) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessionId: null,
  role: null,
  targetDeviceId: null,
  status: 'IDLE',
  error: null,

  remoteStream: null,
  localStream: null,

  permissions: { ...DEFAULT_PERMISSIONS },
  metrics: {
    latencyMs: 16,
    resolution: '1920x1080',
    frameRate: 60,
    iceState: 'connected',
    connectionQuality: 'excellent',
  },

  chatMessages: [],
  incomingRequest: null,

  setSession: (sessionId, role, targetDeviceId) =>
    set({ sessionId, role, targetDeviceId, status: 'CONNECTING', error: null }),

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: 'ENDED' }),

  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setLocalStream: (localStream) => set({ localStream }),

  setPermissions: (newPerms) =>
    set((state) => ({ permissions: { ...state.permissions, ...newPerms } })),

  setMetrics: (newMetrics) =>
    set((state) => ({ metrics: { ...state.metrics, ...newMetrics } })),

  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),

  setIncomingRequest: (incomingRequest) => set({ incomingRequest }),

  resetSession: () =>
    set((state) => {
      // Clean up media tracks
      if (state.localStream) {
        state.localStream.getTracks().forEach((t) => t.stop());
      }
      return {
        sessionId: null,
        role: null,
        targetDeviceId: null,
        status: 'IDLE',
        error: null,
        remoteStream: null,
        localStream: null,
        chatMessages: [],
        incomingRequest: null,
      };
    }),
}));
