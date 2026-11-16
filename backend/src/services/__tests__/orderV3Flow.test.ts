import { describe, expect, it, vi } from 'vitest';
import {
  cancelOrder,
  completeMeetupCodOrder,
  createOrder,
  disputeMissedMeeting,
  getOrderPaymentQR,
  openDispute,
  receiveOrder,
  shipOrder,
  verifyHandoverCode,
} from '../orderService';
import { createBookListing, updateBookListing } from '../bookService';

describe('v3.0.0 Flows (Dual Payment COD, Cancel, Receive, Dispute, Book Set/INNER)', () => {
  it('คำนวณค่าส่งแบบ Flat Base ใน createOrder: เชียงใหม่ -> กรุงเทพฯ 2 เล่ม = ฿50 + ฿10 = ฿60', async () => {
    const tx = {
      order: {
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: 'ord-cross-1',
          ...data,
          createdAt: new Date(),
        })),
      },
    };
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'buyer-1', phoneNumber: null }) },
      order: { count: vi.fn().mockResolvedValue(0) },
      bookListing: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'b1', sellerId: 'seller-1', status: 'AVAILABLE', allowDelivery: true, codEnabled: true, price: 150 },
          { id: 'b2', sellerId: 'seller-1', status: 'AVAILABLE', allowDelivery: true, codEnabled: true, price: 200 },
        ]),
      },
      shopProfile: { findUnique: vi.fn().mockResolvedValue({ province: 'เชียงใหม่' }) },
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };

    const result = await createOrder(
      'buyer-1',
      {
        sellerId: 'seller-1',
        bookIds: ['b1', 'b2'],
        shippingMethod: 'DELIVERY',
        paymentMethod: 'COD',
        recipientName: 'สมชาย',
        buyerProvince: 'กรุงเทพมหานคร',
        deliveryAddress: 'สยาม',
      },
      db
    );

    expect(result.shippingFee).toBe(60);
    expect(result.totalPrice).toBe(410);
    expect(result.paymentMethod).toBe('COD');
  });

  it('COD Parcel: ผู้ขาย shipOrder ได้ตั้งแต่สถานะ ACCEPTED และผู้ซื้อปิดงานด้วย receiveOrder + inline review', async () => {
    const shipTx = {
      orderDeliveryDetail: { update: vi.fn() },
      order: { update: vi.fn() },
      orderMessage: { create: vi.fn() },
    };
    const shipDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-cod-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          shippingMethod: 'DELIVERY',
          paymentMethod: 'COD',
          status: 'ACCEPTED',
        }),
      },
      $transaction: vi.fn(async (cb: any) => cb(shipTx)),
    };

    const shipped = await shipOrder(
      'ord-cod-1',
      'seller-1',
      { courierName: 'Flash Express', trackingNumber: 'TH123456' },
      shipDb
    );
    expect(shipped.status).toBe('SHIPPED');

    const receiveTx = {
      order: { update: vi.fn() },
      bookListing: { updateMany: vi.fn() },
      review: { create: vi.fn() },
      orderMessage: { create: vi.fn() },
    };
    const receiveDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-cod-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          shippingMethod: 'DELIVERY',
          status: 'SHIPPED',
          orderItems: [{ bookListingId: 'b1' }],
        }),
      },
      $transaction: vi.fn(async (cb: any) => cb(receiveTx)),
    };

    const received = await receiveOrder(
      'ord-cod-1',
      'buyer-1',
      {
        receivedPhotoUrl: 'https://storage.local/received.webp',
        review: {
          rating: 5,
          isConditionAccurate: true,
          tags: ['ส่งไว', 'แพ็คดี'],
          comment: 'เยี่ยมมาก',
        },
      },
      receiveDb
    );

    expect(received.status).toBe('COMPLETED');
    expect(receiveTx.bookListing.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1'] } },
      data: { status: 'SOLD' },
    });
    expect(receiveTx.review.create).toHaveBeenCalled();
  });

  it('COD Meetup: บล็อก completeMeetupCodOrder (HANDOVER_CODE_REQUIRED), ปิดด้วย verifyHandoverCode และรองรับ cancelOrder คืนหนังสือ + คืน 1 เครดิต', async () => {
    await expect(
      completeMeetupCodOrder('ord-m1', 'seller-1')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'HANDOVER_CODE_REQUIRED',
    });

    const completeTx = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-m1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          shippingMethod: 'PICKUP',
          status: 'SCHEDULED',
          handoverCode: '482910',
          orderItems: [{ bookListingId: 'b1' }],
        }),
        update: vi.fn(),
      },
      bookListing: { updateMany: vi.fn() },
      orderMessage: { create: vi.fn() },
    };
    const completeRes = await verifyHandoverCode(
      'ord-m1',
      'seller-1',
      '482910',
      { $transaction: vi.fn(async (cb: any) => cb(completeTx)) }
    );
    expect(completeRes.status).toBe('COMPLETED');
    expect(completeRes.soldBookIds).toEqual(['b1']);

    await expect(
      receiveOrder(
        'ord-m1',
        'buyer-1',
        { receivedPhotoUrl: 'https://storage/photo.webp' },
        {
          order: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'ord-m1',
              buyerId: 'buyer-1',
              sellerId: 'seller-1',
              shippingMethod: 'PICKUP',
              status: 'SCHEDULED',
              orderItems: [{ bookListingId: 'b1' }],
            }),
          },
        }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'PICKUP_USE_HANDOVER_CODE',
    });

    const cancelTx = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-c1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'ACCEPTED',
          orderItems: [{ bookListingId: 'b2' }],
        }),
        update: vi.fn(),
      },
      bookListing: { updateMany: vi.fn() },
      user: { update: vi.fn().mockResolvedValue({ credits: 4 }) },
      creditTransaction: { create: vi.fn() },
      orderMessage: { create: vi.fn() },
    };
    const cancelled = await cancelOrder(
      'ord-c1',
      'buyer-1',
      'เปลี่ยนใจไม่สะดวกรับแล้วครับ',
      { $transaction: vi.fn(async (cb: any) => cb(cancelTx)) }
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelTx.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 1, type: 'REFUND_CANCEL', userId: 'seller-1' }),
    });
    expect(cancelTx.bookListing.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b2'] } },
      data: { status: 'AVAILABLE' },
    });
  });

  it('Dispute & Missed Meeting Rebuttal: ผู้ซื้อโต้แย้งได้แม้ผู้ขายรายงาน No-show แล้วเปลี่ยนเป็น DISPUTED ทันที', async () => {
    const db = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-d1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'DISPUTED',
          disputeReason: 'ผู้ขายรายงานว่าผู้ซื้อไม่มาตามนัด',
          missedMeetingReportedAt: new Date(),
        }),
        update: vi.fn(),
      },
      orderMessage: { create: vi.fn() },
    };

    const disputeRes = await disputeMissedMeeting('ord-d1', 'buyer-1', 'รออยู่หน้าประตูหลังครับ', db);
    expect(disputeRes.status).toBe('DISPUTED');
    expect(disputeRes.disputeReason).toContain('[คำโต้แย้งจากผู้ซื้อ]: รออยู่หน้าประตูหลังครับ');

    const dbScheduled = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-d2',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'SHIPPED',
        }),
        update: vi.fn(),
      },
      orderMessage: { create: vi.fn() },
    };

    const openRes = await openDispute('ord-d2', 'seller-1', 'สินค้าเสียหายระหว่างขนส่ง', dbScheduled);
    expect(openRes.status).toBe('DISPUTED');
  });

  it('Book v3: ยอมรับมุมรูป INNER สำหรับขายยกชุด (isSet) และซ่อนประกาศผ่าน PATCH HIDDEN', async () => {
    const tx = {
      bookCatalog: { upsert: vi.fn() },
      bookListing: {
        create: vi.fn().mockResolvedValue({
          id: 'bok-set-1',
          category: 'มังงะ / นิยาย',
          categories: ['มังงะ / นิยาย'],
          isSet: true,
          price: 890,
          status: 'AVAILABLE',
          createdAt: new Date(),
        }),
      },
      bookListingImage: { createMany: vi.fn() },
    };
    const db = {
      $transaction: vi.fn(async (cb: any) => cb(tx)),
      bookListing: {
        findUnique: vi.fn().mockResolvedValue({ id: 'bok-set-1', sellerId: 'seller-1', status: 'AVAILABLE' }),
        update: vi.fn().mockResolvedValue({
          id: 'bok-set-1',
          price: 790,
          description: 'ลดราคา',
          categories: ['มังงะ / นิยาย'],
          status: 'HIDDEN',
          updatedAt: new Date(),
        }),
      },
    };

    const created = await createBookListing(
      'seller-1',
      {
        isbn: '9786160000001',
        title: 'One Piece Box Set',
        categories: ['มังงะ / นิยาย'],
        isSet: true,
        totalVolumes: 10,
        missingVolumes: [4],
        price: 890,
        conditionAnswers: {
          spine: false,
          stains: false,
          markings: false,
          covers: false,
          pages: false,
        },
        images: [
          { imageUrl: 'https://ex.com/1.webp', imageType: 'FRONT_COVER', displayOrder: 1, isCover: true },
          { imageUrl: 'https://ex.com/2.webp', imageType: 'BACK_COVER', displayOrder: 2 },
          { imageUrl: 'https://ex.com/3.webp', imageType: 'SPINE', displayOrder: 3 },
          { imageUrl: 'https://ex.com/4.webp', imageType: 'INNER', displayOrder: 4 },
        ],
      },
      db
    );
    expect(created.isSet).toBe(true);

    const updated = await updateBookListing(
      'bok-set-1',
      'seller-1',
      { price: 790, status: 'HIDDEN' },
      db
    );
    expect(updated.status).toBe('HIDDEN');
    expect(updated.price).toBe(790);
  });

  it('PromptPay QR สำหรับออเดอร์: สร้าง QR พร้อมชื่อผู้รับแบบ Masked และบล็อกออเดอร์ COD', async () => {
    const dbTransfer = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-qr-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          shippingMethod: 'DELIVERY',
          paymentMethod: 'TRANSFER',
          status: 'ACCEPTED',
          totalPrice: 350,
          seller: {
            nickname: 'ป้าหนอน',
            promptpayId: '0812345678',
            verifiedName: 'สมหญิง รักอ่าน',
            shopProfile: { shopName: 'ป้าหนอนหนังสือ' },
          },
        }),
      },
    };

    const qrRes = await getOrderPaymentQR('ord-qr-1', 'buyer-1', dbTransfer);
    expect(qrRes.orderId).toBe('ord-qr-1');
    expect(qrRes.amount).toBe(350);
    expect(qrRes.recipientLabel).toBe('สม••• รัก••• · ป้าหนอนหนังสือ');
    expect(qrRes.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(qrRes.payload).toContain('000201');

    const dbCod = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-qr-cod',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          shippingMethod: 'DELIVERY',
          paymentMethod: 'COD',
          status: 'ACCEPTED',
          totalPrice: 350,
          seller: { promptpayId: '0812345678' },
        }),
      },
    };

    await expect(getOrderPaymentQR('ord-qr-cod', 'buyer-1', dbCod)).rejects.toThrowError(
      /COD/
    );
  });
});
