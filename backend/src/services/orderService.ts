import crypto from 'crypto';
import { prisma as defaultPrisma } from '../config/prisma';
import {
  AcceptOrderResult,
  AppError,
  CreateOrderInput,
  CreateOrderResult,
  OrderDetail,
  OrderSummaryItem,
  PaymentSlipInput,
  SchedulePickupInput,
  SchedulePickupResult,
  ShipOrderInput,
  VerifyHandoverResult,
} from '../types';

/**
 * สุ่มสร้างรหัสส่งมอบ 6 หลัก (000000-999999) แบบปลอดภัยด้วย CSPRNG
 */
export function generateHandoverCode(): string {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

/**
 * ผู้ซื้อส่งคำขอซื้อสินค้าจากตะกร้า (POST /api/orders)
 * - 1 ตะกร้า = 1 ร้านค้า
 * - จำกัดคำขอค้าง REQUESTED ไม่เกิน 3 ออเดอร์
 * - คำนวณค่าส่ง: PICKUP = ฿0, DELIVERY = ฿40 เล่มแรก + ฿10 เล่มถัดไป
 * - หนังสือไม่ล็อกในขั้นตอนนี้ (ยังคง AVAILABLE)
 */
export async function createOrder(
  buyerId: string,
  input: CreateOrderInput,
  prismaClient?: any
): Promise<CreateOrderResult> {
  const db = prismaClient || defaultPrisma;

  if (!input.bookIds || input.bookIds.length === 0) {
    throw new AppError('กรุณาเลือกหนังสืออย่างน้อย 1 เล่ม', 400, 'EMPTY_CART');
  }

  if (buyerId === input.sellerId) {
    throw new AppError('คุณไม่สามารถสั่งซื้อหนังสือของตนเองได้', 400, 'CANNOT_BUY_OWN_BOOK');
  }

  // 1. ตรวจสอบข้อมูลผู้ซื้อ
  const buyer = await db.user.findUnique({
    where: { id: buyerId },
    select: { id: true, phoneNumber: true },
  });

  if (!buyer) {
    throw new AppError('ไม่พบบัญชีผู้ซื้อในระบบ', 404, 'USER_NOT_FOUND');
  }

  if (!buyer.phoneNumber) {
    throw new AppError(
      'กรุณาบันทึกเบอร์โทรศัพท์ในหน้าข้อมูลส่วนตัวก่อนเริ่มสั่งซื้อ',
      400,
      'PHONE_NUMBER_REQUIRED'
    );
  }

  // 2. ตรวจสอบโควต้าค้างคำขอ (REQUESTED <= 3)
  const pendingCount = await db.order.count({
    where: {
      buyerId,
      status: 'REQUESTED',
    },
  });

  if (pendingCount >= 3) {
    throw new AppError(
      'คุณมีคำขอซื้อที่รอการตอบรับครบ 3 ออเดอร์แล้ว กรุณารอร้านค้าตอบรับหรือยกเลิกคำขอเดิม',
      400,
      'TOO_MANY_PENDING_REQUESTS'
    );
  }

  // 3. ตรวจสอบรายการหนังสือ
  const books = await db.bookListing.findMany({
    where: {
      id: { in: input.bookIds },
    },
  });

  if (books.length !== input.bookIds.length) {
    throw new AppError('ไม่พบหนังสือบางเล่มในระบบ', 404, 'BOOK_NOT_FOUND');
  }

  // ตรวจสอบกฎ 1 ตะกร้า = 1 ร้านค้า
  const differentSeller = books.find((b: any) => b.sellerId !== input.sellerId);
  if (differentSeller) {
    throw new AppError(
      '1 ตะกร้าต้องเป็นหนังสือจากร้านเดียวกันเท่านั้น',
      400,
      'MULTIPLE_SELLERS_IN_CART'
    );
  }

  // ตรวจสอบสถานะหนังสือต้องเป็น AVAILABLE
  const unavailable = books.find((b: any) => b.status !== 'AVAILABLE');
  if (unavailable) {
    throw new AppError(
      'หนังสือบางเล่มในตะกร้าถูกจองหรือขายไปแล้ว',
      400,
      'BOOK_NOT_AVAILABLE'
    );
  }

  // 4. ตรวจสอบความสอดคล้องของวิธีจัดส่ง
  if (input.shippingMethod === 'DELIVERY') {
    const notAllowDelivery = books.find((b: any) => !b.allowDelivery);
    if (notAllowDelivery) {
      throw new AppError('หนังสือบางเล่มในตะกร้าไม่สะดวกจัดส่งพัสดุ', 400, 'DELIVERY_NOT_ALLOWED');
    }
    if (!input.recipientName || !input.recipientPhone || !input.deliveryAddress) {
      throw new AppError(
        'กรุณาระบุชื่อผู้รับ เบอร์โทรศัพท์ และที่อยู่จัดส่งพัสดุให้ครบถ้วน',
        400,
        'MISSING_DELIVERY_DETAILS'
      );
    }
  } else if (input.shippingMethod === 'PICKUP') {
    const notAllowPickup = books.find((b: any) => !b.allowPickup);
    if (notAllowPickup) {
      throw new AppError('หนังสือบางเล่มในตะกร้าไม่สะดวกนัดรับ', 400, 'PICKUP_NOT_ALLOWED');
    }
  } else {
    throw new AppError('วิธีการจัดส่งไม่ถูกต้อง', 400, 'INVALID_SHIPPING_METHOD');
  }

  // 5. คำนวณค่าส่งและยอดรวม
  const booksPrice = books.reduce((sum: number, b: any) => sum + Number(b.price), 0);
  const shippingFee = input.shippingMethod === 'DELIVERY' ? 40 + (books.length - 1) * 10 : 0;
  const totalPrice = booksPrice + shippingFee;

  // 6. บันทึกลงฐานข้อมูล
  return await db.$transaction(async (tx: any) => {
    const order = await tx.order.create({
      data: {
        buyerId,
        sellerId: input.sellerId,
        shippingMethod: input.shippingMethod,
        shippingFee,
        totalPrice,
        status: 'REQUESTED',
        pickupLat: input.pickupLat ?? null,
        pickupLng: input.pickupLng ?? null,
        pickupLocationName: input.pickupLocationName ?? null,
        orderItems: {
          create: books.map((b: any) => ({
            bookListingId: b.id,
            price: b.price,
          })),
        },
        deliveryDetail:
          input.shippingMethod === 'DELIVERY'
            ? {
                create: {
                  recipientName: input.recipientName!,
                  recipientPhone: input.recipientPhone!,
                  deliveryAddress: input.deliveryAddress!,
                },
              }
            : undefined,
      },
    });

    return {
      orderId: order.id,
      totalPrice: Number(order.totalPrice),
      shippingFee: Number(order.shippingFee),
      status: 'REQUESTED',
      createdAt: order.createdAt,
    };
  });
}

/**
 * ดูรายละเอียดคำสั่งซื้อ (GET /api/orders/:id)
 * มี Logic ปกป้องข้อมูลส่วนบุคคล (PDPA) ซ่อนที่อยู่และเบอร์ผู้รับตามสถานะ
 */
export async function getOrderDetail(
  orderId: string,
  userId: string,
  prismaClient?: any
): Promise<OrderDetail> {
  const db = prismaClient || defaultPrisma;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: true,
      seller: true,
      deliveryDetail: true,
      orderItems: {
        include: {
          bookListing: {
            include: {
              bookCatalog: true,
              images: {
                orderBy: [{ isCover: 'desc' }, { displayOrder: 'asc' }],
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  if (userId !== order.buyerId && userId !== order.sellerId) {
    throw new AppError('คุณไม่มีสิทธิ์ดูคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  const isSeller = userId === order.sellerId;
  const isBuyer = userId === order.buyerId;

  // กฎ PDPA:
  // ผู้ขายจะเห็นที่อยู่จัดส่งและเบอร์ผู้รับเฉพาะเมื่อสถานะเป็น PAID หรือ SHIPPED
  // ผู้ซื้อเห็นที่อยู่ของตนเองได้เสมอ
  let safeDeliveryDetails = null;
  if (order.deliveryDetail) {
    if (isBuyer) {
      safeDeliveryDetails = {
        recipientName: order.deliveryDetail.recipientName,
        recipientPhone: order.deliveryDetail.recipientPhone,
        deliveryAddress: order.deliveryDetail.deliveryAddress,
        courierName: order.deliveryDetail.courierName,
        trackingNumber: order.deliveryDetail.trackingNumber,
        parcelImageUrl: order.deliveryDetail.parcelImageUrl,
        shippedAt: order.deliveryDetail.shippedAt,
      };
    } else if (isSeller && (order.status === 'PAID' || order.status === 'SHIPPED')) {
      safeDeliveryDetails = {
        recipientName: order.deliveryDetail.recipientName,
        recipientPhone: order.deliveryDetail.recipientPhone,
        deliveryAddress: order.deliveryDetail.deliveryAddress,
        courierName: order.deliveryDetail.courierName,
        trackingNumber: order.deliveryDetail.trackingNumber,
        parcelImageUrl: order.deliveryDetail.parcelImageUrl,
        shippedAt: order.deliveryDetail.shippedAt,
      };
    }
  }

  // ซ่อนเบอร์โทรศัพท์ของผู้ซื้อเมื่อยังไม่ได้รับออเดอร์
  const safeBuyerPhone =
    isBuyer || (isSeller && (order.status === 'PAID' || order.status === 'SHIPPED'))
      ? order.buyer.phoneNumber
      : null;

  return {
    id: order.id,
    status: order.status,
    shippingMethod: order.shippingMethod,
    shippingFee: Number(order.shippingFee),
    totalPrice: Number(order.totalPrice),
    pickupLat: order.pickupLat !== null ? Number(order.pickupLat) : null,
    pickupLng: order.pickupLng !== null ? Number(order.pickupLng) : null,
    pickupLocationName: order.pickupLocationName,
    scheduledAt: order.scheduledAt,
    handoverCode: isBuyer || order.status === 'COMPLETED' ? order.handoverCode : null,
    items: order.orderItems.map((item: any) => ({
      bookId: item.bookListingId,
      title: item.bookListing.bookCatalog.title,
      price: Number(item.price),
      coverImageUrl:
        item.bookListing.images[0]?.imageUrl ||
        item.bookListing.bookCatalog.coverUrl ||
        '',
    })),
    buyer: {
      id: order.buyer.id,
      nickname: order.buyer.nickname || 'ผู้ซื้อกองดอง',
      avatarUrl: order.buyer.avatarUrl,
      phoneNumber: safeBuyerPhone,
    },
    seller: {
      id: order.seller.id,
      nickname: order.seller.nickname || 'ร้านค้ากองดอง',
      avatarUrl: order.seller.avatarUrl,
      promptpayId: order.seller.promptpayId,
      verifiedName: order.seller.verifiedName,
      isVerifiedSeller: order.seller.isVerifiedSeller,
    },
    deliveryDetails: safeDeliveryDetails,
    createdAt: order.createdAt,
  };
}

/**
 * ดึงรายการคำสั่งซื้อของผู้ใช้ (GET /api/users/me/orders)
 */
export async function getUserOrders(
  userId: string,
  role?: 'buying' | 'selling',
  prismaClient?: any
): Promise<{ buying?: OrderSummaryItem[]; selling?: OrderSummaryItem[] }> {
  const db = prismaClient || defaultPrisma;

  const result: { buying?: OrderSummaryItem[]; selling?: OrderSummaryItem[] } = {};

  if (!role || role === 'buying') {
    const buyingOrders = await db.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { nickname: true } },
        orderItems: { select: { id: true } },
      },
    });

    result.buying = buyingOrders.map((o: any) => ({
      id: o.id,
      status: o.status,
      shippingMethod: o.shippingMethod,
      totalPrice: Number(o.totalPrice),
      itemsCount: o.orderItems.length,
      sellerNickname: o.seller.nickname || 'ร้านค้ากองดอง',
      createdAt: o.createdAt,
    }));
  }

  if (!role || role === 'selling') {
    const sellingOrders = await db.order.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { nickname: true } },
        orderItems: { select: { id: true } },
      },
    });

    result.selling = sellingOrders.map((o: any) => ({
      id: o.id,
      status: o.status,
      shippingMethod: o.shippingMethod,
      totalPrice: Number(o.totalPrice),
      itemsCount: o.orderItems.length,
      buyerNickname: o.buyer.nickname || 'ผู้ซื้อกองดอง',
      createdAt: o.createdAt,
    }));
  }

  return result;
}

/**
 * Transaction ผู้ขายกดรับออเดอร์ (acceptOrder)
 */
export async function acceptOrder(
  orderId: string,
  sellerId: string,
  prismaClient?: any
): Promise<AcceptOrderResult> {
  const db = prismaClient || defaultPrisma;

  return await db.$transaction(async (tx: any) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        seller: true,
        orderItems: {
          include: { bookListing: true },
        },
      },
    });

    if (!order) {
      throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
    }

    if (order.sellerId !== sellerId) {
      throw new AppError('คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้', 403, 'FORBIDDEN');
    }

    if (order.status !== 'REQUESTED') {
      throw new AppError(
        `ไม่สามารถรับออเดอร์นี้ได้เนื่องจากสถานะปัจจุบันคือ ${order.status}`,
        400,
        'INVALID_ORDER_STATUS'
      );
    }

    if (!order.seller.isVerifiedSeller) {
      throw new AppError(
        'ผู้ขายยังไม่ได้ยืนยันบัญชีรับเงิน (Frictionless KYC) ให้เติมเงินเพื่อดึงชื่อยืนยันก่อน',
        400,
        'SELLER_NOT_VERIFIED'
      );
    }

    if (order.seller.credits < 1) {
      throw new AppError(
        'เครดิตไม่เพียงพอสำหรับการรับคำสั่งซื้อ กรุณาเติมเครดิตก่อน',
        400,
        'INSUFFICIENT_CREDITS'
      );
    }

    const bookListingIds = order.orderItems.map((item: any) => item.bookListingId);
    const unavailableBooks = order.orderItems.filter(
      (item: any) => item.bookListing.status !== 'AVAILABLE'
    );

    if (unavailableBooks.length > 0) {
      throw new AppError(
        'หนังสือในคำสั่งซื้อนี้ถูกจองหรือขายไปแล้ว',
        400,
        'BOOK_NOT_AVAILABLE'
      );
    }

    const updatedSeller = await tx.user.update({
      where: { id: sellerId },
      data: {
        credits: { decrement: 1 },
      },
      select: { credits: true },
    });

    await tx.creditTransaction.create({
      data: {
        userId: sellerId,
        amount: -1,
        type: 'ORDER_ACCEPT',
        orderId: order.id,
      },
    });

    await tx.bookListing.updateMany({
      where: { id: { in: bookListingIds } },
      data: { status: 'RESERVED' },
    });

    const competingOrderItems = await tx.orderItem.findMany({
      where: {
        bookListingId: { in: bookListingIds },
        orderId: { not: orderId },
        order: {
          status: 'REQUESTED',
        },
      },
      select: { orderId: true },
    });

    const rejectedOrderIds: string[] = Array.from(
      new Set(competingOrderItems.map((item: any) => item.orderId))
    );

    if (rejectedOrderIds.length > 0) {
      await tx.order.updateMany({
        where: {
          id: { in: rejectedOrderIds },
          status: 'REQUESTED',
        },
        data: {
          status: 'REJECTED',
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'ACCEPTED' },
    });

    return {
      orderId,
      status: 'ACCEPTED',
      remainingCredits: updatedSeller.credits,
      lockedBookIds: bookListingIds,
      rejectedOrderIds,
    };
  });
}

/**
 * ผู้ขายปฏิเสธคำขอซื้อ (POST /api/orders/:id/reject)
 * ไม่เสียเครดิต และหนังสือยังคง AVAILABLE
 */
export async function rejectOrder(
  orderId: string,
  sellerId: string,
  prismaClient?: any
): Promise<{ orderId: string; status: 'REJECTED' }> {
  const db = prismaClient || defaultPrisma;

  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  if (order.sellerId !== sellerId) {
    throw new AppError('คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  if (order.status !== 'REQUESTED') {
    throw new AppError(
      `ไม่สามารถปฏิเสธคำสั่งซื้อที่สถานะเป็น ${order.status} ได้`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  await db.order.update({
    where: { id: orderId },
    data: { status: 'REJECTED' },
  });

  return {
    orderId,
    status: 'REJECTED',
  };
}

/**
 * ผู้ซื้อแนบสลิปชำระเงินค่าหนังสือ (POST /api/orders/:id/payment-slip)
 */
export async function verifyOrderPaymentSlip(
  orderId: string,
  buyerId: string,
  input: PaymentSlipInput,
  prismaClient?: any
): Promise<{ status: 'PAID'; verificationStatus: string; transRef: string }> {
  const db = prismaClient || defaultPrisma;

  if (!input.slipImageUrl) {
    throw new AppError('กรุณาแนบรูปลิงก์สลิปโอนเงิน (slipImageUrl)', 400, 'MISSING_SLIP_IMAGE');
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { seller: true },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  if (order.buyerId !== buyerId) {
    throw new AppError('คุณไม่ใช่ผู้ซื้อของคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  if (order.shippingMethod !== 'DELIVERY') {
    throw new AppError('การแนบสลิปชำระเงินใช้สำหรับโหมดจัดส่งพัสดุเท่านั้น', 400, 'INVALID_SHIPPING_METHOD');
  }

  if (order.status !== 'ACCEPTED') {
    throw new AppError(
      `คำสั่งซื้อต้องอยู่ในสถานะ ACCEPTED เท่านั้นจึงจะชำระเงินได้ (สถานะปัจจุบัน: ${order.status})`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  const transRef = input.transRef || `REF_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // ตรวจสอบ Anti-Replay: เลขอ้างอิงสลิปต้องไม่เคยใช้งานมาก่อน
  const existingSlip = await db.paymentSlip.findUnique({
    where: { transRef },
  });

  if (existingSlip) {
    throw new AppError('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)', 400, 'DUPLICATE_SLIP');
  }

  // ตรวจสอบยอดเงิน
  const slipAmount = input.amount !== undefined ? Number(input.amount) : Number(order.totalPrice);
  if (Math.abs(slipAmount - Number(order.totalPrice)) > 0.01) {
    throw new AppError('ยอดเงินในสลิปไม่ตรงกับยอดรวมของคำสั่งซื้อ', 400, 'SLIP_AMOUNT_MISMATCH');
  }

  // ตรวจสอบชื่อบัญชีผู้รับ (ถ้ามีส่งมา)
  if (input.receiverName && order.seller.verifiedName) {
    const cleanReceiver = input.receiverName.replace(/\s+/g, '');
    const cleanSellerVerified = order.seller.verifiedName.replace(/\s+/g, '');
    if (!cleanReceiver.includes(cleanSellerVerified) && !cleanSellerVerified.includes(cleanReceiver)) {
      throw new AppError('ชื่อผู้รับเงินในสลิปไม่ตรงกับชื่อยืนยันของผู้ขาย', 400, 'SLIP_RECEIVER_MISMATCH');
    }
  }

  // บันทึกสลิปและปรับสถานะเป็น PAID
  await db.$transaction(async (tx: any) => {
    await tx.paymentSlip.create({
      data: {
        userId: buyerId,
        orderId,
        slipType: 'ORDER_PAYMENT',
        slipImageUrl: input.slipImageUrl,
        transRef,
        amount: slipAmount,
        receiverName: input.receiverName || order.seller.verifiedName,
        verificationStatus: 'AUTO_VERIFIED',
        verifiedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });
  });

  return {
    status: 'PAID',
    verificationStatus: 'AUTO_VERIFIED',
    transRef,
  };
}

/**
 * ผู้ขายบันทึกข้อมูลจัดส่งพัสดุ (POST /api/orders/:id/ship)
 */
export async function shipOrder(
  orderId: string,
  sellerId: string,
  input: ShipOrderInput,
  prismaClient?: any
): Promise<{ orderId: string; status: 'SHIPPED'; trackingNumber: string }> {
  const db = prismaClient || defaultPrisma;

  if (!input.courierName || !input.trackingNumber) {
    throw new AppError('กรุณาระบุชื่อบริษัทขนส่งและหมายเลขพัสดุ', 400, 'MISSING_REQUIRED_FIELDS');
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  if (order.sellerId !== sellerId) {
    throw new AppError('คุณไม่ใช่ผู้ขายของคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  if (order.shippingMethod !== 'DELIVERY') {
    throw new AppError('คำสั่งซื้อนี้ไม่ได้ใช้วิธีจัดส่งพัสดุ', 400, 'INVALID_SHIPPING_METHOD');
  }

  if (order.status !== 'PAID') {
    throw new AppError(
      `ออเดอร์ต้องอยู่ในสถานะ PAID เท่านั้นจึงจะจัดส่งได้ (สถานะปัจจุบัน: ${order.status})`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  await db.$transaction(async (tx: any) => {
    await tx.orderDeliveryDetail.update({
      where: { orderId },
      data: {
        courierName: input.courierName,
        trackingNumber: input.trackingNumber,
        parcelImageUrl: input.parcelImageUrl || null,
        shippedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
    });
  });

  return {
    orderId,
    status: 'SHIPPED',
    trackingNumber: input.trackingNumber,
  };
}

/**
 * ผู้ซื้อกดยืนยันได้รับพัสดุแล้ว (POST /api/orders/:id/complete-delivery)
 */
export async function completeDeliveryOrder(
  orderId: string,
  buyerId: string,
  prismaClient?: any
): Promise<{ orderId: string; status: 'COMPLETED' }> {
  const db = prismaClient || defaultPrisma;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { orderItems: true },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  if (order.buyerId !== buyerId) {
    throw new AppError('คุณไม่ใช่ผู้ซื้อของคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  if (order.shippingMethod !== 'DELIVERY') {
    throw new AppError('คำสั่งซื้อนี้ไม่ได้ใช้วิธีจัดส่งพัสดุ', 400, 'INVALID_SHIPPING_METHOD');
  }

  if (order.status !== 'SHIPPED') {
    throw new AppError(
      `ออเดอร์ต้องอยู่ในสถานะ SHIPPED เท่านั้นจึงจะยืนยันรับของได้ (สถานะปัจจุบัน: ${order.status})`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  await db.$transaction(async (tx: any) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });

    const bookListingIds = order.orderItems.map((item: any) => item.bookListingId);
    await tx.bookListing.updateMany({
      where: { id: { in: bookListingIds } },
      data: { status: 'SOLD' },
    });
  });

  return {
    orderId,
    status: 'COMPLETED',
  };
}

/**
 * ผู้ขายกดรายงานว่า "ผู้ซื้อไม่มาตามนัด" (POST /api/orders/:id/report-missed-meeting)
 */
export async function reportMissedMeeting(
  orderId: string,
  sellerId: string,
  prismaClient?: any
): Promise<{ orderId: string; missedMeetingReportedAt: Date }> {
  const db = prismaClient || defaultPrisma;

  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  if (order.sellerId !== sellerId) {
    throw new AppError('คุณไม่ใช่ผู้ขายของคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  if (order.shippingMethod !== 'PICKUP') {
    throw new AppError('การรายงานไม่มาตามนัดใช้สำหรับโหมดนัดรับเท่านั้น', 400, 'INVALID_SHIPPING_METHOD');
  }

  if (order.status !== 'SCHEDULED') {
    throw new AppError(
      `ออเดอร์ต้องอยู่ในสถานะ SCHEDULED เท่านั้น (สถานะปัจจุบัน: ${order.status})`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  if (!order.scheduledAt) {
    throw new AppError('ยังไม่ได้ระบุวันเวลานัดหมาย', 400, 'NOT_SCHEDULED');
  }

  // กดได้เมื่อเลยเวลานัดหมายไปแล้วอย่างน้อย 15 นาที
  const scheduledTime = new Date(order.scheduledAt).getTime();
  const eligibleTime = scheduledTime + 15 * 60 * 1000;
  const now = Date.now();

  if (now < eligibleTime) {
    throw new AppError(
      'ยังไม่ถึงเวลานัดหมาย + 15 นาที จึงยังไม่สามารถกดรายงานไม่มาตามนัดได้',
      400,
      'TOO_EARLY_FOR_NO_SHOW'
    );
  }

  const missedMeetingReportedAt = new Date();

  await db.order.update({
    where: { id: orderId },
    data: { missedMeetingReportedAt },
  });

  return {
    orderId,
    missedMeetingReportedAt,
  };
}

/**
 * ยืนยันวันเวลานัดหมายและพิกัดนัดพบ (schedulePickupOrder)
 */
export async function schedulePickupOrder(
  orderId: string,
  userId: string,
  input: SchedulePickupInput,
  prismaClient?: any
): Promise<SchedulePickupResult> {
  const db = prismaClient || defaultPrisma;

  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  if (order.buyerId !== userId && order.sellerId !== userId) {
    throw new AppError('คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  if (order.shippingMethod !== 'PICKUP') {
    throw new AppError(
      'คำสั่งซื้อนี้ไม่ได้ใช้วิธีนัดรับสินค้า (PICKUP)',
      400,
      'INVALID_SHIPPING_METHOD'
    );
  }

  if (order.status !== 'ACCEPTED' && order.status !== 'SCHEDULED') {
    throw new AppError(
      `ไม่สามารถบันทึกนัดหมายได้เนื่องจากสถานะปัจจุบันคือ ${order.status}`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  const handoverCode = order.handoverCode || generateHandoverCode();
  const scheduledAt = new Date(input.scheduledAt);

  if (isNaN(scheduledAt.getTime())) {
    throw new AppError('วันเวลานัดหมาย (scheduledAt) ไม่ถูกต้อง', 400, 'INVALID_DATE');
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      status: 'SCHEDULED',
      scheduledAt,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      pickupLocationName: input.pickupLocationName || null,
      handoverCode,
    },
  });

  return {
    orderId,
    status: 'SCHEDULED',
    scheduledAt,
    handoverCode,
  };
}

/**
 * ผู้ขายกรอกรหัสส่งมอบ 6 หลักเพื่อปิดการขาย (verifyHandoverCode)
 */
export async function verifyHandoverCode(
  orderId: string,
  sellerId: string,
  handoverCode: string,
  prismaClient?: any
): Promise<VerifyHandoverResult> {
  const db = prismaClient || defaultPrisma;

  return await db.$transaction(async (tx: any) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
    }

    if (order.sellerId !== sellerId) {
      throw new AppError('คุณไม่ใช่ผู้ขายของคำสั่งซื้อนี้', 403, 'FORBIDDEN');
    }

    if (order.shippingMethod !== 'PICKUP') {
      throw new AppError(
        'คำสั่งซื้อนี้ไม่ได้ใช้วิธีนัดรับสินค้า (PICKUP)',
        400,
        'INVALID_SHIPPING_METHOD'
      );
    }

    if (order.status !== 'SCHEDULED') {
      throw new AppError(
        `ออเดอร์ต้องอยู่ในสถานะ SCHEDULED เท่านั้นเพื่อตรวจรหัสส่งมอบ (สถานะปัจจุบัน: ${order.status})`,
        400,
        'INVALID_ORDER_STATUS'
      );
    }

    const cleanInputCode = (handoverCode || '').trim();
    if (!cleanInputCode || cleanInputCode !== order.handoverCode) {
      throw new AppError(
        'รหัสส่งมอบ 6 หลักไม่ถูกต้อง ให้ผู้ขายตรวจดูรหัสบนหน้าจอลูกค้าอีกครั้ง',
        400,
        'INVALID_HANDOVER_CODE'
      );
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });

    const soldBookIds = order.orderItems.map((item: any) => item.bookListingId);
    await tx.bookListing.updateMany({
      where: { id: { in: soldBookIds } },
      data: { status: 'SOLD' },
    });

    return {
      orderId,
      status: 'COMPLETED',
      soldBookIds,
    };
  });
}
