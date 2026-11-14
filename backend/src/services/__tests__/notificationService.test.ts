import { describe, expect, it, vi } from 'vitest';
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../notificationService';

describe('notificationService', () => {
  it('สร้างและดึงรายการแจ้งเตือนพร้อมนับ unreadCount', async () => {
    const mockPrisma = {
      notification: {
        create: vi.fn().mockResolvedValue({
          id: 'notif-1',
          userId: 'usr-1',
          role: 'SELLER',
          type: 'ORDER',
          title: 'มีคำสั่งซื้อใหม่',
          message: 'ออเดอร์ใหม่',
          linkUrl: '/seller/orders/ord-1',
          isRead: false,
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([{ id: 'notif-1', isRead: false }]),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    const created = await createNotification(
      {
        userId: 'usr-1',
        role: 'SELLER',
        type: 'ORDER',
        title: 'มีคำสั่งซื้อใหม่',
        message: 'ออเดอร์ใหม่',
      },
      mockPrisma
    );
    expect(created?.id).toBe('notif-1');

    const list = await listNotifications('usr-1', 'SELLER', 20, mockPrisma);
    expect(list.unreadCount).toBe(1);
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'usr-1', role: 'SELLER' },
      })
    );
  });

  it('ตรวจสิทธิ์เจ้าของก่อน markNotificationRead และรองรับ markAllNotificationsRead', async () => {
    const mockPrisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({ id: 'notif-1', userId: 'other-usr' }),
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
    };

    await expect(markNotificationRead('usr-1', 'notif-1', mockPrisma)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    const res = await markAllNotificationsRead('usr-1', 'BUYER', mockPrisma);
    expect(res.updatedCount).toBe(3);
  });
});
