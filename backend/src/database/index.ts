import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

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

// Log connection lifecycle
export const connectDatabase = async () => {
  try {
    await Promise.race([
      prisma.$connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timed out')), 1500)),
    ]);
    isDbConnected = true;
    logger.info('Database connected successfully via Prisma');
  } catch (err: any) {
    isDbConnected = false;
    logger.warn('PostgreSQL database not reachable. Active persistent JSON file storage is enabled.', {
      error: err.message,
    });
  }
};

