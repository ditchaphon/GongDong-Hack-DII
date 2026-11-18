import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  acceptOrder,
  cancelOrder,
  clearHandoverAttemptsForTest,
  clearUserMaintenanceCooldownForTest,
  createBatchOrders,
  createOrder,
  expireStaleOrders,
  generateHandoverCode,
  getAdminOrders,
  getUserOrders,
  openDispute,
  resolveDisputedOrder,
  schedulePickupOrder,
  verifyHandoverCode,
} from '../orderService';
import { AppError } from '../../types';

describe('OrderService - State Machine & Core Transactions', () => {
  describe('generateHandoverCode', () => {
    it('ควรสร้างรหัสตัวเลข 6 หลักแบบสุ่มอย่างถูกต้อง', () => {
      const code = generateHandoverCode();
      expect(code).toBeDefined();
      expect(code.length).toBe(6);
      expect(/^\d{6}$/.test(code)).toBe(true);

      const code2 = generateHandoverCode();
      expect(/^\d{6}$/.test(code2)).toBe(true);
    });
  });

  describe('acceptOrder Transaction (ACID Acceptance)', () => {
    const mockSellerId = 'usr_seller_123';
    const mockOrderId = 'ord_test_001';
    const mockBookId = 'bok_item_001';

    const baseOrder = {
      id: mockOrderId,
      sellerId: mockSellerId,
      buyerId: 'usr_buyer_999',
      status: 'REQUESTED',
      shippingMethod: 'PICKUP',
      seller: {
        id: mockSellerId,
        isVerifiedSeller: true,
        credits: 3,
      },
      orderItems: [
        {
          id: 'item_1',
          orderId: mockOrderId,
          bookListingId: mockBookId,
          bookListing: {
            id: mockBookId,
            status: 'AVAILABLE',
          },
        },
      ],
    };

    let mockTx: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockTx = {
        order: {
          findUnique: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
        user: {
          update: vi.fn(),
        },
        creditTransaction: {
          create: vi.fn(),
        },
        bookListing: {
          updateMany: vi.fn(),
        },
        orderItem: {
          findMany: vi.fn(),
        },
      };

      mockPrisma = {
        $transaction: vi.fn(async (callback: any) => await callback(mockTx)),
      };
    });

    it('กรณีสำเร็จ: ต้องหัก 1 เครดิต, ล็อกหนังสือเป็น RESERVED, ตัดคำขออื่นเป็น REJECTED, และเปลี่ยนสถานะเป็น ACCEPTED', async () => {
      mockTx.order.findUnique.mockResolvedValue(baseOrder);
      mockTx.user.update.mockResolvedValue({ id: mockSellerId, credits: 2 });
      mockTx.bookListing.updateMany.mockResolvedValue({ count: 1 });
      mockTx.orderItem.findMany.mockResolvedValue([
        { orderId: 'ord_competing_888', order: { buyerId: 'usr_competing_buyer' } },
      ]);

      const result = await acceptOrder(mockOrderId, mockSellerId, mockPrisma);

      // 1. ตรวจสอบการหักเครดิตผู้ขาย -1
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: mockSellerId },
        data: { credits: { decrement: 1 } },
        select: { credits: true },
      });

      // 2. ตรวจสอบการบันทึก Audit Trail
      expect(mockTx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockSellerId,
          amount: -1,
          balanceAfter: 2,
          type: 'ORDER_ACCEPT',
          orderId: mockOrderId,
        }),
      });

      // 3. ตรวจสอบการล็อกสต็อกหนังสือเป็น RESERVED แบบมีเงื่อนไข status = AVAILABLE
      expect(mockTx.bookListing.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [mockBookId] }, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });

      // 4. ตรวจสอบการตัดคำขอซื้ออื่นที่ค้าง REQUESTED ให้เป็น REJECTED
      expect(mockTx.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['ord_competing_888'] },
          status: 'REQUESTED',
        },
        data: { status: 'REJECTED' },
      });

      // 5. ตรวจสอบการปรับสถานะออเดอร์นี้เป็น ACCEPTED
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { status: 'ACCEPTED' },
      });

      expect(result).toEqual({
        orderId: mockOrderId,
        status: 'ACCEPTED',
        remainingCredits: 2,
        lockedBookIds: [mockBookId],
        rejectedOrderIds: ['ord_competing_888'],
      });
    });

    it('ต้องปฏิเสธด้วย 409 BOOK_NOT_AVAILABLE หากหนังสือถูกจองไปก่อนหน้าในเสี้ยววินาที (Conditional updateMany count ไม่ครบ)', async () => {
      mockTx.order.findUnique.mockResolvedValue(baseOrder);
      mockTx.user.update.mockResolvedValue({ id: mockSellerId, credits: 2 });
      mockTx.bookListing.updateMany.mockResolvedValue({ count: 0 });

      await expect(acceptOrder(mockOrderId, mockSellerId, mockPrisma)).rejects.toMatchObject({
        statusCode: 409,
        code: 'BOOK_NOT_AVAILABLE',
      });
    });

    it('ต้องปฏิเสธหากไม่พบคำสั่งซื้อ (ORDER_NOT_FOUND)', async () => {
      mockTx.order.findUnique.mockResolvedValue(null);

      await expect(acceptOrder('ord_missing', mockSellerId, mockPrisma)).rejects.toThrow(
        'ไม่พบคำสั่งซื้อที่ระบุ'
      );
    });

    it('ต้องปฏิเสธหากผู้ที่กดยอมรับไม่ใช่ผู้ขายของออเดอร์นี้ (FORBIDDEN)', async () => {
      mockTx.order.findUnique.mockResolvedValue(baseOrder);

      await expect(acceptOrder(mockOrderId, 'usr_impostor', mockPrisma)).rejects.toThrow(
        'คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้'
      );
    });

    it('ต้องปฏิเสธหากออเดอร์ไม่ได้อยู่ในสถานะ REQUESTED (INVALID_ORDER_STATUS)', async () => {
      mockTx.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: 'ACCEPTED',
      });

      await expect(acceptOrder(mockOrderId, mockSellerId, mockPrisma)).rejects.toThrow(
        'ไม่สามารถรับออเดอร์นี้ได้เนื่องจากสถานะปัจจุบันคือ ACCEPTED'
      );
    });

    it('ต้องปฏิเสธออเดอร์จัดส่งพัสดุ (DELIVERY) หากผู้ขายยังไม่ผ่าน KYC (SELLER_NOT_VERIFIED)', async () => {
      mockTx.order.findUnique.mockResolvedValue({
        ...baseOrder,
        shippingMethod: 'DELIVERY',
        seller: {
          ...baseOrder.seller,
          isVerifiedSeller: false,
        },
      });

      await expect(acceptOrder(mockOrderId, mockSellerId, mockPrisma)).rejects.toThrow(
        'การจัดส่งพัสดุจำเป็นต้องยืนยันตัวตนผู้ขาย (KYC) ก่อนรับคำสั่งซื้อ'
      );
    });

    it('ต้องยอมรับออเดอร์นัดรับ (PICKUP) ได้แม้ผู้ขายยังไม่ผ่าน KYC (Selective KYC)', async () => {
      mockTx.order.findUnique.mockResolvedValue({
        ...baseOrder,
        shippingMethod: 'PICKUP',
        seller: {
          ...baseOrder.seller,
          isVerifiedSeller: false,
          credits: 2,
        },
      });
      mockTx.user.update.mockResolvedValue({ id: mockSellerId, credits: 1 });
      mockTx.orderItem.findMany.mockResolvedValue([]);

      const result = await acceptOrder(mockOrderId, mockSellerId, mockPrisma);
      expect(result.status).toBe('ACCEPTED');
      expect(result.remainingCredits).toBe(1);
    });

    it('ต้องปฏิเสธหากเครดิตผู้ขายไม่พอ (INSUFFICIENT_CREDITS)', async () => {
      mockTx.order.findUnique.mockResolvedValue({
        ...baseOrder,
        seller: {
          ...baseOrder.seller,
          credits: 0,
        },
      });

      await expect(acceptOrder(mockOrderId, mockSellerId, mockPrisma)).rejects.toThrow(
        'เครดิตไม่เพียงพอสำหรับการรับคำสั่งซื้อ'
      );
    });

    it('ต้องปฏิเสธหากหนังสือในออเดอร์ถูกจองหรือขายไปแล้ว (BOOK_NOT_AVAILABLE)', async () => {
      mockTx.order.findUnique.mockResolvedValue({
        ...baseOrder,
        orderItems: [
          {
            id: 'item_1',
            orderId: mockOrderId,
            bookListingId: mockBookId,
            bookListing: {
              id: mockBookId,
              status: 'RESERVED',
            },
          },
        ],
      });

      await expect(acceptOrder(mockOrderId, mockSellerId, mockPrisma)).rejects.toThrow(
        'หนังสือในคำสั่งซื้อนี้ถูกจองหรือขายไปแล้ว'
      );
    });
  });

  describe('schedulePickupOrder (Schedule Meeting & Issue 6-Digit Code)', () => {
    const mockOrderId = 'ord_pickup_01';
    const mockBuyerId = 'usr_buyer_1';
    const mockSellerId = 'usr_seller_1';

    const basePickupOrder = {
      id: mockOrderId,
      buyerId: mockBuyerId,
      sellerId: mockSellerId,
      shippingMethod: 'PICKUP',
      status: 'ACCEPTED',
      handoverCode: null,
    };

    it('กรณีสำเร็จ: ตกลงนัดหมายสำเร็จ เปลี่ยนเป็น SCHEDULED และออกรหัส 6 หลักให้ผู้ซื้อ', async () => {
      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(basePickupOrder),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const input = {
        scheduledAt: futureIso,
        pickupLat: 18.7953214,
        pickupLng: 98.9527312,
        pickupLocationName: 'หน้าหอสมุดกลาง มช.',
      };

      const result = await schedulePickupOrder(mockOrderId, mockBuyerId, input, mockDb);

      expect(result.status).toBe('SCHEDULED');
      expect(result.handoverCode).toBeDefined();
      expect(result.handoverCode.length).toBe(6);

      expect(mockDb.order.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: expect.objectContaining({
          status: 'SCHEDULED',
          pickupLat: 18.7953214,
          pickupLng: 98.9527312,
          pickupLocationName: 'หน้าหอสมุดกลาง มช.',
          handoverCode: result.handoverCode,
        }),
      });
    });

    it('ต้องปฏิเสธหากผู้บันทึกไม่ใช่ทั้งผู้ซื้อและผู้ขายของออเดอร์นี้ (FORBIDDEN)', async () => {
      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(basePickupOrder),
        },
      };

      const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await expect(
        schedulePickupOrder(
          mockOrderId,
          'usr_stranger',
          { scheduledAt: futureIso, pickupLat: 18.0, pickupLng: 98.0 },
          mockDb
        )
      ).rejects.toThrow('คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้');
    });

    it('ต้องปฏิเสธหากคำสั่งซื้อไม่ใช่รูปแบบนัดรับ PICKUP (INVALID_SHIPPING_METHOD)', async () => {
      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            ...basePickupOrder,
            shippingMethod: 'DELIVERY',
          }),
        },
      };

      const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await expect(
        schedulePickupOrder(
          mockOrderId,
          mockBuyerId,
          { scheduledAt: futureIso, pickupLat: 18.0, pickupLng: 98.0 },
          mockDb
        )
      ).rejects.toThrow('คำสั่งซื้อนี้ไม่ได้ใช้วิธีนัดรับสินค้า (PICKUP)');
    });

    it('ต้องปฏิเสธหากวันเวลานัดหมายไม่ถูกต้อง (INVALID_DATE)', async () => {
      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(basePickupOrder),
        },
      };

      await expect(
        schedulePickupOrder(
          mockOrderId,
          mockBuyerId,
          { scheduledAt: 'invalid-date-string', pickupLat: 18.0, pickupLng: 98.0 },
          mockDb
        )
      ).rejects.toThrow('วันเวลานัดหมาย (scheduledAt) ไม่ถูกต้อง');
    });

    it('ต้องปฏิเสธหากตั้งเวลานัดหมายย้อนหลังในอดีต (SCHEDULE_IN_THE_PAST)', async () => {
      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(basePickupOrder),
        },
      };

      const pastIso = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      await expect(
        schedulePickupOrder(
          mockOrderId,
          mockSellerId,
          { scheduledAt: pastIso, pickupLat: 18.0, pickupLng: 98.0 },
          mockDb
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'SCHEDULE_IN_THE_PAST',
      });
    });

    it('ต้องปฏิเสธหากพิกัดนัดรับอยู่นอกขอบเขต lat/lng ที่ถูกต้อง (INVALID_COORDINATES)', async () => {
      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue(basePickupOrder),
        },
      };

      const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await expect(
        schedulePickupOrder(
          mockOrderId,
          mockSellerId,
          { scheduledAt: futureIso, pickupLat: 120.5, pickupLng: 98.0 },
          mockDb
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_COORDINATES',
      });
    });
  });

  describe('verifyHandoverCode (Handover 6-Digit Verification)', () => {
    const mockOrderId = 'ord_pickup_01';
    const mockSellerId = 'usr_seller_1';
    const mockBookId = 'bok_001';

    const scheduledOrder = {
      id: mockOrderId,
      sellerId: mockSellerId,
      buyerId: 'usr_buyer_1',
      shippingMethod: 'PICKUP',
      status: 'SCHEDULED',
      handoverCode: '482910',
      orderItems: [
        {
          id: 'item_1',
          orderId: mockOrderId,
          bookListingId: mockBookId,
        },
      ],
    };

    let mockTx: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockTx = {
        order: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        bookListing: {
          updateMany: vi.fn(),
        },
      };

      mockPrisma = {
        $transaction: vi.fn(async (callback: any) => await callback(mockTx)),
      };
    });

    it('กรณีสำเร็จ: กรอกรหัสถูกต้อง เปลี่ยนออเดอร์เป็น COMPLETED และเปลี่ยนหนังสือเป็น SOLD', async () => {
      mockTx.order.findUnique.mockResolvedValue(scheduledOrder);

      const result = await verifyHandoverCode(
        mockOrderId,
        mockSellerId,
        '482910',
        mockPrisma
      );

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { status: 'COMPLETED' },
      });

      expect(mockTx.bookListing.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [mockBookId] } },
        data: { status: 'SOLD' },
      });

      expect(result).toEqual({
        orderId: mockOrderId,
        status: 'COMPLETED',
        soldBookIds: [mockBookId],
      });
    });

    it('กรณีสำเร็จ: ต้องตัดช่องว่างรอบรหัสออกก่อนตรวจ (trim)', async () => {
      mockTx.order.findUnique.mockResolvedValue(scheduledOrder);

      const result = await verifyHandoverCode(
        mockOrderId,
        mockSellerId,
        '  482910  ',
        mockPrisma
      );

      expect(result.status).toBe('COMPLETED');
    });

    it('ต้องปฏิเสธหากกรอกรหัส 6 หลักผิดพลาด (INVALID_HANDOVER_CODE)', async () => {
      mockTx.order.findUnique.mockResolvedValue(scheduledOrder);

      await expect(
        verifyHandoverCode(mockOrderId, mockSellerId, '000000', mockPrisma)
      ).rejects.toThrow('รหัสส่งมอบ 6 หลักไม่ถูกต้อง');
    });

    it('ต้องปฏิเสธหากผู้ตรวจไม่ใช่ผู้ขายของคำสั่งซื้อนี้ (FORBIDDEN)', async () => {
      mockTx.order.findUnique.mockResolvedValue(scheduledOrder);

      await expect(
        verifyHandoverCode(mockOrderId, 'usr_stranger', '482910', mockPrisma)
      ).rejects.toThrow('คุณไม่ใช่ผู้ขายของคำสั่งซื้อนี้');
    });

    it('ต้องปฏิเสธหากออเดอร์ไม่ได้อยู่ในสถานะ SCHEDULED (INVALID_ORDER_STATUS)', async () => {
      mockTx.order.findUnique.mockResolvedValue({
        ...scheduledOrder,
        status: 'ACCEPTED',
      });

      await expect(
        verifyHandoverCode(mockOrderId, mockSellerId, '482910', mockPrisma)
      ).rejects.toThrow('ออเดอร์ต้องอยู่ในสถานะ SCHEDULED เท่านั้นเพื่อตรวจรหัสส่งมอบ');
    });

    it('Concurrency Guard: reject 409 ORDER_STATUS_CONFLICT หาก cancelOrder ชนพร้อมกันเพื่อไม่คืนเครดิตซ้ำ', async () => {
      const { cancelOrder } = await import('../orderService');
      const raceTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_race_1',
            buyerId: 'buyer-1',
            sellerId: 'seller-1',
            status: 'ACCEPTED',
            orderItems: [{ bookListingId: 'b1' }],
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update: vi.fn(),
        },
        user: { update: vi.fn() },
        bookListing: { updateMany: vi.fn() },
      };

      await expect(
        cancelOrder('ord_race_1', 'buyer-1', 'ซ้ำ', {
          $transaction: vi.fn(async (cb: any) => cb(raceTx)),
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'ORDER_STATUS_CONFLICT',
      });
      expect(raceTx.user.update).not.toHaveBeenCalled();
    });

    it('Concurrency Guard: acceptOrder ปฏิเสธ INSUFFICIENT_CREDITS เมื่อ user.updateMany เงื่อนไข credits >= 1 ไม่ผ่าน', async () => {
      const raceTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_cred_race',
            sellerId: 'usr_seller_123',
            buyerId: 'usr_buyer_999',
            status: 'REQUESTED',
            shippingMethod: 'PICKUP',
            seller: { id: 'usr_seller_123', isVerifiedSeller: true, credits: 1 },
            orderItems: [{ bookListingId: 'b1', bookListing: { id: 'b1', status: 'AVAILABLE' } }],
          }),
        },
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };

      await expect(
        acceptOrder('ord_cred_race', 'usr_seller_123', {
          $transaction: vi.fn(async (cb: any) => cb(raceTx)),
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INSUFFICIENT_CREDITS',
      });
    });
  });

  describe('Self-Purchase Guard (CANNOT_BUY_OWN_BOOK)', () => {
    it('createOrder ต้องปฏิเสธด้วย 400 CANNOT_BUY_OWN_BOOK เมื่อ buyerId === sellerId โดยไม่เปิด transaction', async () => {
      const mockPrisma = {
        $transaction: vi.fn(),
      };

      await expect(
        createOrder(
          'usr_same_001',
          {
            sellerId: 'usr_same_001',
            bookIds: ['bok_own_001'],
            shippingMethod: 'PICKUP',
          },
          mockPrisma
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CANNOT_BUY_OWN_BOOK',
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('createBatchOrders ต้องปฏิเสธทั้ง batch ด้วย 400 CANNOT_BUY_OWN_BOOK หากมีร้านของตัวเองปนอยู่', async () => {
      const mockPrisma = {
        $transaction: vi.fn(),
      };

      await expect(
        createBatchOrders(
          'usr_same_001',
          {
            orders: [
              {
                sellerId: 'usr_other_seller',
                bookIds: ['bok_other_001'],
                shippingMethod: 'PICKUP',
              },
              {
                sellerId: 'usr_same_001',
                bookIds: ['bok_own_001'],
                shippingMethod: 'PICKUP',
              },
            ],
          },
          mockPrisma
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CANNOT_BUY_OWN_BOOK',
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('createOrder ต้องปฏิเสธด้วย 400 MULTIPLE_SELLERS_IN_CART หากปลอม sellerId เป็นคนอื่นแต่ส่ง bookId ของตัวเองมา', async () => {
      const mockTx = {
        user: { findUnique: vi.fn().mockResolvedValue({ id: 'usr_same_001', phoneNumber: null }) },
        order: { count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null) },
        bookListing: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'bok_own_001',
              sellerId: 'usr_same_001',
              status: 'AVAILABLE',
              allowPickup: true,
              allowDelivery: true,
            },
          ]),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn(async (cb: any) => cb(mockTx)),
      };

      await expect(
        createOrder(
          'usr_same_001',
          {
            sellerId: 'usr_other_seller',
            bookIds: ['bok_own_001'],
            shippingMethod: 'PICKUP',
          },
          mockPrisma
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'MULTIPLE_SELLERS_IN_CART',
      });
    });
  });

  describe('P0/P1 Security & Lifecycle Hardening', () => {
    it('verifyHandoverCode ต้องล็อกชั่วคราว (429 HANDOVER_RATE_LIMITED) เมื่อกรอกรหัสผิดครบ 5 ครั้ง', async () => {
      clearHandoverAttemptsForTest();
      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_rate_1',
            sellerId: 'usr_seller_rate',
            buyerId: 'usr_buyer_rate',
            shippingMethod: 'PICKUP',
            status: 'SCHEDULED',
            handoverCode: '991122',
            orderItems: [{ bookListingId: 'bok_1' }],
          }),
        },
      };

      for (let i = 0; i < 4; i += 1) {
        await expect(
          verifyHandoverCode('ord_rate_1', 'usr_seller_rate', '000000', mockDb)
        ).rejects.toMatchObject({
          statusCode: 400,
          code: 'INVALID_HANDOVER_CODE',
        });
      }

      // ครั้งที่ 5 ต้องถูกล็อก 429 ทันที
      await expect(
        verifyHandoverCode('ord_rate_1', 'usr_seller_rate', '000000', mockDb)
      ).rejects.toMatchObject({
        statusCode: 429,
        code: 'HANDOVER_RATE_LIMITED',
      });

      // แม้ส่งรหัสถูกขณะถูกล็อก ก็ยังต้องโดนบล็อก 429
      await expect(
        verifyHandoverCode('ord_rate_1', 'usr_seller_rate', '991122', mockDb)
      ).rejects.toMatchObject({
        statusCode: 429,
        code: 'HANDOVER_RATE_LIMITED',
      });
    });

    it('resolveDisputedOrder: ปิดเป็น COMPLETED ต้องอัปเดตหนังสือเป็น SOLD และปฏิเสธสถานะอื่นที่ไม่ใช่ DISPUTED', async () => {
      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_disp_1',
            buyerId: 'usr_b1',
            sellerId: 'usr_s1',
            status: 'DISPUTED',
            orderItems: [{ bookListingId: 'bok_d1' }],
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        bookListing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        orderMessage: { create: vi.fn().mockResolvedValue({}) },
      };
      const mockPrisma = { $transaction: vi.fn(async (cb: any) => cb(mockTx)) };

      const res = await resolveDisputedOrder(
        'ord_disp_1',
        { resolution: 'COMPLETED', adminNote: 'ผู้ซื้อได้รับหนังสือครบถ้วนแล้ว' },
        mockPrisma
      );

      expect(res.status).toBe('COMPLETED');
      expect(res.soldBookIds).toEqual(['bok_d1']);
      expect(mockTx.bookListing.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['bok_d1'] } },
        data: { status: 'SOLD' },
      });

      mockTx.order.findUnique.mockResolvedValue({
        id: 'ord_not_disp',
        status: 'REQUESTED',
        orderItems: [],
      });
      await expect(
        resolveDisputedOrder(
          'ord_not_disp',
          { resolution: 'CANCELLED', adminNote: 'test' },
          mockPrisma
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_ORDER_STATUS',
      });
    });

    it('resolveDisputedOrder: ปิดเป็น CANCELLED พร้อม refundCredit + incrementBuyerNoShow ต้องคืนหนังสือ/เครดิตและบวก noShowCount', async () => {
      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_disp_2',
            buyerId: 'usr_b2',
            sellerId: 'usr_s2',
            status: 'DISPUTED',
            orderItems: [{ bookListingId: 'bok_d2' }],
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        bookListing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        user: {
          update: vi.fn().mockResolvedValue({ credits: 4 }),
        },
        creditTransaction: { create: vi.fn().mockResolvedValue({}) },
        orderMessage: { create: vi.fn().mockResolvedValue({}) },
      };
      const mockPrisma = { $transaction: vi.fn(async (cb: any) => cb(mockTx)) };

      const res = await resolveDisputedOrder(
        'ord_disp_2',
        {
          resolution: 'CANCELLED',
          adminNote: 'ผู้ซื้อไม่มาตามนัดจริงตามหลักฐาน',
          refundCredit: true,
          incrementBuyerNoShow: true,
        },
        mockPrisma
      );

      expect(res.status).toBe('CANCELLED');
      expect(res.refundedCredit).toBe(true);
      expect(res.incrementedBuyerNoShow).toBe(true);
      expect(res.releasedBookIds).toEqual(['bok_d2']);
      expect(mockTx.bookListing.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['bok_d2'] } },
        data: { status: 'AVAILABLE' },
      });
      expect(mockTx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr_s2',
          amount: 1,
          type: 'REFUND_DISPUTE',
          orderId: 'ord_disp_2',
        }),
      });
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'usr_b2' },
        data: { noShowCount: { increment: 1 } },
      });
    });

    it('acceptOrder ต้องปฏิเสธด้วย 400 ORDER_EXPIRED และเปลี่ยนสถานะเป็น EXPIRED หาก REQUESTED เกิน 24 ชม.', async () => {
      const expiredCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_exp_1',
            sellerId: 'usr_seller_123',
            buyerId: 'usr_buyer_999',
            status: 'REQUESTED',
            shippingMethod: 'PICKUP',
            createdAt: expiredCreatedAt,
            seller: { id: 'usr_seller_123', credits: 3, isVerifiedSeller: true },
            orderItems: [{ bookListingId: 'bok_1', bookListing: { status: 'AVAILABLE' } }],
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: { updateMany: vi.fn() },
      };

      await expect(
        acceptOrder('ord_exp_1', 'usr_seller_123', {
          $transaction: vi.fn(async (cb: any) => cb(mockTx)),
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'ORDER_EXPIRED',
      });

      expect(mockTx.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'ord_exp_1', status: 'REQUESTED' },
        data: { status: 'EXPIRED' },
      });
      expect(mockTx.user.updateMany).not.toHaveBeenCalled();
    });

    it('expireStaleOrders ต้องปรับ REQUESTED เกิน 24 ชม. เป็น EXPIRED และ SHIPPED เกิน 7 วันเป็น COMPLETED', async () => {
      const findManyMock = vi
        .fn()
        .mockResolvedValueOnce([{ id: 'ord_req_old', buyerId: 'b1', sellerId: 's1' }])
        .mockResolvedValueOnce([
          {
            id: 'ord_ship_old',
            buyerId: 'b2',
            sellerId: 's2',
            status: 'SHIPPED',
            shippingMethod: 'DELIVERY',
            orderItems: [{ bookListingId: 'bok_ship_1' }],
          },
        ]);
      const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
      const bookUpdateManyMock = vi.fn().mockResolvedValue({ count: 1 });

      const mockDb: any = {
        order: {
          findMany: findManyMock,
          updateMany: updateManyMock,
        },
        bookListing: {
          updateMany: bookUpdateManyMock,
        },
        orderMessage: { create: vi.fn().mockResolvedValue({}) },
        $transaction: vi.fn(async (cb: any) => cb(mockDb)),
      };

      const summary = await expireStaleOrders(mockDb);

      expect(summary).toEqual({
        expiredRequestedCount: 1,
        autoCompletedShippedCount: 1,
      });
      expect(updateManyMock).toHaveBeenNthCalledWith(1, {
        where: { id: { in: ['ord_req_old'] }, status: 'REQUESTED' },
        data: { status: 'EXPIRED' },
      });
      expect(bookUpdateManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['bok_ship_1'] } },
        data: { status: 'SOLD' },
      });
    });

    it('getAdminOrders ต้องคืนรายการข้อพิพาทพร้อมผู้ซื้อ-ผู้ขาย-หนังสือ-ประวัติแชทเรียงตามเวลา', async () => {
      const mockDb: any = {
        order: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'ord_admin_1',
              status: 'DISPUTED',
              shippingMethod: 'PICKUP',
              paymentMethod: 'COD',
              totalPrice: 180,
              shippingFee: 0,
              cancelReason: null,
              receivedPhotoUrl: null,
              disputeReason: 'ผู้ซื้อไม่มาตามนัด',
              disputeOpenedBy: 'SELLER',
              disputedAt: new Date('2026-11-16T03:00:00Z'),
              missedMeetingReportedAt: new Date('2026-11-16T03:00:00Z'),
              pickupLocationName: 'หน้าหอสมุดกลาง มช.',
              scheduleDateIso: '2026-11-16',
              scheduleTimeLabel: '10:00',
              scheduledAt: new Date('2026-11-16T02:00:00Z'),
              scheduleConfirmedByBuyer: true,
              createdAt: new Date('2026-11-15T10:00:00Z'),
              updatedAt: new Date('2026-11-16T03:00:00Z'),
              buyer: {
                id: 'b1',
                nickname: 'ผู้ซื้อเอ',
                displayName: 'Buyer A',
                avatarUrl: null,
                noShowCount: 1,
              },
              seller: {
                id: 's1',
                nickname: 'ผู้ขายบี',
                displayName: 'Seller B',
                credits: 2,
                shopProfile: { shopName: 'ร้านหนังสือบี' },
              },
              orderItems: [
                {
                  bookListingId: 'bok_1',
                  price: 180,
                  bookListing: {
                    grade: 'LIKE_NEW',
                    bookCatalog: { title: 'Clean Code', coverUrl: 'https://img/cover.webp' },
                    images: [{ imageUrl: 'https://img/front.webp' }],
                  },
                },
              ],
              messages: [
                {
                  id: 'm2',
                  senderRole: 'SELLER',
                  kind: 'TEXT',
                  text: 'รอมา 20 นาทีแล้วครับ',
                  createdAt: new Date('2026-11-16T02:50:00Z'),
                  sender: { nickname: 'ผู้ขายบี', displayName: 'Seller B' },
                },
                {
                  id: 'm1',
                  senderRole: 'BUYER',
                  kind: 'TEXT',
                  text: 'กำลังเดินไปครับ',
                  createdAt: new Date('2026-11-16T02:30:00Z'),
                  sender: { nickname: 'ผู้ซื้อเอ', displayName: 'Buyer A' },
                },
              ],
              paymentSlips: [],
            },
          ]),
        },
      };

      const orders = await getAdminOrders({ status: 'DISPUTED' }, mockDb);

      expect(orders).toHaveLength(1);
      expect(orders[0].seller.shopName).toBe('ร้านหนังสือบี');
      expect(orders[0].buyer.noShowCount).toBe(1);
      expect(orders[0].recentMessages.map((m) => m.id)).toEqual(['m1', 'm2']);
    });
  });

  describe('acceptOrder Transaction Timeout & Post-Commit Message Resilience', () => {
    it('acceptOrder ต้องส่ง maxWait และ timeout ให้ $transaction และสร้าง system message หลัง commit โดยไม่ทำให้รับออเดอร์ล้มเหลว', async () => {
      const mockTx: any = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_tx_opt_1',
            sellerId: 'usr_seller_1',
            buyerId: 'usr_buyer_1',
            status: 'REQUESTED',
            shippingMethod: 'PICKUP',
            seller: { id: 'usr_seller_1', isVerifiedSeller: true, credits: 2 },
            orderItems: [{ bookListingId: 'bok_1', bookListing: { id: 'bok_1', status: 'AVAILABLE' } }],
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({ credits: 1 }),
        },
        creditTransaction: { create: vi.fn().mockResolvedValue({}) },
        bookListing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        orderItem: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const postCommitMessageCreate = vi.fn().mockRejectedValue(new Error('chat insert timeout'));
      const mockPrisma: any = {
        $transaction: vi.fn(async (cb: any, _opts?: any) => await cb(mockTx)),
        orderMessage: { create: postCommitMessageCreate },
      };

      const result = await acceptOrder('ord_tx_opt_1', 'usr_seller_1', mockPrisma);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 10_000,
        timeout: 15_000,
      });
      expect(postCommitMessageCreate).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('ACCEPTED');
      expect(result.remainingCredits).toBe(1);
    });
  });

  describe('Pickup Availability Lock & Immutable Schedule', () => {
    it('createOrder ต้องปฏิเสธ 409 PICKUP_SLOT_ALREADY_BOOKED เมื่อร้านมีออเดอร์อื่นนัดเวลาเดียวกันไว้แล้ว', async () => {
      const mockDb: any = {
        user: { findUnique: vi.fn().mockResolvedValue({ id: 'usr_buyer_2', phoneNumber: null }) },
        order: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'ord_existing_1',
              status: 'SCHEDULED',
              createdAt: new Date(),
              scheduleTimeLabel: '16:00 - 17:00',
            },
          ]),
        },
        bookListing: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'bok_2', sellerId: 'usr_seller_1', price: 150, status: 'AVAILABLE', allowPickup: true, codEnabled: true },
          ]),
        },
        shopProfile: {
          findUnique: vi.fn().mockResolvedValue({
            province: 'เชียงใหม่',
            shipWithinDays: 2,
            availableDays: ['จ', 'อ', 'พ', 'พฤ', 'ศ'],
            availableSlots: ['เย็น 16–20 น.'],
          }),
        },
        $transaction: vi.fn(async (cb: any) => await cb(mockDb)),
      };

      await expect(
        createOrder(
          'usr_buyer_2',
          {
            sellerId: 'usr_seller_1',
            bookIds: ['bok_2'],
            shippingMethod: 'PICKUP',
            pickupLat: 18.79,
            pickupLng: 98.95,
            pickupLocationName: 'หน้าหอสมุด มช.',
            scheduledAt: '2099-12-22T16:00:00+07:00',
            scheduleDateIso: '2099-12-22',
            scheduleTimeLabel: '16:00 - 17:00',
          },
          mockDb
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'PICKUP_SLOT_ALREADY_BOOKED',
      });
    });

    it('acceptOrder ต้องล็อกสถานะเป็น SCHEDULED พร้อมรหัส 6 หลักทันทีเมื่อออเดอร์นัดรับมีวันเวลา+พิกัดจากหน้าสั่งซื้อ', async () => {
      const mockTx: any = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_auto_sched_1',
            sellerId: 'usr_seller_1',
            buyerId: 'usr_buyer_1',
            status: 'REQUESTED',
            shippingMethod: 'PICKUP',
            scheduledAt: new Date('2099-12-22T16:00:00+07:00'),
            pickupLat: 18.795,
            pickupLng: 98.952,
            pickupLocationName: 'หน้าหอสมุด มช.',
            scheduleDateIso: '2099-12-22',
            scheduleTimeLabel: '16:00 - 17:00',
            handoverCode: null,
            seller: { id: 'usr_seller_1', isVerifiedSeller: true, credits: 2 },
            orderItems: [{ bookListingId: 'bok_1', bookListing: { id: 'bok_1', status: 'AVAILABLE' } }],
          }),
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({ credits: 1 }),
        },
        creditTransaction: { create: vi.fn().mockResolvedValue({}) },
        bookListing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        orderItem: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const result = await acceptOrder('ord_auto_sched_1', 'usr_seller_1', {
        $transaction: vi.fn(async (cb: any) => await cb(mockTx)),
      });

      expect(result.status).toBe('SCHEDULED');
      expect(mockTx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SCHEDULED',
            scheduleConfirmedByBuyer: true,
            handoverCode: expect.stringMatching(/^\d{6}$/),
          }),
        })
      );
    });

    it('schedulePickupOrder ต้องปฏิเสธ 400 SCHEDULE_LOCKED เมื่อออเดอร์อยู่ในสถานะ SCHEDULED แล้ว', async () => {
      const mockDb: any = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_locked_1',
            buyerId: 'usr_buyer_1',
            sellerId: 'usr_seller_1',
            shippingMethod: 'PICKUP',
            status: 'SCHEDULED',
          }),
        },
      };

      await expect(
        schedulePickupOrder(
          'ord_locked_1',
          'usr_seller_1',
          {
            scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            pickupLat: 18.79,
            pickupLng: 98.95,
          },
          mockDb
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'SCHEDULE_LOCKED',
      });
    });
  });

  describe('getUserOrders Performance (includeDetails & Lazy Maintenance Cooldown)', () => {
    it('getUserOrders แบบ includeDetails ต้องดึง details ในครั้งเดียวและติด cooldown ของ lazy maintenance 5 นาที', async () => {
      clearUserMaintenanceCooldownForTest();

      const sampleOrder = {
        id: 'ord_perf_1',
        buyerId: 'usr_buyer_perf',
        sellerId: 'usr_seller_perf',
        status: 'REQUESTED',
        shippingMethod: 'PICKUP',
        paymentMethod: 'COD',
        shippingFee: 0,
        totalPrice: 150,
        pickupLat: 18.79,
        pickupLng: 98.95,
        pickupLocationName: 'หน้าหอสมุด มช.',
        scheduledAt: new Date('2099-12-22T16:00:00+07:00'),
        scheduleDateIso: '2099-12-22',
        scheduleTimeLabel: '16:00 - 17:00',
        scheduleProposedBy: 'BUYER',
        scheduleConfirmedByBuyer: false,
        handoverCode: null,
        receivedPhotoUrl: null,
        receivedAt: null,
        missedMeetingReportedAt: null,
        cancelReason: null,
        disputeReason: null,
        disputeOpenedBy: null,
        disputedAt: null,
        deliveryDetail: null,
        reviews: [],
        paymentSlips: [],
        buyer: {
          id: 'usr_buyer_perf',
          nickname: 'ผู้ซื้อเอ',
          avatarUrl: null,
          phoneNumber: '0811111111',
          noShowCount: 0,
        },
        seller: {
          id: 'usr_seller_perf',
          nickname: 'ร้านบี',
          avatarUrl: null,
          promptpayId: null,
          verifiedName: null,
          isVerifiedSeller: true,
          shopProfile: { shopName: 'ร้านหนังสือบี' },
        },
        orderItems: [
          {
            bookListingId: 'bok_1',
            price: 150,
            bookListing: {
              grade: 'LIKE_NEW',
              bookCatalog: { title: 'Clean Architecture', coverUrl: 'https://img/cover.webp' },
              images: [],
            },
          },
        ],
        createdAt: new Date('2026-11-16T10:00:00Z'),
        updatedAt: new Date('2026-11-16T10:00:00Z'),
      };

      const findManyMock = vi
        .fn()
        // Call 1: expireOverdueRequestedOrders, Call 2: autoCompleteOverdueShippedOrders, Call 3: main order query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([sampleOrder])
        // Second getUserOrders call: lazy maintenance skipped via cooldown -> only 1 findMany call!
        .mockResolvedValueOnce([sampleOrder]);

      const mockDb: any = {
        order: {
          findMany: findManyMock,
          updateMany: vi.fn(),
        },
      };

      const first = await getUserOrders('usr_buyer_perf', undefined, mockDb, {
        includeDetails: true,
      });
      expect(first.details).toHaveLength(1);
      expect(first.details?.[0].items[0].title).toBe('Clean Architecture');
      expect(first.buying).toHaveLength(1);
      expect(findManyMock).toHaveBeenCalledTimes(3);

      const second = await getUserOrders('usr_buyer_perf', undefined, mockDb, {
        includeDetails: true,
      });
      expect(second.details).toHaveLength(1);
      expect(findManyMock).toHaveBeenCalledTimes(4);

      clearUserMaintenanceCooldownForTest();
    });

    it('createOrder คิดค่าส่งพัสดุของชุดหนังสือตามจำนวนเล่มจริง (หัก missingVolumes) และจำกัดเพดาน ฿150', async () => {
      const tx = {
        order: {
          create: vi.fn().mockImplementation(async ({ data }: any) => ({
            id: 'ord_set_ship_1',
            ...data,
            createdAt: new Date(),
          })),
        },
      };
      const mockDb: any = {
        user: { findUnique: vi.fn().mockResolvedValue({ id: 'usr_buyer_set', phoneNumber: null }) },
        order: { count: vi.fn().mockResolvedValue(0) },
        bookListing: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'bok_set_1',
              sellerId: 'usr_seller_1',
              price: 450,
              status: 'AVAILABLE',
              allowDelivery: true,
              codEnabled: true,
              isSet: true,
              totalVolumes: 5,
              missingVolumes: [4], // เหลือ 4 เล่มจริง -> 50 + 3*10 = 80
            },
          ]),
        },
        shopProfile: { findUnique: vi.fn().mockResolvedValue({ province: 'เชียงใหม่', shipWithinDays: 2 }) },
        $transaction: vi.fn(async (cb: any) => await cb(tx)),
      };

      const res = await createOrder(
        'usr_buyer_set',
        {
          sellerId: 'usr_seller_1',
          bookIds: ['bok_set_1'],
          shippingMethod: 'DELIVERY',
          recipientName: 'สมชาย',
          deliveryAddress: 'หอ 4 มช.',
        },
        mockDb
      );

      expect(res.shippingFee).toBe(80);
      expect(res.totalPrice).toBe(530);
    });
  });

  describe('Security & Logic Fixes (CRITICAL-2, HIGH-2, HIGH-4)', () => {
    it('CRITICAL-2: เมื่อผู้ขายเรียก schedulePickupOrder ต้องคง status=ACCEPTED, scheduleConfirmedByBuyer=false และไม่ออก handoverCode จนกว่าผู้ซื้อจะยืนยัน', async () => {
      const mockDb = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_sched_sec',
            buyerId: 'usr_buyer_1',
            sellerId: 'usr_seller_1',
            shippingMethod: 'PICKUP',
            status: 'ACCEPTED',
            handoverCode: null,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };

      const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const sellerRes = await schedulePickupOrder(
        'ord_sched_sec',
        'usr_seller_1',
        { scheduledAt: futureIso, pickupLat: 18.79, pickupLng: 98.95, pickupLocationName: 'หน้าหอสมุด มช.' },
        mockDb
      );

      expect(sellerRes.status).toBe('ACCEPTED');
      expect(sellerRes.handoverCode).toBeNull();
      expect(mockDb.order.update).toHaveBeenCalledWith({
        where: { id: 'ord_sched_sec' },
        data: expect.objectContaining({
          status: 'ACCEPTED',
          scheduleProposedBy: 'SELLER',
          scheduleConfirmedByBuyer: false,
          handoverCode: null,
        }),
      });

      // ปฏิเสธเวลานัดย้อนหลังแม้เพียง 1 นาที
      const pastOneMin = new Date(Date.now() - 60 * 1000).toISOString();
      await expect(
        schedulePickupOrder(
          'ord_sched_sec',
          'usr_seller_1',
          { scheduledAt: pastOneMin, pickupLat: 18.79, pickupLng: 98.95 },
          mockDb
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'SCHEDULE_IN_THE_PAST' });
    });

    it('HIGH-2: acceptOrder ปฏิเสธ 403 ACCOUNT_BLACKLISTED หากผู้ขายติดบัญชีดำ', async () => {
      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_blk_1',
            sellerId: 'usr_seller_blk',
            buyerId: 'usr_buyer_1',
            status: 'REQUESTED',
            shippingMethod: 'PICKUP',
            seller: {
              id: 'usr_seller_blk',
              isVerifiedSeller: false,
              isBlacklisted: true,
              credits: 2,
            },
            orderItems: [{ bookListingId: 'bok_1', bookListing: { id: 'bok_1', status: 'AVAILABLE' } }],
          }),
        },
      };

      await expect(
        acceptOrder('ord_blk_1', 'usr_seller_blk', {
          $transaction: vi.fn(async (cb: any) => await cb(mockTx)),
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_BLACKLISTED' });
    });

    it('HIGH-4: cancelOrder และ openDispute เซ็นเซอร์เบอร์โทร/LINE ID ในเหตุผลอัตโนมัติ', async () => {
      const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
      const msgCreateMock = vi.fn().mockResolvedValue({});
      const mockDb: any = {
        $transaction: vi.fn(async (cb: any) => await cb(mockDb)),
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord_mask_1',
            buyerId: 'usr_buyer_1',
            sellerId: 'usr_seller_1',
            status: 'REQUESTED',
            orderItems: [],
          }),
          updateMany: updateManyMock,
        },
        orderMessage: { create: msgCreateMock },
      };

      await cancelOrder('ord_mask_1', 'usr_buyer_1', 'ติดต่อไลน์ @secret99 เบอร์ 0812345678', mockDb);
      expect(updateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelReason: expect.not.stringContaining('0812345678'),
          }),
        })
      );
      expect(updateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelReason: expect.not.stringContaining('@secret99'),
          }),
        })
      );

      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_mask_1',
        buyerId: 'usr_buyer_1',
        sellerId: 'usr_seller_1',
        status: 'ACCEPTED',
        orderItems: [],
      });
      const disputeRes = await openDispute(
        'ord_mask_1',
        'usr_buyer_1',
        'ขอคุยต่อที่ 0891112222',
        mockDb
      );
      expect(disputeRes.disputeReason).not.toContain('0891112222');
      expect(disputeRes.disputeReason).toContain('•••');
    });
  });
});
