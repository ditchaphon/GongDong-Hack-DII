import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  createUserAddress,
  deleteUserAddress,
  getUserAddresses,
  updateUserAddress,
} from '../services/addressService';
import { getUserBookListings } from '../services/bookService';
import { getUserOrders } from '../services/orderService';
import { getUserReviews } from '../services/reviewService';
import {
  getCreditLedger,
  getTopupPaymentQr,
  getUserProfile,
  processTopupSlip,
  updateUserProfile,
} from '../services/userService';
import { getUserIdFromRequest } from '../utils/requestUser';

export const userRouter = Router();

// ใช้งาน Auth Middleware สำหรับทุก Route ภายใต้ /me (ต้องประกาศก่อน /:id/reviews เพื่อไม่ให้ /me/reviews ทะลุ Auth)
userRouter.use('/me', authMiddleware);

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
 * GET /api/users/me/topup-qr
 * สร้าง PromptPay QR สำหรับเติมเครดิตเข้าบัญชีกองดอง (ระบุ ?pack_id=starter|bookworm|merchant หรือ ?amount=20|50|100)
 */
userRouter.get(
  '/me/topup-qr',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const packId = req.query.pack_id ? String(req.query.pack_id) : undefined;
      const amount = req.query.amount !== undefined ? Number(req.query.amount) : undefined;

      const qr = await getTopupPaymentQr({ packId, amount });

      res.status(200).json({
        success: true,
        data: {
          pack_id: qr.packId,
          credits: qr.credits,
          amount: qr.amount,
          recipient_label: qr.recipientLabel,
          qr_data_url: qr.qrDataUrl,
          payload: qr.payload,
        },
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

/**
 * GET /api/users/me/credits/history
 * ดูประวัติธุรกรรมเครดิตของผู้ใช้ (Credit Ledger)
 */
userRouter.get(
  '/me/credits/history',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const result = await getCreditLedger(userId, limit, offset);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/me/addresses
 * ดึงสมุดที่อยู่จัดส่งของผู้ใช้ (PDPA v4 - ไม่เก็บเบอร์โทร)
 */
userRouter.get(
  '/me/addresses',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const addresses = await getUserAddresses(userId);
      res.status(200).json({ success: true, data: addresses });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/users/me/addresses
 * เพิ่มที่อยู่จัดส่งใหม่
 */
userRouter.post(
  '/me/addresses',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const created = await createUserAddress(userId, req.body);
      res.status(201).json({
        success: true,
        data: created,
        message: 'เพิ่มที่อยู่จัดส่งสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/users/me/addresses/:id
 * แก้ไขที่อยู่จัดส่งหรือตั้งเป็นค่าเริ่มต้น
 */
userRouter.patch(
  '/me/addresses/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const id = String(req.params.id);
      const updated = await updateUserAddress(userId, id, req.body);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'อัปเดตที่อยู่จัดส่งสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/users/me/addresses/:id
 * ลบที่อยู่จัดส่ง
 */
userRouter.delete(
  '/me/addresses/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const id = String(req.params.id);
      const result = await deleteUserAddress(userId, id);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/:id/reviews
 * ดูคะแนนและรีวิวของผู้ขาย (Public endpoint สำหรับผู้ซื้อดู Trust Score ก่อนตัดสินใจซื้อ; /me/reviews ผ่าน authMiddleware ด้านบนแล้ว)
 */
userRouter.get(
  '/:id/reviews',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawId = String(req.params.id);
      const userId = rawId === 'me' ? getUserIdFromRequest(req) : rawId;
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
