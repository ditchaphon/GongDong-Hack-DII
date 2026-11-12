import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getUserBookListings } from '../services/bookService';
import { getUserOrders } from '../services/orderService';
import { getUserReviews } from '../services/reviewService';
import {
  getUserProfile,
  processTopupSlip,
  updateUserProfile,
} from '../services/userService';
import { AppError } from '../types';

export const userRouter = Router();

/**
 * GET /api/users/:id/reviews
 * ดูคะแนนและรีวิวของผู้ขาย (Public endpoint สำหรับผู้ซื้อดู Trust Score ก่อนตัดสินใจซื้อ)
 */
userRouter.get(
  '/:id/reviews',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = String(req.params.id);
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

      const result = await getUserReviews(userId, { limit, offset });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ใช้งาน Auth Middleware สำหรับทุก Route ภายใต้ /me
userRouter.use('/me', authMiddleware);

function getUserIdFromRequest(req: Request): string {
  const userId =
    req.userId ||
    ((req as any).user?.id as string) ||
    (req.headers['x-user-id'] as string);

  if (!userId) {
    throw new AppError('กรุณาเข้าสู่ระบบก่อนดำเนินการ (Unauthorized)', 401, 'UNAUTHORIZED');
  }

  return userId;
}

/**
 * GET /api/users/me
 * ดูข้อมูลโปรไฟล์ ยอดเครดิต และสถานะ KYC ของตนเอง
 */
userRouter.get(
  '/me',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const profile = await getUserProfile(userId);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/users/me
 * บันทึกหรือแก้ไขข้อมูลส่วนตัว (ชื่อเล่นในกองดอง, รูปตัวแทน Avatar, เบอร์โทร, พร้อมเพย์)
 */
userRouter.patch(
  '/me',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const updated = await updateUserProfile(userId, req.body);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'บันทึกข้อมูลส่วนตัวสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/users/me/topup-slip
 * แนบสลิปเติมเครดิต ➔ เพิ่มเครดิตและปลดล็อกเป็นผู้ขายยืนยันตัวตน (is_verified_seller = true)
 */
userRouter.post(
  '/me/topup-slip',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const result = await processTopupSlip(userId, req.body);

      res.status(200).json({
        success: true,
        data: result,
        message: 'เติมเครดิตและยืนยันบัญชีรับเงินสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/me/books
 * ดูรายการหนังสือที่ตนเองลงขายไว้ (หน้าจอ S4 ร้านของฉัน)
 */
userRouter.get(
  '/me/books',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sellerId = getUserIdFromRequest(req);
      const result = await getUserBookListings(sellerId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/me/orders
 * ดูประวัติคำสั่งซื้อของฉัน (ทั้งฝั่งซื้อและฝั่งขาย)
 */
userRouter.get(
  '/me/orders',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const role = req.query.role as 'buying' | 'selling' | undefined;

      const result = await getUserOrders(userId, role);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);
