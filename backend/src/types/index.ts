export interface UserPayload {
  id: string;
  email: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type DevicePlatform = 'Windows' | 'macOS' | 'Linux' | 'Web' | 'Android' | 'iOS';
export type DeviceState = 'ONLINE' | 'BUSY' | 'OFFLINE';

export type SessionState =
  | 'PENDING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'TIMED_OUT';

export interface SessionPermissions {
  allowMouse: boolean;
  allowKeyboard: boolean;
  allowAudio: boolean;
  allowClipboard: boolean;
  allowFileTransfer: boolean;
}

export interface SignalingMessage<T = unknown> {
  type: string;
  sessionId: string;
  fromDeviceId: string;
  toDeviceId: string;
  payload: T;
  timestamp: number;
}

export interface MouseEventPayload {
  action: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'wheel';
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  button?: number;
  deltaX?: number;
  deltaY?: number;
}

export interface KeyboardEventPayload {
  action: 'keydown' | 'keyup';
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface ChatMessagePayload {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}
