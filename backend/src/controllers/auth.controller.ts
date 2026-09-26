import { Response } from 'express';
import { authService } from '../services/auth.service.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class AuthController {
  async register(req: AuthenticatedRequest, res: Response) {
    const validated = registerSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const result = await authService.register(validated, ip);
    res.status(201).json({
      success: true,
      data: result,
    });
  }

  async login(req: AuthenticatedRequest, res: Response) {
    const validated = loginSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const result = await authService.login(validated, ip);
    res.status(200).json({
      success: true,
      data: result,
    });
  }

  async refresh(req: AuthenticatedRequest, res: Response) {
    const validated = refreshTokenSchema.parse(req.body);
    const tokens = await authService.refresh(validated.refreshToken);
    res.status(200).json({
      success: true,
      data: tokens,
    });
  }

  async me(req: AuthenticatedRequest, res: Response) {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  }
}

export const authController = new AuthController();
