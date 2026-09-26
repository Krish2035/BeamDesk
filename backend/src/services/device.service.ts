import { deviceRepository, DeviceRecord } from '../repositories/device.repository.js';
import { redisService } from './redis.service.js';
import { normalizeDeviceId } from '../utils/idGenerator.js';
import { sessionRepository } from '../repositories/session.repository.js';

export class DeviceService {
  async registerDevice(userId: string, data: { name: string; platform: string; existingDeviceId?: string }): Promise<DeviceRecord> {
    if (data.existingDeviceId) {
      const existing = await deviceRepository.findByPublicId(normalizeDeviceId(data.existingDeviceId));
      if (existing && existing.userId === userId) {
        await deviceRepository.updateStatus(existing.id, 'ONLINE');
        return existing;
      }
    }

    const device = await deviceRepository.create({
      userId,
      name: data.name,
      platform: data.platform,
    });

    await sessionRepository.createAuditLog({
      userId,
      action: 'DEVICE_REGISTERED',
      metadata: { deviceId: device.id, publicDeviceId: device.publicDeviceId, platform: device.platform },
    });

    return device;
  }

  async getMyDevices(userId: string): Promise<DeviceRecord[]> {
    const devices = await deviceRepository.findByUserId(userId);
    // Enrich with dynamic presence from Redis
    const enriched = await Promise.all(
      devices.map(async (dev) => {
        const isOnline = await redisService.isDeviceOnline(dev.publicDeviceId);
        return {
          ...dev,
          status: isOnline ? ('ONLINE' as const) : dev.status,
        };
      })
    );
    return enriched;
  }

  async lookupDevice(publicDeviceId: string): Promise<{
    id: string;
    publicDeviceId: string;
    name: string;
    platform: string;
    status: 'ONLINE' | 'BUSY' | 'OFFLINE';
    isOnline: boolean;
  } | null> {
    const normalized = normalizeDeviceId(publicDeviceId);
    const device = await deviceRepository.findByPublicId(normalized);
    if (!device) return null;

    const isOnline = await redisService.isDeviceOnline(device.publicDeviceId);

    return {
      id: device.id,
      publicDeviceId: device.publicDeviceId,
      name: device.name,
      platform: device.platform,
      status: isOnline ? 'ONLINE' : device.status === 'BUSY' ? 'BUSY' : 'OFFLINE',
      isOnline,
    };
  }

  async getSavedDevices(userId: string) {
    const saved = await deviceRepository.getSavedDevices(userId);
    return Promise.all(
      saved.map(async (item) => {
        const isOnline = await redisService.isDeviceOnline(item.device.publicDeviceId);
        return {
          ...item,
          device: {
            ...item.device,
            isOnline,
          },
        };
      })
    );
  }

  async saveDevice(userId: string, deviceId: string, customName?: string) {
    return deviceRepository.saveDevice(userId, deviceId, customName);
  }
}

export const deviceService = new DeviceService();
