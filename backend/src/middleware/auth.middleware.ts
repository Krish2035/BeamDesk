import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UserPayload } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication token missing',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as UserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired access token',
    });
  }
};
