export const APP_NAME = 'BeamDesk';
export const APP_TAGLINE = 'Ultra-fast, secure remote desktop and collaborative support';

const isProductionHost =
  typeof window !== 'undefined' &&
  (window.location.hostname.includes('vercel.app') ||
   (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'));

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (isProductionHost ? 'https://beamdesk-backend.onrender.com/api' : '/api');

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (isProductionHost ? 'https://beamdesk-backend.onrender.com' : (typeof window !== 'undefined' ? window.location.origin : ''));

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'beamdesk_access_token',
  REFRESH_TOKEN: 'beamdesk_refresh_token',
  USER: 'beamdesk_user',
  DEVICE_ID: 'beamdesk_device_id',
} as const;

export const SOCKET_EVENTS = {
  DEVICE_REGISTER: 'device:register',
  DEVICE_REGISTERED: 'device:registered',
  DEVICE_HEARTBEAT: 'device:heartbeat',
  DEVICE_STATUS_UPDATE: 'device:status_update',

  SESSION_REQUEST: 'session:request',
  SESSION_REQUEST_INCOMING: 'session:request_incoming',
  SESSION_ACCEPT: 'session:accept',
  SESSION_ACCEPTED: 'session:accepted',
  SESSION_REJECT: 'session:reject',
  SESSION_REJECTED: 'session:rejected',
  SESSION_END: 'session:end',
  SESSION_ENDED: 'session:ended',

  PERMISSION_UPDATE: 'permission:update',
  PERMISSION_UPDATED: 'permission:updated',

  SIGNALING_OFFER: 'webrtc:offer',
  SIGNALING_ANSWER: 'webrtc:answer',
  SIGNALING_ICE_CANDIDATE: 'webrtc:ice_candidate',

  SESSION_CHAT: 'session:chat',
  ERROR: 'system:error',
} as const;

export const DEFAULT_PERMISSIONS: {
  allowMouse: boolean;
  allowKeyboard: boolean;
  allowAudio: boolean;
  allowClipboard: boolean;
  allowFileTransfer: boolean;
} = {
  allowMouse: true,
  allowKeyboard: true,
  allowAudio: true,
  allowClipboard: false,
  allowFileTransfer: false,
};
