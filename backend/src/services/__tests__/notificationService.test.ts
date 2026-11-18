import { describe, expect, it, vi } from 'vitest';
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../notificationService';
import {
  buildOrderFlexMessage,
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

  it('buildOrderFlexMessage ปรับสี header, ป้ายบทบาท และข้อความปุ่ม CTA ตาม badgeText ของสถานะ', () => {
    const newOrderFlex = buildOrderFlexMessage({
      title: 'มีคำขอสั่งซื้อหนังสือใหม่',
      message: 'จำนวน 1 เล่ม (฿180)',
      orderId: 'abcdef12-3456-7890-abcd-ef1234567890',
      badgeText: 'NEW ORDER REQUEST',
      role: 'SELLER',
      linkUrl: 'https://liff.line.me/demo/orders/abcdef12',
    });

    const newBubble = newOrderFlex.contents as any;
    expect(newBubble.header.backgroundColor).toBe('#8B5E3C');
    expect(JSON.stringify(newBubble.header)).toContain('สำหรับผู้ขาย');
    expect(newBubble.footer.contents[0].color).toBe('#8B5E3C');
    expect(newBubble.footer.contents[0].action.label).toBe('ดูคำขอและตอบรับ');

    const shippedFlex = buildOrderFlexMessage({
      title: 'พัสดุถูกจัดส่งแล้ว!',
      message: 'Flash Express เลขพัสดุ TH123456',
      orderId: '12345678-0000-0000-0000-000000000000',
      badgeText: 'SHIPPED',
      role: 'BUYER',
      linkUrl: 'https://liff.line.me/demo/orders/12345678',
    });

    const shippedBubble = shippedFlex.contents as any;
    expect(shippedBubble.header.backgroundColor).toBe('#0369A1');
    expect(JSON.stringify(shippedBubble.header)).toContain('สำหรับผู้ซื้อ');
    expect(shippedBubble.footer.contents[0].action.label).toBe('ดูเลขพัสดุและติดตาม');

    const disputeFlex = buildOrderFlexMessage({
      title: 'คำสั่งซื้อถูกเปิดข้อพิพาท',
      message: 'เหตุผล: สภาพไม่ตรงปก',
      orderId: 'deadbeef-0000-0000-0000-000000000000',
      badgeText: 'DISPUTED',
      role: 'SELLER',
      linkUrl: 'https://liff.line.me/demo/orders/deadbeef',
    });

    const disputeBubble = disputeFlex.contents as any;
    expect(disputeBubble.header.backgroundColor).toBe('#B91C1C');
    expect(disputeBubble.footer.contents[0].color).toBe('#DC2626');

    const reviewPromptFlex = buildOrderFlexMessage({
      title: 'นัดรับหนังสือสำเร็จ!',
      message: 'ผู้ขายยืนยันรหัสส่งมอบ 6 หลักเรียบร้อยแล้ว อย่าลืมให้คะแนนร้านค้านะครับ',
      orderId: '11111111-2222-3333-4444-555555555555',
      badgeText: 'MEETUP COMPLETED',
      role: 'BUYER',
      linkUrl: 'https://liff.line.me/demo/orders/11111111/review',
    });

    const reviewPromptBubble = reviewPromptFlex.contents as any;
    expect(reviewPromptBubble.header.backgroundColor).toBe('#15803D');
    expect(JSON.stringify(reviewPromptBubble.header)).toContain('⭐ นัดรับสำเร็จ · อย่าลืมรีวิว');
    expect(reviewPromptBubble.footer.contents[0].action.label).toBe('ให้คะแนนและรีวิวร้าน');
    expect(reviewPromptBubble.footer.contents[0].action.uri).toBe(
      'https://liff.line.me/demo/orders/11111111/review'
    );
  });

  it('notifyOrderEvent บังคับยิง LINE Push เมื่อ forcePushLine: true แม้ผู้รับกำลังใช้งานใน LIFF อยู่ (lastActiveAt ภายใน 2 นาที)', async () => {
    const mockPushClient = { pushMessage: vi.fn().mockResolvedValue({}) };
    const createNotif = vi.fn().mockResolvedValue({ id: 'notif-force-1' });
    const mockPrisma = {
      notification: { create: createNotif },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          lineUserId: 'U1234567890abcdef1234567890abcdef',
          lastActiveAt: new Date(Date.now() - 15_000),
        }),
      },
    };

    const result = await notifyOrderEvent(
      {
        recipientUserId: 'seller-uuid-force',
        role: 'SELLER',
        orderId: 'ord-force-1',
        title: 'มีคำขอสั่งซื้อหนังสือใหม่',
        message: 'ออเดอร์ใหม่',
        badgeText: 'NEW ORDER REQUEST',
        forcePushLine: true,
      },
      mockPrisma,
      mockPushClient
    );

    expect(createNotif).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pushed: true, reason: undefined });
    expect(mockPushClient.pushMessage).toHaveBeenCalledTimes(1);
  });
});
