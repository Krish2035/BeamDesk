import { Response } from 'express';
import { deviceService } from '../services/device.service.js';
import { registerDeviceSchema, saveDeviceSchema } from '../validators/device.validator.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class DeviceController {
  async register(req: AuthenticatedRequest, res: Response) {
    const validated = registerDeviceSchema.parse(req.body);
    const userId = req.user!.id;
    const device = await deviceService.registerDevice(userId, validated);
    res.status(201).json({
      success: true,
      data: device,
    });
  }

  async getMyDevices(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const devices = await deviceService.getMyDevices(userId);
    res.status(200).json({
      success: true,
      data: devices,
    });
  }

  async lookup(req: AuthenticatedRequest, res: Response) {
    const { publicDeviceId } = req.params;
    if (!publicDeviceId) {
      res.status(400).json({ success: false, error: 'Device ID is required' });
      return;
    }
    const device = await deviceService.lookupDevice(Array.isArray(publicDeviceId) ? publicDeviceId[0] : publicDeviceId);
    if (!device) {
      res.status(404).json({ success: false, error: 'Device not found' });
      return;
    }
    res.status(200).json({
      success: true,
      data: device,
    });
  }

  async getSavedDevices(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const saved = await deviceService.getSavedDevices(userId);
    res.status(200).json({
      success: true,
      data: saved,
    });
  }

  async saveDevice(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const validated = saveDeviceSchema.parse(req.body);
    const saved = await deviceService.saveDevice(userId, validated.deviceId, validated.customName);
    res.status(201).json({
      success: true,
      data: saved,
    });
  }
}

export const deviceController = new DeviceController();
