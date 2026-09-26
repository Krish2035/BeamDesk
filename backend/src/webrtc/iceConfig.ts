import { Router } from 'express';
import { getIceServers } from '../config/index.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/config', authenticateToken, (_req, res) => {
  const iceServers = getIceServers();
  res.json({
    success: true,
    data: {
      iceServers,
    },
  });
});

export const iceConfigRoutes = router;
