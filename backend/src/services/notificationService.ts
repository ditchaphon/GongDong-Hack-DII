import { prisma } from '../config/prisma';
import { AppError } from '../types';

export type NotificationRole = 'BUYER' | 'SELLER';
export type NotificationType = 'ORDER' | 'WISHLIST' | 'SYSTEM' | 'CREDIT';

export interface CreateNotificationInput {
  userId: string;
  role?: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  role: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * สร้างการแจ้งเตือนในระบบ (In-App Notification)
 */
export async function createNotification(
  input: CreateNotificationInput,
  prismaClient: any = prisma
): Promise<NotificationItem | null> {
  if (!prismaClient?.notification?.create) {
    return null;
  }

  return prismaClient.notification.create({
    data: {
      userId: input.userId,
      role: input.role || 'BUYER',
      type: input.type,
      title: input.title,
      message: input.message,
      linkUrl: input.linkUrl ?? null,
    },
  });
}

/**
 * ดึงรายการแจ้งเตือนของผู้ใช้ (รองรับกรองตาม Role BUYER/SELLER)
 */
export async function listNotifications(
  userId: string,
  role?: NotificationRole,
  limit = 30,
  prismaClient: any = prisma
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const where: any = { userId };
  if (role) {
    where.role = role;
  }

  const [items, unreadCount] = await Promise.all([
    prismaClient.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    }),
    prismaClient.notification.count({
      where: { ...where, isRead: false },
    }),
  ]);

  return { items, unreadCount };
}

/**
 * ทำเครื่องหมายว่าอ่านแล้วสำหรับการแจ้งเตือน 1 รายการ
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
  prismaClient: any = prisma
): Promise<NotificationItem> {
  const existing = await prismaClient.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    throw new AppError('ไม่พบการแจ้งเตือนที่ระบุ', 404, 'NOTIFICATION_NOT_FOUND');
  }

  if (existing.userId !== userId) {
    throw new AppError('คุณไม่มีสิทธิ์แก้ไขการแจ้งเตือนนี้', 403, 'FORBIDDEN');
  }

  return prismaClient.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

/**
 * ทำเครื่องหมายว่าอ่านแล้วทั้งหมดของผู้ใช้ (กรองตาม role ได้)
 */
export async function markAllNotificationsRead(
  userId: string,
  role?: NotificationRole,
  prismaClient: any = prisma
): Promise<{ updatedCount: number }> {
  const where: any = { userId, isRead: false };
  if (role) {
    where.role = role;
  }

  const result = await prismaClient.notification.updateMany({
    where,
    data: { isRead: true },
  });

  return { updatedCount: result.count || 0 };
}
