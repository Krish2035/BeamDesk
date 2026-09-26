import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { authRoutes } from './routes/auth.routes.js';
import { deviceRoutes } from './routes/device.routes.js';
import { sessionRoutes } from './routes/session.routes.js';
import { iceConfigRoutes } from './webrtc/iceConfig.js';
import { adbRouter } from './routes/adb.routes.js';
import { standardRateLimiter } from './middleware/rateLimiter.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

export const createApp = () => {
  const app = express();

  // Security & Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Allow WebRTC / WebSockets in dev
  }));

  // CORS (Cross-device: Laptop, PC, Mobile, Tablet on LAN & localhost via HTTP/HTTPS)
  app.use(cors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (mobile apps, curl), localhost, or LAN IPs via HTTP or HTTPS
      if (!requestOrigin || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$/.test(requestOrigin) || requestOrigin === config.CLIENT_URL) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(standardRateLimiter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'BeamDesk Backend',
      timestamp: new Date().toISOString(),
    });
  });

  // REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/webrtc', iceConfigRoutes);
  app.use('/api/adb', adbRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });

  // Centralized Error handler
  app.use(errorHandler);

  return app;
};
