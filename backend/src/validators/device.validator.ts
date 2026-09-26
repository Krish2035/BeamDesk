import { z } from 'zod';

export const registerDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required').max(60),
  platform: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      if (lower === 'windows') return 'Windows';
      if (lower === 'macos' || lower === 'mac') return 'macOS';
      if (lower === 'linux') return 'Linux';
      if (lower === 'android') return 'Android';
      if (lower === 'ios') return 'iOS';
      if (lower === 'web') return 'Web';
    }
    return val;
  }, z.enum(['Windows', 'macOS', 'Linux', 'Web', 'Android', 'iOS'])),
  existingDeviceId: z.string().optional(),
});

export const updateDeviceStatusSchema = z.object({
  status: z.enum(['ONLINE', 'BUSY', 'OFFLINE']),
});

export const saveDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device identifier'),
  customName: z.string().max(60).optional(),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type UpdateDeviceStatusInput = z.infer<typeof updateDeviceStatusSchema>;
export type SaveDeviceInput = z.infer<typeof saveDeviceSchema>;
