export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type DeviceType = 'laptop' | 'desktop' | 'tablet' | 'mobile';

export interface Device {
  id: string;
  userId: string;
  publicDeviceId: string;
  name: string;
  platform: 'Windows' | 'macOS' | 'Linux' | 'Web' | 'Android' | 'iOS';
  deviceType?: DeviceType;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  lastSeenAt: string;
  isOnline?: boolean;
}

export interface SavedDevice {
  id: string;
  userId: string;
  deviceId: string;
  customName: string | null;
  createdAt: string;
  device: Device;
}

export interface SessionPermissions {
  allowMouse: boolean;
  allowKeyboard: boolean;
  allowAudio: boolean;
  allowClipboard: boolean;
  allowFileTransfer: boolean;
}

export interface SessionRecord {
  id: string;
  requesterId: string;
  targetDeviceId: string;
  status: 'PENDING' | 'CONNECTED' | 'RECONNECTING' | 'COMPLETED' | 'REJECTED' | 'FAILED' | 'TIMED_OUT';
  startedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
  targetDevice?: Device;
  requester?: { id: string; name: string; email: string };
  permissions?: SessionPermissions;
}

export interface IncomingRequestData {
  sessionId: string;
  requesterId: string;
  requesterName: string;
  targetDeviceId: string;
  permissions?: SessionPermissions;
}

export interface ConnectionMetrics {
  latencyMs: number;
  resolution: string;
  frameRate: number;
  iceState: RTCIceConnectionState | 'disconnected';
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSelf: boolean;
}
