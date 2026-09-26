import { Response } from 'express';
import { sessionService } from '../services/session.service.js';
import { initiateSessionSchema, updatePermissionsSchema, endSessionSchema } from '../validators/session.validator.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class SessionController {
  async initiate(req: AuthenticatedRequest, res: Response) {
    const validated = initiateSessionSchema.parse(req.body);
    const userId = req.user!.id;
    const result = await sessionService.initiateSession(userId, validated.targetDeviceId, validated.permissions);
    res.status(201).json({
      success: true,
      data: result,
    });
  }

  async getSession(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = await sessionService.getSession(id);
    res.status(200).json({
      success: true,
      data: session,
    });
  }

  async updatePermissions(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const validated = updatePermissionsSchema.parse(req.body);
    const userId = req.user!.id;
    const updated = await sessionService.updatePermissions(id, validated.permissions, userId);
    res.status(200).json({
      success: true,
      data: updated,
    });
  }

  async endSession(req: AuthenticatedRequest, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const validated = endSessionSchema.parse(req.body);
    const userId = req.user!.id;
    const updated = await sessionService.updateSessionStatus(id, 'COMPLETED', validated.reason, userId);
    res.status(200).json({
      success: true,
      data: updated,
    });
  }

  async getHistory(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const history = await sessionService.getHistory(userId);
    res.status(200).json({
      success: true,
      data: history,
    });
  }
}

export const sessionController = new SessionController();
