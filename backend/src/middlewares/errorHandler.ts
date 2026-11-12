import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

export function errorHandler(
  err: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const customErr = err as AppError;
  const statusCode = customErr.statusCode || 500;
  const errorCode = customErr.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';
  const details = customErr.details || null;

  console.error(`[Error] ${errorCode} (${statusCode}): ${message}`, details || '');

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details: process.env.NODE_ENV === 'development' ? details : null,
    },
  });
}
