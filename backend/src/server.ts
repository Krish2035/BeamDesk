import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { connectDatabase } from './database/index.js';
import { setupSignalingSocket } from './websocket/signaling.socket.js';

const startServer = async () => {
  await connectDatabase();

  // We need io before app so the debug endpoint can reference it.
  // Create a dummy http server first, attach io, then create the express app with io reference.
  const server = http.createServer();

  const io = new SocketIOServer(server, {
    cors: {
      origin: (_requestOrigin, callback) => {
        callback(null, true); // Allow all origins (CORS handled by express)
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 50 * 1024 * 1024, // 50MB — allow large JPEG frame payloads from mobile
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Now create express app with io reference (so debug endpoint works)
  const app = createApp(io);

  // Attach express app as the HTTP request handler
  server.on('request', app);

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
