import { Router } from 'express';
import { deviceController } from '../controllers/device.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.post('/register', (req, res, next) => {
  deviceController.register(req, res).catch(next);
});

router.get('/my', (req, res, next) => {
  deviceController.getMyDevices(req, res).catch(next);
});

router.get('/lookup/:publicDeviceId', (req, res, next) => {
  deviceController.lookup(req, res).catch(next);
});

router.get('/saved', (req, res, next) => {
  deviceController.getSavedDevices(req, res).catch(next);
});

router.post('/saved', (req, res, next) => {
  deviceController.saveDevice(req, res).catch(next);
});

export const deviceRoutes = router;
