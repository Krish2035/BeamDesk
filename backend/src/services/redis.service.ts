import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface ICacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
}

// Fallback in-memory store in case Redis is not available
class InMemoryCache implements ICacheStore {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async keys(pattern: string): Promise<string[]> {
    const now = Date.now();
    const result: string[] = [];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.store.delete(key);
        continue;
      }
      if (regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }
}

class RedisService implements ICacheStore {
  private client: Redis | null = null;
  private fallbackStore = new InMemoryCache();
  private isConnected = false;

  constructor() {
    try {
      this.client = new Redis(config.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't hang on connection failure
      });

      this.client.connect().then(() => {
        this.isConnected = true;
        logger.info('Connected successfully to Redis server');
      }).catch(() => {
        this.isConnected = false;
        logger.warn('Redis unavailable, using resilient in-memory presence and session cache');
      });

      this.client.on('error', () => {
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
      logger.warn('Redis client initialization failed, falling back to memory store');
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch {
        return this.fallbackStore.get(key);
      }
    }
    return this.fallbackStore.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch {
        // Fall back on error
      }
    }
    await this.fallbackStore.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        // Fall back on error
      }
    }
    await this.fallbackStore.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.isConnected && this.client) {
      try {
        const count = await this.client.exists(key);
        return count > 0;
      } catch {
        return this.fallbackStore.exists(key);
      }
    }
    return this.fallbackStore.exists(key);
  }

  async keys(pattern: string): Promise<string[]> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.keys(pattern);
      } catch {
        return this.fallbackStore.keys(pattern);
      }
    }
    return this.fallbackStore.keys(pattern);
  }

  // Domain-specific presence helpers
  async setDeviceOnline(deviceId: string, socketId: string): Promise<void> {
    await this.set(`device:presence:${deviceId}`, 'ONLINE', 180);
    await this.set(`device:socket:${deviceId}`, socketId, 180);
    await this.set(`socket:device:${socketId}`, deviceId, 180);
  }

  async refreshDeviceHeartbeat(deviceId: string): Promise<void> {
    await this.set(`device:presence:${deviceId}`, 'ONLINE', 180);
  }

  async setDeviceOffline(deviceId: string): Promise<void> {
    const socketId = await this.get(`device:socket:${deviceId}`);
    if (socketId) {
      await this.del(`socket:device:${socketId}`);
    }
    await this.del(`device:presence:${deviceId}`);
    await this.del(`device:socket:${deviceId}`);
  }

  async isDeviceOnline(deviceId: string): Promise<boolean> {
    const status = await this.get(`device:presence:${deviceId}`);
    return status === 'ONLINE';
  }

  async getSocketByDevice(deviceId: string): Promise<string | null> {
    return this.get(`device:socket:${deviceId}`);
  }

  async getDeviceBySocket(socketId: string): Promise<string | null> {
    return this.get(`socket:device:${socketId}`);
  }
}

export const redisService = new RedisService();
