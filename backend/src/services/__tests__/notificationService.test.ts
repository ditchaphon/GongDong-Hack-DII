import { describe, expect, it, vi } from 'vitest';
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../notificationService';
import {
  handleLineWebhookEvents,
  notifyOrderEvent,
} from '../lineNotifyService';

describe('notificationService & lineNotifyService', () => {
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

  it('notifyOrderEvent ดึง lineUserId จาก DB อัตโนมัติเมื่อไม่ได้ส่ง recipientLineUserId มาให้ และส่ง LINE Flex Card', async () => {
    const mockPushClient = {
      pushMessage: vi.fn().mockResolvedValue({}),
    };
    const mockPrisma = {
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notif-2' }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          lineUserId: 'U1234567890abcdef1234567890abcdef',
        }),
      },
    };

    const result = await notifyOrderEvent(
      {
        recipientUserId: 'seller-uuid-1',
        role: 'SELLER',
        orderId: '11111111-2222-3333-4444-555555555555',
        title: 'มีคำขอสั่งซื้อหนังสือใหม่',
        message: 'มีผู้สนใจสั่งซื้อหนังสือจำนวน 1 เล่ม (฿120)',
        badgeText: 'NEW ORDER REQUEST',
      },
      mockPrisma,
      mockPushClient
    );

    expect(result.pushed).toBe(true);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'seller-uuid-1' },
      select: { lineUserId: true, lastActiveAt: true },
    });
    expect(mockPushClient.pushMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'U1234567890abcdef1234567890abcdef',
        messages: [
          expect.objectContaining({
            type: 'flex',
            altText: 'มีคำขอสั่งซื้อหนังสือใหม่: มีผู้สนใจสั่งซื้อหนังสือจำนวน 1 เล่ม (฿120)',
          }),
        ],
      })
    );
  });

  it('handleLineWebhookEvents กัน webhookEventId ซ้ำ (Deduplication) และไม่ล้มทั้ง batch เมื่อบาง event error', async () => {
    const replyClient = {
      replyMessage: vi.fn().mockResolvedValue({}),
    };
    const mockPrisma = {
      user: {
        findUnique: vi
          .fn()
          .mockRejectedValueOnce(new Error('DB transient error'))
          .mockResolvedValue({ id: 'usr-1' }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notif-follow' }),
      },
    };

    const events: any[] = [
      {
        type: 'follow',
        webhookEventId: 'evt-err-1',
        replyToken: 'tok-1',
        source: { type: 'user', userId: 'U_ERR' },
      },
      {
        type: 'follow',
        webhookEventId: 'evt-ok-2',
        replyToken: 'tok-2',
        source: { type: 'user', userId: 'U_OK' },
      },
      {
        type: 'follow',
        webhookEventId: 'evt-ok-2', // ซ้ำกับตัวก่อนหน้า
        replyToken: 'tok-2-dup',
        source: { type: 'user', userId: 'U_OK' },
      },
    ];

    const res = await handleLineWebhookEvents(events as any, mockPrisma, replyClient);
    expect(res.processed).toBe(1);
    expect(res.skippedDuplicates).toBe(1);
    expect(replyClient.replyMessage).toHaveBeenCalledTimes(1);
  });

  it('notifyOrderEvent ข้ามการยิง LINE Push เมื่อผู้รับใช้งานใน LIFF อยู่ (lastActiveAt ภายใน 2 นาที) แต่ยังบันทึก In-App Notification', async () => {
    const mockPushClient = { pushMessage: vi.fn().mockResolvedValue({}) };
    const createNotif = vi.fn().mockResolvedValue({ id: 'notif-active-1' });
    const mockPrisma = {
      notification: { create: createNotif },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          lineUserId: 'U1234567890abcdef1234567890abcdef',
          lastActiveAt: new Date(Date.now() - 30_000),
        }),
      },
    };

    const result = await notifyOrderEvent(
      {
        recipientUserId: 'seller-uuid-active',
        role: 'SELLER',
        orderId: 'ord-active-1',
        title: 'มีคำขอสั่งซื้อหนังสือใหม่',
        message: 'ออเดอร์ใหม่',
      },
      mockPrisma,
      mockPushClient
    );

    expect(createNotif).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pushed: false, reason: 'USER_ACTIVE_IN_LIFF' });
    expect(mockPushClient.pushMessage).not.toHaveBeenCalled();
  });

  it('notifyOrderEvent ข้ามการยิง LINE Push เมื่อกำหนด pushLine: false แต่ยังบันทึก In-App Notification', async () => {
    const mockPushClient = { pushMessage: vi.fn().mockResolvedValue({}) };
    const createNotif = vi.fn().mockResolvedValue({ id: 'notif-inapp-only' });
    const findUser = vi.fn();
    const mockPrisma = {
      notification: { create: createNotif },
      user: { findUnique: findUser },
    };

    const result = await notifyOrderEvent(
      {
        recipientUserId: 'buyer-uuid-1',
        role: 'BUYER',
        orderId: 'ord-inapp-1',
        title: 'คำสั่งซื้อเสร็จสมบูรณ์',
        message: 'ขอบคุณที่ใช้บริการ',
        pushLine: false,
      },
      mockPrisma,
      mockPushClient
    );

    expect(createNotif).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pushed: false, reason: 'LINE_PUSH_DISABLED' });
    expect(findUser).not.toHaveBeenCalled();
    expect(mockPushClient.pushMessage).not.toHaveBeenCalled();
  });
});
