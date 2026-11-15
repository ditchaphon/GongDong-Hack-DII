import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { AppError } from '../types';

export function errorHandler(
  err: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof MulterError || err.name === 'MulterError') {
    const multerErr = err as MulterError;
    const isTooLarge = multerErr.code === 'LIMIT_FILE_SIZE';
    const statusCode = isTooLarge ? 413 : 400;
    const errorCode = isTooLarge ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD';
    const message = isTooLarge
      ? 'ขนาดไฟล์ต้องไม่เกิน 5 MB'
      : multerErr.message || 'ไม่สามารถอัปโหลดไฟล์ได้';

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message,
        details: null,
      },
    });
    return;
  }

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
