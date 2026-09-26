import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/beamdesk?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16).default('beamdesk_dev_access_secret_key_12345678901234567890'),
  JWT_REFRESH_SECRET: z.string().min(16).default('beamdesk_dev_refresh_secret_key_12345678901234567890'),
  ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  STUN_SERVERS: z.string().default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
  TURN_URL: z.string().optional().default(''),
  TURN_USERNAME: z.string().optional().default(''),
  TURN_CREDENTIAL: z.string().optional().default(''),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(500),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

export const getIceServers = () => {
  const stunList = config.STUN_SERVERS.split(',').map((url) => ({ urls: url.trim() }));
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [...stunList];

  if (config.TURN_URL && config.TURN_USERNAME && config.TURN_CREDENTIAL) {
    iceServers.push({
      urls: config.TURN_URL,
      username: config.TURN_USERNAME,
      credential: config.TURN_CREDENTIAL,
    });
  }

  return iceServers;
};
