import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/auth';
import { MAX_UPLOAD_BYTES, deleteUploadedImage, uploadImage } from '../services/uploadService';
import { getUserIdFromRequest } from '../utils/requestUser';

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
});

uploadRouter.use(authMiddleware);

/**
 * POST /api/upload
 * อัปโหลดรูปภาพไปยัง Supabase Storage (book-listings, avatars, order-receives, slips, disputes)
 */
uploadRouter.post(
  '/',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const bucket = String(
        req.body?.bucket || req.query?.bucket || 'book-listings'
      );

      const fileInput = req.file
        ? {
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname,
            size: req.file.size,
          }
        : undefined;

      const result = await uploadImage(userId, bucket, fileInput);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/upload
 * ลบไฟล์รูปภาพที่ยังไม่ได้ผูกกับข้อมูลในฐานข้อมูลออกจาก Supabase Storage
 */
uploadRouter.delete(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const url =
        typeof req.body?.url === 'string'
          ? req.body.url
          : typeof req.query?.url === 'string'
            ? req.query.url
            : undefined;
      const bucket =
        typeof req.body?.bucket === 'string'
          ? req.body.bucket
          : typeof req.query?.bucket === 'string'
            ? req.query.bucket
            : undefined;
      const path =
        typeof req.body?.path === 'string'
          ? req.body.path
          : typeof req.query?.path === 'string'
            ? req.query.path
            : undefined;

      const result = await deleteUploadedImage(userId, { url, bucket, path });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);
