import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { expireStaleOrders } from '../services/orderService';
import { requireSecretMiddleware } from '../utils/secretAuth';

export const cronRouter = Router();

cronRouter.use(
  requireSecretMiddleware({
    getExpectedSecret: () => env.CRON_SECRET,
    headerName: 'x-cron-secret',
    missingCode: 'CRON_NOT_CONFIGURED',
    missingMessage: 'ระบบตั้งเวลาอัตโนมัติยังไม่พร้อมใช้งาน (Missing CRON_SECRET)',
    invalidMessage: 'รหัสยืนยัน Cron ไม่ถูกต้อง',
  })
);

async function handleExpireOrders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await expireStaleOrders();
    res.status(200).json({
      success: true,
      data: result,
      message: 'ตรวจสอบและอัปเดตสถานะออเดอร์หมดอายุเรียบร้อยแล้ว',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET / POST /api/cron/orders/expire
 * กวาดออเดอร์ REQUESTED เกิน 24 ชม. -> EXPIRED และ SHIPPED เกิน 7 วัน -> COMPLETED
 */
cronRouter.get('/orders/expire', handleExpireOrders);
cronRouter.post('/orders/expire', handleExpireOrders);
