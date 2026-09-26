import { create } from 'zustand';
import { User, Device } from '../types/index.js';
import { STORAGE_KEYS } from '../constants/index.js';
import { apiClient } from '../api/client.js';
import { detectPlatform, detectDeviceType } from '../utils/format';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  currentDevice: Device | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setCurrentDevice: (device: Device | null) => void;
  initAuth: () => Promise<void>;
  registerDevice: (customName?: string) => Promise<Device | null>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  currentDevice: null,
  isLoading: true,
  error: null,

  setUser: (user) => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
    set({ user });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    set({ accessToken });
  },

  setCurrentDevice: (device) => {
    if (device) {
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, device.publicDeviceId);
    }
    set({ currentDevice: device });
    import('../services/socket.service.js').then(({ socketService }) => {
      socketService.registerCurrentDevice();
    }).catch(() => {});
  },

  initAuth: async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

    if (!token) {
      set({ user: null, accessToken: null, isLoading: false });
      return;
    }

    if (storedUser) {
      try {
        set({ user: JSON.parse(storedUser) });
      } catch {}
    }

    try {
      const data = await apiClient<{ user: User }>('/auth/me');
      set({ user: data.user, isLoading: false });
      // Register or reclaim device
      await get().registerDevice();
      import('../services/socket.service.js').then(({ socketService }) => {
        socketService.registerCurrentDevice();
      }).catch(() => {});
    } catch {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      set({ user: null, accessToken: null, currentDevice: null, isLoading: false });
    }
  },

  registerDevice: async (customName?: string) => {
    const storedDeviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    const platform = detectPlatform();
    const deviceType = detectDeviceType();
    const typeLabel = deviceType === 'mobile' ? 'Phone' : deviceType === 'tablet' ? 'Tablet' : deviceType === 'laptop' ? 'Laptop' : 'Workstation';
    const defaultName = `${platform} ${typeLabel}`;

    try {
      const device = await apiClient<Device>('/devices/register', {
        method: 'POST',
        body: JSON.stringify({
          name: customName || defaultName,
          platform,
          existingDeviceId: storedDeviceId || undefined,
        }),
      });

      const enrichedDevice: Device = { ...device, deviceType };
      set({ currentDevice: enrichedDevice });
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, device.publicDeviceId);
      
      // Ensure socket registers device immediately with signaling server
      try {
        const { socketService } = await import('../services/socket.service.js');
        socketService.registerCurrentDevice();
      } catch {}

      return enrichedDevice;
    } catch (err: any) {
      console.error('Failed to register device:', err);
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    set({ user: null, accessToken: null, currentDevice: null });
  },
}));
