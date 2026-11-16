import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  completeDeliveryOrder,
  createBatchOrders,
  createOrder,
  getOrderDetail,
  rejectOrder,
  reportMissedMeeting,
  shipOrder,
  verifyOrderPaymentSlip,
} from '../orderService';
import { CreateOrderInput, PaymentSlipInput, ShipOrderInput } from '../../types';

describe('OrderService - Delivery Flow & PDPA Protection', () => {
  let mockDb: any;
  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      order: {
        create: vi.fn(),
        update: vi.fn(),
      },
      paymentSlip: {
        create: vi.fn(),
      },
      orderDeliveryDetail: {
        update: vi.fn(),
      },
      bookListing: {
        updateMany: vi.fn(),
      },
    };

    mockDb = {
      $transaction: vi.fn(async (callback: any) => await callback(mockTx)),
      order: {
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      bookListing: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      paymentSlip: {
        findUnique: vi.fn(),
      },
    };
  });

  describe('createOrder (Cart Checkout & Order Creation)', () => {
    const mockBuyerId = 'usr_buyer_001';
    const mockSellerId = 'usr_seller_001';

    const baseInput: CreateOrderInput = {
      sellerId: mockSellerId,
      bookIds: ['bok_1', 'bok_2'],
      shippingMethod: 'DELIVERY',
      recipientName: 'สมชาย ใจดี',
      recipientPhone: '0898765432',
      deliveryAddress: 'หอ 4 มช. ต.สุเทพ อ.เมือง จ.เชียงใหม่',
    };

    const mockBooks = [
      { id: 'bok_1', sellerId: mockSellerId, price: 150, status: 'AVAILABLE', allowDelivery: true, allowPickup: true },
      { id: 'bok_2', sellerId: mockSellerId, price: 200, status: 'AVAILABLE', allowDelivery: true, allowPickup: true },
    ];

    it('กรณีสำเร็จ (DELIVERY): คำนวณค่าส่ง ฿50 เล่มแรก + ฿10 เล่มถัดไป และสร้างออเดอร์ REQUESTED', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(1); // มีค้าง 1 ออเดอร์ (โควต้าไม่เกิน 3)
      mockDb.bookListing.findMany.mockResolvedValue(mockBooks);

      mockTx.order.create.mockResolvedValue({
        id: 'ord_new_001',
        totalPrice: 410, // (150 + 200) + (50 + 10) = 410
        shippingFee: 60,
        paymentMethod: 'COD',
        status: 'REQUESTED',
        createdAt: new Date('2026-11-12T17:00:00Z'),
      });

      const result = await createOrder(mockBuyerId, baseInput, mockDb);

      expect(result.shippingFee).toBe(60);
      expect(result.totalPrice).toBe(410);
      expect(result.paymentMethod).toBe('COD');
      expect(result.status).toBe('REQUESTED');

      expect(mockTx.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          buyerId: mockBuyerId,
          sellerId: mockSellerId,
          shippingMethod: 'DELIVERY',
          paymentMethod: 'COD',
          shippingFee: 60,
          totalPrice: 410,
          status: 'REQUESTED',
          deliveryDetail: {
            create: {
              recipientName: 'สมชาย ใจดี',
              recipientPhone: '0898765432',
              province: null,
              deliveryAddress: 'หอ 4 มช. ต.สุเทพ อ.เมือง จ.เชียงใหม่',
            },
          },
        }),
      });
    });

    it('กรณีสำเร็จ (PICKUP): ค่าส่งต้องเป็น ฿0 และยอดรวมเท่ากับราคาหนังสือ', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(0);
      mockDb.bookListing.findMany.mockResolvedValue([mockBooks[0]]);

      mockTx.order.create.mockResolvedValue({
        id: 'ord_pickup_001',
        totalPrice: 150,
        shippingFee: 0,
        status: 'REQUESTED',
        createdAt: new Date(),
      });

      const result = await createOrder(
        mockBuyerId,
        {
          sellerId: mockSellerId,
          bookIds: ['bok_1'],
          shippingMethod: 'PICKUP',
          pickupLocationName: 'หน้าหอสมุดกลาง มช.',
        },
        mockDb
      );

      expect(result.shippingFee).toBe(0);
      expect(result.totalPrice).toBe(150);
    });

    it('ต้องปฏิเสธหากสั่งซื้อหนังสือของตนเอง (CANNOT_BUY_OWN_BOOK)', async () => {
      await expect(
        createOrder(mockSellerId, { ...baseInput, sellerId: mockSellerId }, mockDb)
      ).rejects.toThrow('คุณไม่สามารถสั่งซื้อหนังสือของตนเองได้');
    });

    it('PDPA v4: ผู้ซื้อที่ยังไม่มี phoneNumber สามารถสร้างคำสั่งซื้อได้โดยไม่บังคับเบอร์โทร', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: null });
      mockDb.order.count.mockResolvedValue(0);
      mockDb.bookListing.findMany.mockResolvedValue([mockBooks[0]]);
      mockTx.order.create.mockResolvedValue({
        id: 'ord_pdpa_001',
        totalPrice: 200,
        shippingFee: 50,
        paymentMethod: 'COD',
        status: 'REQUESTED',
        createdAt: new Date(),
      });

      const result = await createOrder(
        mockBuyerId,
        {
          sellerId: mockSellerId,
          bookIds: ['bok_1'],
          shippingMethod: 'DELIVERY',
          recipientName: 'สมชาย ใจดี',
          deliveryAddress: 'หอ 4 มช.',
        },
        mockDb
      );
      expect(result.status).toBe('REQUESTED');
      expect(result.shippingFee).toBe(50);
    });

    it('ต้องปฏิเสธหากมีคำขอค้าง REQUESTED ครบ 10 ออเดอร์แล้ว (TOO_MANY_PENDING_REQUESTS)', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(10); // ค้างครบ 10 รายการแล้ว

      await expect(createOrder(mockBuyerId, baseInput, mockDb)).rejects.toThrow(
        'เกินโควต้าสูงสุด 10 ออเดอร์แล้ว'
      );
    });

    it('ต้องปฏิเสธหากในตะกร้ามีหนังสือจากหลายร้านค้า (MULTIPLE_SELLERS_IN_CART)', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(0);
      mockDb.bookListing.findMany.mockResolvedValue([
        mockBooks[0],
        { ...mockBooks[1], sellerId: 'usr_different_seller' }, // ร้านอื่น
      ]);

      await expect(createOrder(mockBuyerId, baseInput, mockDb)).rejects.toThrow(
        '1 ตะกร้าต้องเป็นหนังสือจากร้านเดียวกันเท่านั้น'
      );
    });

    it('ต้องปฏิเสธหากหนังสือบางเล่มในตะกร้าถูกจองหรือขายไปแล้ว (BOOK_NOT_AVAILABLE)', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(0);
      mockDb.bookListing.findMany.mockResolvedValue([
        mockBooks[0],
        { ...mockBooks[1], status: 'RESERVED' },
      ]);

      await expect(createOrder(mockBuyerId, baseInput, mockDb)).rejects.toThrow(
        'หนังสือบางเล่มในตะกร้าถูกจองหรือขายไปแล้ว'
      );
    });

    it('ต้องปฏิเสธหากพบ bookIds ซ้ำซ้อนในคำขอเดียวกัน (DUPLICATE_BOOK_IDS)', async () => {
      await expect(
        createOrder(mockBuyerId, { ...baseInput, bookIds: ['bok_1', 'bok_1'] }, mockDb)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'DUPLICATE_BOOK_IDS',
      });
    });

    it('ต้องปฏิเสธหากผู้ซื้อมีคำขอ REQUESTED ค้างอยู่กับร้านเดียวกันแล้ว (PENDING_ORDER_EXISTS_FOR_SELLER)', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(1);
      mockDb.order.findFirst = vi.fn().mockResolvedValue({ id: 'ord_existing_1' });

      await expect(createOrder(mockBuyerId, baseInput, mockDb)).rejects.toMatchObject({
        statusCode: 400,
        code: 'PENDING_ORDER_EXISTS_FOR_SELLER',
        details: { sellerId: mockSellerId, existingOrderId: 'ord_existing_1' },
      });
    });

    it('ต้องอ่าน shipWithinDays จาก ShopProfile บน Server แทนค่าที่ Client ส่งมา และเช็ก expectedTotal', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(0);
      mockDb.bookListing.findMany.mockResolvedValue([mockBooks[0]]);
      mockDb.shopProfile = {
        findUnique: vi.fn().mockResolvedValue({ province: 'เชียงใหม่', shipWithinDays: 3 }),
      };
      mockTx.order.create.mockResolvedValue({
        id: 'ord_ship_days',
        totalPrice: 200,
        shippingFee: 50,
        paymentMethod: 'COD',
        status: 'REQUESTED',
        createdAt: new Date(),
      });

      await createOrder(
        mockBuyerId,
        {
          sellerId: mockSellerId,
          bookIds: ['bok_1'],
          shippingMethod: 'DELIVERY',
          recipientName: 'สมชาย',
          buyerProvince: 'เชียงใหม่',
          deliveryAddress: 'มช.',
          shipWithinDays: 99, // พยายามปลอมแปลงจาก client
          expectedTotal: 200,
        },
        mockDb
      );

      expect(mockTx.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shipWithinDays: 3,
        }),
      });
    });

    it('ต้องปฏิเสธ 409 PRICE_CHANGED หาก expectedTotal ไม่ตรงกับยอดคำนวณจริงบน Server', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(0);
      mockDb.bookListing.findMany.mockResolvedValue([mockBooks[0]]);

      await expect(
        createOrder(
          mockBuyerId,
          {
            sellerId: mockSellerId,
            bookIds: ['bok_1'],
            shippingMethod: 'PICKUP',
            expectedTotal: 99,
          },
          mockDb
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'PRICE_CHANGED',
        details: { sellerId: mockSellerId, expectedTotal: 99, actualTotal: 150 },
      });
    });

    it('ต้องคืนค่าผลลัพธ์เดิมเมื่อส่ง idempotencyKey ซ้ำ (ป้องกันการกดเบิ้ล)', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: mockBuyerId, phoneNumber: '0812345678' });
      mockDb.order.count.mockResolvedValue(0);
      mockDb.bookListing.findMany.mockResolvedValue([mockBooks[0]]);
      mockTx.order.create.mockResolvedValue({
        id: 'ord_idem_1',
        totalPrice: 150,
        shippingFee: 0,
        paymentMethod: 'COD',
        status: 'REQUESTED',
        createdAt: new Date(),
      });

      const payload: CreateOrderInput = {
        sellerId: mockSellerId,
        bookIds: ['bok_1'],
        shippingMethod: 'PICKUP',
        idempotencyKey: 'idem-key-test-001',
      };

      const first = await createOrder(mockBuyerId, payload, mockDb);
      const second = await createOrder(mockBuyerId, payload, mockDb);

      expect(first.orderId).toBe('ord_idem_1');
      expect(second.orderId).toBe('ord_idem_1');
      expect(mockTx.order.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('createBatchOrders (Multi-Seller All-or-Nothing)', () => {
    const buyerId = 'usr_buyer_batch';
    const sellerA = 'usr_seller_a';
    const sellerB = 'usr_seller_b';

    it('กรณีสำเร็จ: สร้างออเดอร์หลายร้านใน Transaction เดียวและคำนวณค่าส่งแยกตามร้าน', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: buyerId, phoneNumber: null });
      mockDb.order.count.mockResolvedValue(1);
      mockDb.bookListing.findMany
        .mockResolvedValueOnce([
          { id: 'bok_a1', sellerId: sellerA, price: 120, status: 'AVAILABLE', allowDelivery: true, allowPickup: true, codEnabled: true },
        ])
        .mockResolvedValueOnce([
          { id: 'bok_b1', sellerId: sellerB, price: 200, status: 'AVAILABLE', allowDelivery: true, allowPickup: true, codEnabled: true },
        ]);
      mockDb.shopProfile = {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ province: 'เชียงใหม่', shipWithinDays: 2 })
          .mockResolvedValueOnce({ province: 'กรุงเทพมหานคร', shipWithinDays: 3 }),
      };
      mockTx.order.create
        .mockResolvedValueOnce({
          id: 'ord_batch_a',
          totalPrice: 120,
          shippingFee: 0,
          paymentMethod: 'COD',
          status: 'REQUESTED',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'ord_batch_b',
          totalPrice: 250,
          shippingFee: 50,
          paymentMethod: 'COD',
          status: 'REQUESTED',
          createdAt: new Date(),
        });

      const res = await createBatchOrders(
        buyerId,
        {
          idempotencyKey: 'batch-idem-1',
          orders: [
            { sellerId: sellerA, bookIds: ['bok_a1'], shippingMethod: 'PICKUP', expectedTotal: 120 },
            {
              sellerId: sellerB,
              bookIds: ['bok_b1'],
              shippingMethod: 'DELIVERY',
              recipientName: 'สมชาย',
              buyerProvince: 'เชียงใหม่',
              deliveryAddress: 'มช.',
              expectedTotal: 250,
            },
          ],
        },
        mockDb
      );

      expect(res.orders).toHaveLength(2);
      expect(res.orders[0].orderId).toBe('ord_batch_a');
      expect(res.orders[1].orderId).toBe('ord_batch_b');
      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it('ควรคืนผลลัพธ์เดิมจาก DB (Order.idempotencyKey) หากพบรายการที่บันทึกไว้แล้วแม้รีสตาร์ทเซิร์ฟเวอร์', async () => {
      mockDb.order.findMany = vi.fn().mockResolvedValue([
        {
          id: 'ord_persisted_1',
          idempotencyKey: `${buyerId}:single:persisted-key-1:${sellerA}`,
          totalPrice: 150,
          shippingFee: 0,
          paymentMethod: 'COD',
          status: 'REQUESTED',
          createdAt: new Date('2026-11-14T10:00:00Z'),
        },
      ]);

      const persisted = await createOrder(
        buyerId,
        {
          sellerId: sellerA,
          bookIds: ['bok_1'],
          shippingMethod: 'PICKUP',
          idempotencyKey: 'persisted-key-1',
        },
        mockDb
      );

      expect(persisted.orderId).toBe('ord_persisted_1');
      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it('All-or-Nothing Rollback: หากร้านที่ 2 มีหนังสือไม่พร้อมขาย ต้อง Error พร้อม details.invalidBookIds และ rollback ทั้งก้อน', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: buyerId, phoneNumber: null });
      mockDb.order.count.mockResolvedValue(0);
      mockDb.bookListing.findMany
        .mockResolvedValueOnce([
          { id: 'bok_a1', sellerId: sellerA, price: 120, status: 'AVAILABLE', allowDelivery: true, allowPickup: true, codEnabled: true },
        ])
        .mockResolvedValueOnce([
          { id: 'bok_b1', sellerId: sellerB, price: 200, status: 'RESERVED', allowDelivery: true, allowPickup: true, codEnabled: true },
        ]);
      mockTx.order.create.mockResolvedValue({
        id: 'ord_batch_a',
        totalPrice: 120,
        shippingFee: 0,
        paymentMethod: 'COD',
        status: 'REQUESTED',
        createdAt: new Date(),
      });

      await expect(
        createBatchOrders(
          buyerId,
          {
            orders: [
              { sellerId: sellerA, bookIds: ['bok_a1'], shippingMethod: 'PICKUP' },
              { sellerId: sellerB, bookIds: ['bok_b1'], shippingMethod: 'PICKUP' },
            ],
          },
          mockDb
        )
      ).rejects.toMatchObject({
        code: 'BOOK_NOT_AVAILABLE',
        details: { sellerId: sellerB, invalidBookIds: ['bok_b1'] },
      });
    });

    it('ต้องปฏิเสธหากจำนวนคำขอใน batch ทำให้ยอดค้างรวมเกิน 10 ออเดอร์', async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: buyerId, phoneNumber: null });
      mockDb.order.count.mockResolvedValue(9);

      await expect(
        createBatchOrders(
          buyerId,
          {
            orders: [
              { sellerId: sellerA, bookIds: ['bok_a1'], shippingMethod: 'PICKUP' },
              { sellerId: sellerB, bookIds: ['bok_b1'], shippingMethod: 'PICKUP' },
            ],
          },
          mockDb
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'TOO_MANY_PENDING_REQUESTS',
      });
    });
  });

  describe('getOrderDetail & PDPA Masking Rule', () => {
    const mockOrderId = 'ord_123';
    const mockBuyerId = 'usr_buyer';
    const mockSellerId = 'usr_seller';

    const baseOrder = {
      id: mockOrderId,
      buyerId: mockBuyerId,
      sellerId: mockSellerId,
      status: 'REQUESTED',
      shippingMethod: 'DELIVERY',
      shippingFee: 40,
      totalPrice: 215,
      createdAt: new Date('2026-11-12T10:00:00Z'),
      buyer: {
        id: mockBuyerId,
        nickname: 'กานต์',
        avatarUrl: 'https://avatar/buyer.webp',
        phoneNumber: '0865554433',
      },
      seller: {
        id: mockSellerId,
        nickname: 'นนท์',
        avatarUrl: 'https://avatar/seller.webp',
        promptpayId: '0812345678',
        verifiedName: 'นนทภัทร สุขใจ',
        isVerifiedSeller: true,
      },
      deliveryDetail: {
        recipientName: 'กานต์ กิตติคุณ',
        recipientPhone: '0865554433',
        deliveryAddress: 'หอ 4 มช.',
        courierName: null,
        trackingNumber: null,
        parcelImageUrl: null,
        shippedAt: null,
      },
      orderItems: [
        {
          bookListingId: 'bok_1',
          price: 175,
          bookListing: {
            grade: 'GENTLY_READ',
            bookCatalog: { title: 'หนังสือทดสอบ', coverUrl: 'https://cover.webp' },
            images: [],
          },
        },
      ],
    };

    it('ผู้ซื้อดูออเดอร์: ต้องมองเห็นที่อยู่จัดส่งของตนเองได้เสมอทุกสถานะ และได้ grade จริงของหนังสือ', async () => {
      mockDb.order.findUnique.mockResolvedValue(baseOrder);

      const result = await getOrderDetail(mockOrderId, mockBuyerId, mockDb);

      expect(result.deliveryDetails).not.toBeNull();
      expect(result.deliveryDetails?.deliveryAddress).toBe('หอ 4 มช.');
      expect(result.buyer.phoneNumber).toBe('0865554433');
      expect(result.items[0].grade).toBe('GENTLY_READ');
    });

    it('ผู้ขายดูออเดอร์สถานะ REQUESTED: ต้องถูกซ่อนที่อยู่จัดส่งและเบอร์ผู้ซื้อตามกฎ PDPA', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: 'REQUESTED',
      });

      const result = await getOrderDetail(mockOrderId, mockSellerId, mockDb);

      expect(result.deliveryDetails).toBeNull();
      expect(result.buyer.phoneNumber).toBeNull();
      expect(result.buyer.nickname).toBe('ผู้ซื้อ #_123');
      expect(result.buyer.avatarUrl).toBeNull();
    });

    it('ผู้ขายดูออเดอร์ TRANSFER สถานะ ACCEPTED: ยังคงต้องซ่อนที่อยู่จัดส่งจนกว่าจะชำระเงิน', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        ...baseOrder,
        paymentMethod: 'TRANSFER',
        status: 'ACCEPTED',
      });

      const result = await getOrderDetail(mockOrderId, mockSellerId, mockDb);

      expect(result.deliveryDetails).toBeNull();
      expect(result.buyer.phoneNumber).toBeNull();
    });

    it('ผู้ขายดูออเดอร์ COD สถานะ ACCEPTED: สามารถเห็นที่อยู่จัดส่งเพื่อเตรียมแพ็คของได้', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        ...baseOrder,
        paymentMethod: 'COD',
        status: 'ACCEPTED',
      });

      const result = await getOrderDetail(mockOrderId, mockSellerId, mockDb);

      expect(result.deliveryDetails).not.toBeNull();
      expect(result.deliveryDetails?.deliveryAddress).toBe('หอ 4 มช.');
    });

    it('ผู้ขายดูออเดอร์สถานะ PAID และ SHIPPED: ปลดล็อกให้เห็นที่อยู่และเบอร์ผู้รับสำหรับเขียนหน้ากล่อง', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: 'PAID',
      });

      const result = await getOrderDetail(mockOrderId, mockSellerId, mockDb);

      expect(result.deliveryDetails).not.toBeNull();
      expect(result.deliveryDetails?.deliveryAddress).toBe('หอ 4 มช.');
      expect(result.deliveryDetails?.recipientPhone).toBe('0865554433');
    });

    it('ผู้ขายดูออเดอร์สถานะ COMPLETED: ข้อมูลที่อยู่และเบอร์ผู้รับถูกซ่อนกลับเพื่อความปลอดภัย', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: 'COMPLETED',
      });

      const result = await getOrderDetail(mockOrderId, mockSellerId, mockDb);

      expect(result.deliveryDetails).toBeNull();
      expect(result.buyer.phoneNumber).toBeNull();
    });

    it('คนภายนอกที่ไม่ได้เป็นคู่สัญญา ต้องไม่สามารถดูข้อมูลออเดอร์ได้ (FORBIDDEN)', async () => {
      mockDb.order.findUnique.mockResolvedValue(baseOrder);

      await expect(getOrderDetail(mockOrderId, 'usr_stranger', mockDb)).rejects.toThrow(
        'คุณไม่มีสิทธิ์ดูคำสั่งซื้อนี้'
      );
    });
  });

  describe('rejectOrder (Reject Order)', () => {
    it('ผู้ขายปฏิเสธคำขอซื้อได้สำเร็จ โดยไม่เสียเครดิต', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_1',
        sellerId: 'usr_seller_1',
        status: 'REQUESTED',
      });
      mockDb.order.update.mockResolvedValue({});

      const result = await rejectOrder('ord_1', 'usr_seller_1', mockDb);

      expect(mockDb.order.update).toHaveBeenCalledWith({
        where: { id: 'ord_1' },
        data: { status: 'REJECTED' },
      });
      expect(result.status).toBe('REJECTED');
    });

    it('ต้องปฏิเสธหากผู้กดยกเลิกไม่ใช่ผู้ขายของออเดอร์นี้ (FORBIDDEN)', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_1',
        sellerId: 'usr_seller_1',
        status: 'REQUESTED',
      });

      await expect(rejectOrder('ord_1', 'usr_other', mockDb)).rejects.toThrow(
        'คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้'
      );
    });
  });

  describe('verifyOrderPaymentSlip (Slip Upload & Anti-Replay)', () => {
    const mockOrder = {
      id: 'ord_delivery_01',
      buyerId: 'usr_buyer_1',
      sellerId: 'usr_seller_1',
      shippingMethod: 'DELIVERY',
      status: 'ACCEPTED',
      totalPrice: 215.00,
      seller: {
        verifiedName: 'นนทภัทร สุขใจ',
      },
    };

    const slipInput: PaymentSlipInput = {
      slipImageUrl: 'https://storage/slip.webp',
      transRef: '202611129999',
      amount: 215.00,
      receiverName: 'นาย นนทภัทร สุขใจ',
    };

    it('กรณีสำเร็จ: ตรวจสลิปถูกต้อง ปรับสถานะออเดอร์เป็น PAID และบันทึก payment_slips', async () => {
      mockDb.order.findUnique.mockResolvedValue(mockOrder);
      mockDb.paymentSlip.findUnique.mockResolvedValue(null); // ไม่เคยมีสลิปนี้

      const result = await verifyOrderPaymentSlip('ord_delivery_01', 'usr_buyer_1', slipInput, mockDb);

      expect(result.status).toBe('PAID');
      expect(result.verificationStatus).toBe('AUTO_VERIFIED');
      expect(result.transRef).toBe('202611129999');

      expect(mockTx.paymentSlip.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr_buyer_1',
          orderId: 'ord_delivery_01',
          slipType: 'ORDER_PAYMENT',
          transRef: '202611129999',
          amount: 215.00,
          verificationStatus: 'AUTO_VERIFIED',
        }),
      });

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord_delivery_01' },
        data: { status: 'PAID' },
      });
    });

    it('ต้องปฏิเสธหากสลิปซ้ำ (DUPLICATE_SLIP Anti-Replay Attack)', async () => {
      mockDb.order.findUnique.mockResolvedValue(mockOrder);
      mockDb.paymentSlip.findUnique.mockResolvedValue({ id: 'existing_slip' }); // เคยใช้แล้ว

      await expect(
        verifyOrderPaymentSlip('ord_delivery_01', 'usr_buyer_1', slipInput, mockDb)
      ).rejects.toThrow('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว');
    });

    it('ต้องปฏิเสธหากยอดเงินในสลิปไม่ตรงกับยอดคำสั่งซื้อ (SLIP_AMOUNT_MISMATCH)', async () => {
      mockDb.order.findUnique.mockResolvedValue(mockOrder);
      mockDb.paymentSlip.findUnique.mockResolvedValue(null);

      await expect(
        verifyOrderPaymentSlip(
          'ord_delivery_01',
          'usr_buyer_1',
          { ...slipInput, amount: 150.00 }, // ยอดโอน 150 แต่ราคาจริง 215
          mockDb
        )
      ).rejects.toThrow('ยอดเงินในสลิปไม่ตรงกับยอดรวมของคำสั่งซื้อ');
    });

    it('ต้องปฏิเสธหากชื่อบัญชีผู้รับในสลิปไม่ตรงกับชื่อยืนยันของผู้ขาย (SLIP_RECEIVER_MISMATCH)', async () => {
      mockDb.order.findUnique.mockResolvedValue(mockOrder);
      mockDb.paymentSlip.findUnique.mockResolvedValue(null);

      await expect(
        verifyOrderPaymentSlip(
          'ord_delivery_01',
          'usr_buyer_1',
          { ...slipInput, receiverName: 'นาย คนอื่น ไม่ตรง' },
          mockDb
        )
      ).rejects.toThrow('ชื่อผู้รับเงินในสลิปไม่ตรงกับชื่อยืนยันของผู้ขาย');
    });
  });

  describe('shipOrder & completeDeliveryOrder (Delivery Fulfillment)', () => {
    it('shipOrder: ผู้ขายกรอกเลขพัสดุสำเร็จ อัปเดตสถานะเป็น SHIPPED', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_1',
        sellerId: 'usr_seller_1',
        shippingMethod: 'DELIVERY',
        status: 'PAID',
      });

      const shipInput: ShipOrderInput = {
        courierName: 'Flash Express',
        trackingNumber: 'TH0123456789A',
        parcelImageUrl: 'https://storage/box.webp',
      };

      const result = await shipOrder('ord_1', 'usr_seller_1', shipInput, mockDb);

      expect(result.status).toBe('SHIPPED');
      expect(result.trackingNumber).toBe('TH0123456789A');

      expect(mockTx.orderDeliveryDetail.update).toHaveBeenCalledWith({
        where: { orderId: 'ord_1' },
        data: expect.objectContaining({
          courierName: 'Flash Express',
          trackingNumber: 'TH0123456789A',
          parcelImageUrl: 'https://storage/box.webp',
        }),
      });

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord_1' },
        data: { status: 'SHIPPED' },
      });
    });

    it('completeDeliveryOrder: ผู้ซื้อยืนยันรับของสำเร็จ เปลี่ยนออเดอร์เป็น COMPLETED และหนังสือเป็น SOLD', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_1',
        buyerId: 'usr_buyer_1',
        shippingMethod: 'DELIVERY',
        status: 'SHIPPED',
        orderItems: [{ bookListingId: 'bok_100' }],
      });

      const result = await completeDeliveryOrder('ord_1', 'usr_buyer_1', mockDb);

      expect(result.status).toBe('COMPLETED');

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord_1' },
        data: { status: 'COMPLETED' },
      });

      expect(mockTx.bookListing.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['bok_100'] } },
        data: { status: 'SOLD' },
      });
    });
  });

  describe('reportMissedMeeting (No-show Reporting)', () => {
    it('ต้องปฏิเสธหากยังไม่ถึงเวลานัดหมาย + 15 นาที (TOO_EARLY_FOR_NO_SHOW)', async () => {
      // นัดหมายตอน 17:00 (แต่เวลานี้คือ 17:05 เพิ่งเลยมา 5 นาที)
      const scheduledAt = new Date(Date.now() - 5 * 60 * 1000);

      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_pickup_1',
        sellerId: 'usr_seller_1',
        shippingMethod: 'PICKUP',
        status: 'SCHEDULED',
        scheduleConfirmedByBuyer: true,
        scheduledAt,
      });

      await expect(
        reportMissedMeeting('ord_pickup_1', 'usr_seller_1', mockDb)
      ).rejects.toThrow('ยังไม่ถึงเวลานัดหมาย + 15 นาที');
    });

    it('ต้องปฏิเสธหากผู้ซื้อยังไม่ได้ยืนยันเวลานัดหมาย (SCHEDULE_NOT_CONFIRMED_BY_BUYER)', async () => {
      const scheduledAt = new Date(Date.now() - 60 * 60 * 1000);

      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_pickup_1',
        sellerId: 'usr_seller_1',
        shippingMethod: 'PICKUP',
        status: 'SCHEDULED',
        scheduleConfirmedByBuyer: false,
        scheduledAt,
      });

      await expect(
        reportMissedMeeting('ord_pickup_1', 'usr_seller_1', mockDb)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'SCHEDULE_NOT_CONFIRMED_BY_BUYER',
      });
    });

    it('กรณีเลยเวลานัดหมายเกิน 15 นาที และผู้ซื้อยืนยันนัดแล้ว: บันทึกรายงานสำเร็จ', async () => {
      // นัดหมายตอน 16:00 (เลยมาแล้ว 60 นาที)
      const scheduledAt = new Date(Date.now() - 60 * 60 * 1000);

      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_pickup_1',
        sellerId: 'usr_seller_1',
        shippingMethod: 'PICKUP',
        status: 'SCHEDULED',
        scheduleConfirmedByBuyer: true,
        scheduledAt,
      });
      mockDb.order.update.mockResolvedValue({});

      const result = await reportMissedMeeting('ord_pickup_1', 'usr_seller_1', mockDb);

      expect(result.status).toBe('DISPUTED');
      expect(result.missedMeetingReportedAt).toBeDefined();
      expect(mockDb.order.update).toHaveBeenCalledWith({
        where: { id: 'ord_pickup_1' },
        data: expect.objectContaining({
          status: 'DISPUTED',
          disputeOpenedBy: 'SELLER',
          missedMeetingReportedAt: expect.any(Date),
        }),
      });
    });

    it('บล็อก verifyOrderPaymentSlip หากออเดอร์เป็นแบบ COD (COD_ORDER_NO_SLIP)', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_cod_block',
        buyerId: 'usr_buyer_1',
        sellerId: 'usr_seller_1',
        shippingMethod: 'DELIVERY',
        paymentMethod: 'COD',
        status: 'ACCEPTED',
        totalPrice: 215,
        seller: { verifiedName: 'นนทภัทร สุขใจ' },
      });

      await expect(
        verifyOrderPaymentSlip(
          'ord_cod_block',
          'usr_buyer_1',
          {
            slipImageUrl: 'https://storage/slip.webp',
            transRef: 'REF_COD_TEST',
            amount: 215,
            receiverName: 'นนทภัทร สุขใจ',
          },
          mockDb
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'COD_ORDER_NO_SLIP',
      });
    });

    it('PDPA E4 & Review Mapping: ผู้ขายต้องไม่เห็น buyer.phoneNumber ในทุกสถานะ และ getOrderDetail คืนค่า missedMeetingReportedAt กับ review', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'ord_pdpa_detail_1',
        buyerId: 'usr_buyer_1',
        sellerId: 'usr_seller_1',
        shippingMethod: 'DELIVERY',
        paymentMethod: 'COD',
        shippingFee: 35,
        totalPrice: 235,
        status: 'COMPLETED',
        pickupLat: null,
        pickupLng: null,
        pickupLocationName: null,
        scheduledAt: null,
        scheduleDateIso: null,
        scheduleTimeLabel: null,
        scheduleProposedBy: null,
        scheduleConfirmedByBuyer: false,
        handoverCode: null,
        receivedPhotoUrl: 'https://storage/rec.webp',
        receivedAt: new Date(),
        missedMeetingReportedAt: new Date('2026-11-12T10:00:00Z'),
        cancelReason: null,
        disputeReason: null,
        disputeOpenedBy: null,
        disputedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        buyer: {
          id: 'usr_buyer_1',
          nickname: 'นัท',
          avatarUrl: 'https://img/buyer.webp',
          phoneNumber: '0891112222',
          noShowCount: 1,
        },
        seller: {
          id: 'usr_seller_1',
          nickname: 'ร้านหนังสือ',
          avatarUrl: null,
          promptpayId: null,
          verifiedName: 'สมหญิง จริงใจ',
          isVerifiedSeller: true,
          shopProfile: { shopName: 'ร้านหนังสือดี' },
        },
        deliveryDetail: {
          recipientName: 'นัท ใจดี',
          recipientPhone: '0891112222',
          province: 'เชียงใหม่',
          deliveryAddress: '123 ถ.สุเทพ',
          courierName: 'Flash',
          trackingNumber: 'TH999',
          parcelImageUrl: null,
          shippedAt: new Date(),
        },
        reviews: [
          {
            reviewerId: 'usr_buyer_1',
            rating: 5,
            isConditionAccurate: true,
            tags: ['สภาพดีมาก'],
            comment: 'ห่อดีมากครับ',
            createdAt: new Date('2026-11-12T12:00:00Z'),
          },
        ],
        orderItems: [
          {
            bookListingId: 'bok_1',
            price: 200,
            bookListing: {
              grade: 'LIKE_NEW',
              bookCatalog: { title: 'Clean Architecture', coverUrl: 'https://img/book.webp' },
              images: [],
            },
          },
        ],
      });

      const sellerView = await getOrderDetail('ord_pdpa_detail_1', 'usr_seller_1', mockDb);
      expect(sellerView.buyer.phoneNumber).toBeNull();
      expect(sellerView.deliveryDetails).toBeNull();
      expect(sellerView.missedMeetingReportedAt).toEqual(new Date('2026-11-12T10:00:00Z'));
      expect(sellerView.review).toMatchObject({
        rating: 5,
        isConditionAccurate: true,
        tags: ['สภาพดีมาก'],
        comment: 'ห่อดีมากครับ',
      });
    });
  });
});
