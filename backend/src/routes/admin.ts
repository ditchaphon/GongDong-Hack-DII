import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { authMiddleware } from '../middlewares/auth';
import {
  AdminOrderStatusFilter,
  getAdminOrders,
  resolveDisputedOrder,
} from '../services/orderService';
import { AppError } from '../types';
import {
  getAdminLineUserIdSet,
  isAdminLineUserId,
  timingSafeMatches,
} from '../utils/secretAuth';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const adminRouter = Router();

/**
 * Dual Admin Auth Middleware:
 * 1) หากแนบ x-admin-key (หรือ Bearer) ตรงกับ ADMIN_API_KEY -> ผ่านทันที (สำหรับสคริปต์/Postman)
 * 2) มิฉะนั้น ยืนยันตัวตนผ่าน LINE LIFF authMiddleware แล้วตรวจว่า lineUserId อยู่ใน ADMIN_LINE_USER_IDS
 */
export async function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const expectedApiKey = (process.env.ADMIN_API_KEY ?? env.ADMIN_API_KEY)?.trim();
  const adminIdsRaw = process.env.ADMIN_LINE_USER_IDS ?? env.ADMIN_LINE_USER_IDS;
  const hasAdminIds = getAdminLineUserIdSet(adminIdsRaw).size > 0;

  if (!expectedApiKey && !hasAdminIds) {
    next(
      new AppError(
        'ระบบผู้ดูแลยังไม่พร้อมใช้งาน (Missing ADMIN_API_KEY or ADMIN_LINE_USER_IDS)',
        503,
        'ADMIN_NOT_CONFIGURED'
      )
    );
    return;
  }

  const headerKey = req.header('x-admin-key')?.trim();
  const authHeader = req.header('authorization')?.trim();
  const bearerToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

  if (expectedApiKey && (headerKey || bearerToken)) {
    const candidate = headerKey || bearerToken;
    if (candidate && timingSafeMatches(candidate, expectedApiKey)) {
      next();
      return;
    }
    if (headerKey) {
      next(new AppError('สิทธิ์ผู้ดูแลไม่ถูกต้อง', 403, 'FORBIDDEN'));
      return;
    }
  }

  if (!hasAdminIds) {
    next(new AppError('สิทธิ์ผู้ดูแลไม่ถูกต้อง', 403, 'FORBIDDEN'));
    return;
  }

  await authMiddleware(req, res, (authErr?: unknown) => {
    if (authErr) {
      next(authErr);
      return;
    }
    const lineUserId = req.user?.lineUserId;
    if (!isAdminLineUserId(lineUserId, adminIdsRaw)) {
      next(new AppError('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ (Admin)', 403, 'FORBIDDEN'));
      return;
    }
    next();
  });
}

adminRouter.use(adminAuthMiddleware);

/**
 * GET /api/admin/orders?status=DISPUTED|RESOLVED|ALL
 * ดึงรายการคำสั่งซื้อที่มีข้อพิพาทสำหรับ Admin UI
 */
adminRouter.get(
  '/orders',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawStatus = String(req.query?.status || 'DISPUTED').toUpperCase();
      const status: AdminOrderStatusFilter =
        rawStatus === 'RESOLVED' || rawStatus === 'ALL' ? rawStatus : 'DISPUTED';

      const orders = await getAdminOrders({ status });

      res.status(200).json({
        success: true,
        data: { orders },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/orders/:id/resolve
 * แอดมินสรุปและปิดเคสข้อพิพาท (DISPUTED -> COMPLETED หรือ CANCELLED)
 */
adminRouter.post(
  '/orders/:id/resolve',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id || '');
      if (!UUID_REGEX.test(orderId)) {
        throw new AppError('รหัสคำสั่งซื้อไม่ถูกต้อง', 400, 'INVALID_ORDER_ID');
      }

      const resolution = String(req.body?.resolution || '').toUpperCase();
      const adminNote = String(req.body?.adminNote ?? req.body?.admin_note ?? '');
      const refundCredit = Boolean(req.body?.refundCredit ?? req.body?.refund_credit ?? false);
      const incrementBuyerNoShow = Boolean(
        req.body?.incrementBuyerNoShow ?? req.body?.increment_buyer_no_show ?? false
      );

      if (resolution !== 'COMPLETED' && resolution !== 'CANCELLED') {
        throw new AppError(
          'ค่า resolution ต้องเป็น COMPLETED หรือ CANCELLED เท่านั้น',
          400,
          'INVALID_RESOLUTION'
        );
      }

      const result = await resolveDisputedOrder(orderId, {
        resolution,
        adminNote,
        refundCredit,
        incrementBuyerNoShow,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: `ปิดเคสข้อพิพาทเป็น ${result.status} เรียบร้อยแล้ว`,
      });
    } catch (error) {
      next(error);
    }
  }
);
