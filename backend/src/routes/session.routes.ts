import { Router } from 'express';
import { sessionController } from '../controllers/session.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.post('/initiate', (req, res, next) => {
  sessionController.initiate(req, res).catch(next);
});

router.get('/history', (req, res, next) => {
  sessionController.getHistory(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  sessionController.getSession(req, res).catch(next);
});

router.patch('/:id/permissions', (req, res, next) => {
  sessionController.updatePermissions(req, res).catch(next);
});

router.post('/:id/end', (req, res, next) => {
  sessionController.endSession(req, res).catch(next);
});

export const sessionRoutes = router;
