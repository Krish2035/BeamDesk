import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Validation failed',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      message: err.message,
    });
    return;
  }

  logger.error('Unhandled server error:', { message: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    message: err.message || 'Internal server error',
  });
};

