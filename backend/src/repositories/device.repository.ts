import { prisma, isDbConnected } from '../database/index.js';
import { v4 as uuidv4 } from 'uuid';
import { generatePublicDeviceId, normalizeDeviceId } from '../utils/idGenerator.js';
import { readJsonFile, writeJsonFile } from '../utils/fileStorage.js';

export interface DeviceRecord {
  id: string;
  userId: string;
  publicDeviceId: string;
  name: string;
  platform: string;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedDeviceRecord {
  id: string;
  userId: string;
  deviceId: string;
  customName: string | null;
  createdAt: Date;
  device?: DeviceRecord;
}

const initialDevices: DeviceRecord[] = [
  {
    id: 'dev-krish-01',
    userId: 'user-krish-001',
    publicDeviceId: '482 913 741',
    name: 'Krish Windows Laptop',
    platform: 'windows',
    status: 'ONLINE',
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dev-krish-02',
    userId: 'user-krish-001',
    publicDeviceId: '629 384 105',
    name: 'Krish Android Phone',
    platform: 'android',
    status: 'ONLINE',
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let persistentDevices: DeviceRecord[] = readJsonFile<DeviceRecord[]>('devices.json', initialDevices);
let persistentSavedDevices: SavedDeviceRecord[] = readJsonFile<SavedDeviceRecord[]>('saved_devices.json', []);

export class DeviceRepository {
  async findByPublicId(publicDeviceId: string): Promise<DeviceRecord | null> {
    const rawDigits = publicDeviceId.replace(/\D/g, '');
    const standardDash = normalizeDeviceId(publicDeviceId);
    const standardSpace =
      rawDigits.length === 9
        ? `${rawDigits.slice(0, 3)} ${rawDigits.slice(3, 6)} ${rawDigits.slice(6, 9)}`
        : publicDeviceId.trim();

    if (isDbConnected) {
      try {
        const device = await prisma.device.findFirst({
          where: {
            OR: [
              { publicDeviceId: standardDash },
              { publicDeviceId: standardSpace },
              { publicDeviceId: rawDigits },
            ],
          },
        });
        if (device) return device as DeviceRecord;
      } catch {
        // Fallback
      }
    }

    const found = persistentDevices.find((d) => {
      const dDigits = d.publicDeviceId.replace(/\D/g, '');
      return (
        (rawDigits.length > 0 && dDigits === rawDigits) ||
        d.publicDeviceId === standardDash ||
        d.publicDeviceId === standardSpace ||
        d.publicDeviceId === publicDeviceId.trim()
      );
    });
    if (found) return found;

    if (rawDigits.length === 9) {
      return this.createOrGetAnonymousDevice(standardDash);
    }

    return null;
  }

  async createOrGetAnonymousDevice(
    publicDeviceId: string,
    name = 'Android Device',
    platform = 'Android'
  ): Promise<DeviceRecord> {
    const rawDigits = publicDeviceId.replace(/\D/g, '');
    const standardDash = normalizeDeviceId(publicDeviceId);

    if (isDbConnected) {
      try {
        const existing = await prisma.device.findFirst({
          where: {
            OR: [
              { publicDeviceId: standardDash },
              { publicDeviceId: rawDigits },
            ],
          },
        });
        if (existing) return existing as DeviceRecord;
      } catch {
        // Fallback
      }
    }

    const inMem = persistentDevices.find((d) => {
      const dDigits = d.publicDeviceId.replace(/\D/g, '');
      return dDigits === rawDigits || d.publicDeviceId === standardDash;
    });
    if (inMem) return inMem;

    let targetUserId = 'user-krish-001';

    if (isDbConnected) {
      try {
        let user = await prisma.user.findFirst();
        if (user) {
          targetUserId = user.id;
        }

        const created = await prisma.device.create({
          data: {
            userId: targetUserId,
            name,
            platform,
            publicDeviceId: standardDash,
            status: 'ONLINE',
            lastSeenAt: new Date(),
          },
        });
        return created as DeviceRecord;
      } catch (err) {
        // Fallback to local storage if DB error occurs
      }
    }

    const newDevice: DeviceRecord = {
      id: uuidv4(),
      userId: targetUserId,
      publicDeviceId: standardDash,
      name,
      platform,
      status: 'ONLINE',
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    persistentDevices.push(newDevice);
    writeJsonFile('devices.json', persistentDevices);
    return newDevice;
  }

  async findById(id: string): Promise<DeviceRecord | null> {
    if (isDbConnected) {
      try {
        const device = await prisma.device.findUnique({ where: { id } });
        if (device) return device as DeviceRecord;
      } catch {
        // Fallback
      }
    }
    return persistentDevices.find((d) => d.id === id) || null;
  }

  async findByUserId(userId: string): Promise<DeviceRecord[]> {
    if (isDbConnected) {
      try {
        const devices = await prisma.device.findMany({
          where: { userId },
          orderBy: { lastSeenAt: 'desc' },
        });
        if (devices.length > 0) return devices as DeviceRecord[];
      } catch {
        // Fallback
      }
    }
    return persistentDevices.filter((d) => d.userId === userId);
  }

  async create(data: {
    userId: string;
    name: string;
    platform: string;
    publicDeviceId?: string;
  }): Promise<DeviceRecord> {
    const publicDeviceId = data.publicDeviceId || generatePublicDeviceId();
    if (isDbConnected) {
      try {
        return (await prisma.device.create({
          data: {
            userId: data.userId,
            name: data.name,
            platform: data.platform,
            publicDeviceId,
            status: 'ONLINE',
            lastSeenAt: new Date(),
          },
        })) as DeviceRecord;
      } catch {
        // Fallback
      }
    }

    const newDevice: DeviceRecord = {
      id: uuidv4(),
      userId: data.userId,
      publicDeviceId,
      name: data.name,
      platform: data.platform,
      status: 'ONLINE',
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    persistentDevices.push(newDevice);
    writeJsonFile('devices.json', persistentDevices);
    return newDevice;
  }

  async updateStatus(
    id: string,
    status: 'ONLINE' | 'BUSY' | 'OFFLINE'
  ): Promise<DeviceRecord | null> {
    if (isDbConnected) {
      try {
        const existing = await prisma.device.findUnique({ where: { id } });
        if (existing) {
          return (await prisma.device.update({
            where: { id },
            data: { status, lastSeenAt: new Date() },
          })) as DeviceRecord;
        }
      } catch {
        // Fallback
      }
    }

    const device = persistentDevices.find((d) => d.id === id);
    if (device) {
      device.status = status;
      device.lastSeenAt = new Date();
      device.updatedAt = new Date();
      writeJsonFile('devices.json', persistentDevices);
      return device;
    }
    return null;
  }

  async getSavedDevices(userId: string): Promise<(SavedDeviceRecord & { device: DeviceRecord })[]> {
    if (isDbConnected) {
      try {
        const saved = await prisma.savedDevice.findMany({
          where: { userId },
          include: { device: true },
          orderBy: { createdAt: 'desc' },
        });
        if (saved.length > 0) {
          return saved as unknown as (SavedDeviceRecord & { device: DeviceRecord })[];
        }
      } catch {
        // Fallback
      }
    }

    const filtered = persistentSavedDevices.filter((s) => s.userId === userId);
    return filtered
      .map((s) => {
        const dev = persistentDevices.find((d) => d.id === s.deviceId);
        return dev ? { ...s, device: dev } : null;
      })
      .filter((s): s is SavedDeviceRecord & { device: DeviceRecord } => s !== null);
  }

  async saveDevice(userId: string, deviceId: string, customName?: string): Promise<SavedDeviceRecord> {
    if (isDbConnected) {
      try {
        return (await prisma.savedDevice.upsert({
          where: {
            userId_deviceId: { userId, deviceId },
          },
          update: { customName },
          create: { userId, deviceId, customName },
        })) as SavedDeviceRecord;
      } catch {
        // Fallback
      }
    }

    const existing = persistentSavedDevices.find(
      (s) => s.userId === userId && s.deviceId === deviceId
    );
    if (existing) {
      existing.customName = customName || null;
      writeJsonFile('saved_devices.json', persistentSavedDevices);
      return existing;
    }
    const newSaved: SavedDeviceRecord = {
      id: uuidv4(),
      userId,
      deviceId,
      customName: customName || null,
      createdAt: new Date(),
    };
    persistentSavedDevices.push(newSaved);
    writeJsonFile('saved_devices.json', persistentSavedDevices);
    return newSaved;
  }
}

export const deviceRepository = new DeviceRepository();
