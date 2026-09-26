import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { defaultPasswordHash } from '../repositories/user.repository.js';

// Extend NodeJS global to maintain a singleton in dev
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export let isDbConnected = false;

export const seedDefaultData = async () => {
  try {
    const users = [
      {
        id: 'user-krish-001',
        name: 'Krish',
        email: 'krish@beamdesk.io',
        passwordHash: defaultPasswordHash,
      },
      {
        id: 'user-demo-002',
        name: 'Demo User',
        email: 'demo@beamdesk.io',
        passwordHash: defaultPasswordHash,
      },
      {
        id: 'user-alex-003',
        name: 'Alex Rivera',
        email: 'alex@beamdesk.io',
        passwordHash: defaultPasswordHash,
      },
    ];

    for (const u of users) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: { name: u.name, email: u.email },
        create: u,
      });
    }

    // Default primary laptop device
    await prisma.device.upsert({
      where: { publicDeviceId: '317-914-777' },
      update: { status: 'ONLINE', lastSeenAt: new Date() },
      create: {
        id: 'dev-laptop-krish',
        userId: 'user-krish-001',
        publicDeviceId: '317-914-777',
        name: 'Krish Windows Laptop',
        platform: 'Windows',
        status: 'ONLINE',
      },
    });

    logger.info('Database seeded with standard accounts and devices');
  } catch (err: any) {
    logger.warn('Seed operation skipped or completed with warnings', { error: err.message });
  }
};

// Log connection lifecycle
export const connectDatabase = async () => {
  try {
    await Promise.race([
      prisma.$connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timed out')), 2500)),
    ]);
    isDbConnected = true;
    logger.info('Database connected successfully via Prisma');
    await seedDefaultData();
  } catch (err: any) {
    isDbConnected = false;
    logger.warn('PostgreSQL database not reachable. Active persistent JSON file storage is enabled.', {
      error: err.message,
    });
  }
};

