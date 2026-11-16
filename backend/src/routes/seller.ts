import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  addMeetupPoint,
  deleteMeetupPoint,
  getMyShop,
  getPublicShop,
  submitSellerKyc,
  upsertMyShop,
} from '../services/shopService';
import { AppError } from '../types';
import { getUserIdFromRequest } from '../utils/requestUser';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const sellerRouter = Router();
export const shopRouter = Router();

sellerRouter.use(authMiddleware);

/**
 * GET /api/seller/shop
 * ดูโปรไฟล์ร้านค้าและจุดนัดรับของตนเอง
 */
sellerRouter.get(
  '/shop',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const shop = await getMyShop(userId);
      res.status(200).json({ success: true, data: shop });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/seller/shop
 * สร้างหรืออัปเดตโปรไฟล์ร้านค้า
 */
sellerRouter.put(
  '/shop',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const shop = await upsertMyShop(userId, req.body);
      res.status(200).json({
        success: true,
        data: shop,
        message: 'บันทึกข้อมูลร้านค้าสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/seller/meetup-points
 * เพิ่มจุดนัดรับของร้านค้า
 */
sellerRouter.post(
  '/meetup-points',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const point = await addMeetupPoint(userId, req.body);
      res.status(201).json({
        success: true,
        data: point,
        message: 'เพิ่มจุดนัดรับสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/seller/meetup-points/:pointId
 * ลบจุดนัดรับของร้านค้า
 */
sellerRouter.delete(
  '/meetup-points/:pointId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const pointId = String(req.params.pointId);
      if (!UUID_REGEX.test(pointId)) {
        throw new AppError('ไม่พบจุดนัดรับที่ระบุ', 404, 'MEETUP_POINT_NOT_FOUND');
      }
      const result = await deleteMeetupPoint(userId, pointId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/seller/kyc
 * ยืนยันตัวตนผู้ขายสำหรับจัดส่งพัสดุ (Selective KYC - เก็บเลขบัตรประชาชนแบบ Masked เท่านั้น)
 */
sellerRouter.post(
  '/kyc',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const result = await submitSellerKyc(userId, {
        firstName: req.body?.firstName,
        lastName: req.body?.lastName,
        nationalId: req.body?.nationalId,
        pdpaConsent:
          req.body?.pdpaConsent ?? req.body?.pdpa_consent,
      });
      res.status(200).json({
        success: true,
        data: result,
        message: 'ยืนยันตัวตนผู้ขายสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/shops/:id
 * ดูหน้าร้านค้าสาธารณะพร้อมจุดนัดรับและรายการหนังสือที่เปิดขายอยู่
 */
shopRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      if (!UUID_REGEX.test(id)) {
        throw new AppError('ไม่พบร้านค้าที่ระบุ', 404, 'SHOP_NOT_FOUND');
      }
      const shop = await getPublicShop(id);
      res.status(200).json({ success: true, data: shop });
    } catch (error) {
      next(error);
    }
  }
);
