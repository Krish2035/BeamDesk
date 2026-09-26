export const SYSTEM_CONSTANTS = {
  APP_NAME: 'BeamDesk',
  DEFAULT_PORT: 4000,
  DEFAULT_CLIENT_URL: 'http://localhost:5173',
  DEVICE_ID_LENGTH: 9, // 9 digits: XXX-XXX-XXX
  SESSION_TIMEOUT_SECONDS: 60, // 60s for host to answer request
  HEARTBEAT_INTERVAL_MS: 15000,
  DEVICE_OFFLINE_THRESHOLD_MS: 35000,
} as const;

export const SOCKET_EVENTS = {
  // Device
  DEVICE_REGISTER: 'device:register',
  DEVICE_REGISTERED: 'device:registered',
  DEVICE_HEARTBEAT: 'device:heartbeat',
  DEVICE_STATUS_UPDATE: 'device:status_update',

  // Session initiation & negotiation
  SESSION_REQUEST: 'session:request',
  SESSION_REQUEST_INCOMING: 'session:request_incoming',
  SESSION_ACCEPT: 'session:accept',
  SESSION_ACCEPTED: 'session:accepted',
  SESSION_REJECT: 'session:reject',
  SESSION_REJECTED: 'session:rejected',
  SESSION_END: 'session:end',
  SESSION_ENDED: 'session:ended',

  // Permissions
  PERMISSION_UPDATE: 'permission:update',
  PERMISSION_UPDATED: 'permission:updated',

  // WebRTC Signaling
  SIGNALING_OFFER: 'webrtc:offer',
  SIGNALING_ANSWER: 'webrtc:answer',
  SIGNALING_ICE_CANDIDATE: 'webrtc:ice_candidate',

  // In-session chat & diagnostics
  SESSION_CHAT: 'session:chat',
  SESSION_PING: 'session:ping',
  SESSION_PONG: 'session:pong',

  // Errors & notifications
  ERROR: 'system:error',
} as const;
