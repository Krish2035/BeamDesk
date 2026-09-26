export const formatDeviceId = (id: string): string => {
  const digits = id.replace(/\D/g, '');
  if (digits.length !== 9) return id;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
};

export const normalizeDeviceId = (id: string): string => {
  const digits = id.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  }
  return id.trim();
};

export const detectPlatform = (): 'Windows' | 'macOS' | 'Linux' | 'Web' | 'Android' | 'iOS' => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  // iOS detection (iPhone, iPod, iPad, and iPadOS 13+ which presents as MacIntel with touch points)
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  if (isIOS) return 'iOS';

  // Android detection
  if (/android/.test(userAgent)) return 'Android';

  // Desktop OS detection
  if (userAgent.includes('win')) return 'Windows';
  if (userAgent.includes('mac')) return 'macOS';
  if (userAgent.includes('linux')) return 'Linux';

  return 'Web';
};

export type DeviceType = 'laptop' | 'desktop' | 'tablet' | 'mobile';

export const detectDeviceType = (): DeviceType => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const hasTouch = window.navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const width = window.screen.width;
  const height = window.screen.height;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  // Tablets: iPad, Android Tablets, large touchscreens
  const isIPad = /ipad/.test(userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isAndroidTablet = /android/.test(userAgent) && !/mobile/.test(userAgent);
  if (isIPad || isAndroidTablet || (hasTouch && minDim >= 600 && minDim <= 1024)) {
    return 'tablet';
  }

  // Mobile Phones: iPhone, Android Phones, small touch devices
  const isMobilePhone = /iphone|ipod/.test(userAgent) || (/android/.test(userAgent) && /mobile/.test(userAgent));
  if (isMobilePhone || (hasTouch && minDim < 600)) {
    return 'mobile';
  }

  // Desktops vs Laptops
  // If resolution indicates standard portable screen (<= 1600 width or standard laptop ratio)
  if (maxDim <= 1600 || ('getBattery' in window.navigator)) {
    return 'laptop';
  }

  return 'desktop';
};

export const formatRelativeTime = (isoString?: string | null): string => {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString();
};
