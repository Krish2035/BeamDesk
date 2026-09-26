import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

router.post('/register', authRateLimiter, (req, res, next) => {
  authController.register(req, res).catch(next);
});

router.post('/login', authRateLimiter, (req, res, next) => {
  authController.login(req, res).catch(next);
});

router.post('/refresh', (req, res, next) => {
  authController.refresh(req, res).catch(next);
});

router.get('/me', authenticateToken, (req, res, next) => {
  authController.me(req, res).catch(next);
});

export const authRoutes = router;
