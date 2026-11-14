import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationRole,
} from '../services/notificationService';
import { getUserIdFromRequest } from '../utils/requestUser';

export const notificationRouter = Router();

notificationRouter.use(authMiddleware);

/**
 * GET /api/notifications
 * ดึงการแจ้งเตือนของผู้ใช้ (รองรับ ?role=BUYER|SELLER&limit=30)
 */
notificationRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const role = req.query.role
        ? (String(req.query.role).toUpperCase() as NotificationRole)
        : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 30;

      const result = await listNotifications(userId, role, limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/notifications/read-all
 * ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
 */
notificationRouter.patch(
  '/read-all',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const role = req.query.role
        ? (String(req.query.role).toUpperCase() as NotificationRole)
        : undefined;

      const result = await markAllNotificationsRead(userId, role);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/notifications/:id/read
 * ทำเครื่องหมายว่าอ่านแล้ว 1 รายการ
 */
notificationRouter.patch(
  '/:id/read',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const id = String(req.params.id);

      const updated = await markNotificationRead(userId, id);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);
