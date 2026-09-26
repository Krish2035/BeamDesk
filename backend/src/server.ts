import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { connectDatabase } from './database/index.js';
import { setupSignalingSocket } from './websocket/signaling.socket.js';

const startServer = async () => {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$/.test(requestOrigin) || requestOrigin === config.CLIENT_URL) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  setupSignalingSocket(io);

  server.listen(config.PORT, () => {
    logger.info(`BeamDesk Backend Server listening on http://localhost:${config.PORT}`);
    logger.info(`WebRTC Signaling ready on ws://localhost:${config.PORT}/socket.io/`);
  });

  const shutdown = () => {
    logger.info('Shutting down BeamDesk server...');
    server.close(() => {
      logger.info('HTTP & Socket server terminated gracefully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
