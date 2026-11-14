import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/auth';
import { MAX_UPLOAD_BYTES, uploadImage } from '../services/uploadService';
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
