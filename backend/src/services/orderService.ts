import crypto from 'crypto';
import { prisma as defaultPrisma } from '../config/prisma';
import { calcParcelFee } from './shippingService';
import { createSystemOrderMessage } from './messageService';
import { notifyOrderEvent } from './lineNotifyService';
import {
  AcceptOrderResult,
  AppError,
  CreateOrderInput,
  CreateOrderResult,
  OrderDetail,
  OrderSummaryItem,
  PaymentMethod,
  PaymentSlipInput,
  ReceiveOrderInput,
  SchedulePickupInput,
  SchedulePickupResult,
  ShipOrderInput,
  VerifyHandoverResult,
} from '../types';

type OrderAccessRole = 'BUYER' | 'SELLER' | 'PARTICIPANT';

interface OrderAccessOptions {
  role: OrderAccessRole;
  include?: any;
  forbiddenMessage?: string;
  shippingMethod?: 'PICKUP' | 'DELIVERY';
  shippingErrorMessage?: string;
  allowedStatuses?: string[];
  statusErrorBuilder?: (status: string) => string;
}

/**
 * สุ่มสร้างรหัสส่งมอบ 6 หลัก (000000-999999) แบบปลอดภัยด้วย CSPRNG
 */
export function generateHandoverCode(): string {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function normalizePaymentMethod(method?: string): PaymentMethod {
  if (!method || method === 'COD') return 'COD';
  if (method === 'TRANSFER') return 'TRANSFER';
  throw new AppError(
    'วิธีการชำระเงินไม่ถูกต้อง (รองรับ COD หรือ TRANSFER)',
    400,
    'INVALID_PAYMENT_METHOD'
  );
}

async function safeNotifyOrder(
  params: Parameters<typeof notifyOrderEvent>[0],
  db: any
) {
  if (!db?.notification?.create) return;
  await notifyOrderEvent(params, db);
}

// ponytail: single helper replaces 14 repeated findUnique + role + shippingMethod + status guards
async function loadAndAuthorizeOrder(
  db: any,
  orderId: string,
  userId: string,
  options: OrderAccessOptions
) {
  const query: any = { where: { id: orderId } };
  if (options.include) query.include = options.include;

  const order = await db.order.findUnique(query);
  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  const hasRole =
    options.role === 'BUYER'
      ? order.buyerId === userId
      : options.role === 'SELLER'
      ? order.sellerId === userId
      : order.buyerId === userId || order.sellerId === userId;

  if (!hasRole) {
    const defaultMsg =
      options.role === 'BUYER'
        ? 'คุณไม่ใช่ผู้ซื้อของคำสั่งซื้อนี้'
        : options.role === 'SELLER'
        ? 'คุณไม่ใช่ผู้ขายของคำสั่งซื้อนี้'
        : 'คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้';
    throw new AppError(options.forbiddenMessage || defaultMsg, 403, 'FORBIDDEN');
  }

  if (options.shippingMethod && order.shippingMethod !== options.shippingMethod) {
    const defaultShipMsg =
      options.shippingMethod === 'PICKUP'
        ? 'คำสั่งซื้อนี้ไม่ได้ใช้วิธีนัดรับสินค้า (PICKUP)'
        : 'คำสั่งซื้อนี้ไม่ได้ใช้วิธีจัดส่งพัสดุ';
    throw new AppError(
      options.shippingErrorMessage || defaultShipMsg,
      400,
      'INVALID_SHIPPING_METHOD'
    );
  }

  if (options.allowedStatuses && !options.allowedStatuses.includes(order.status)) {
    const msg = options.statusErrorBuilder
      ? options.statusErrorBuilder(order.status)
      : `ไม่สามารถดำเนินการในสถานะ ${order.status} ได้`;
    throw new AppError(msg, 400, 'INVALID_ORDER_STATUS');
  }

  return order;
}

// ponytail: shared order completion helper used by completeDelivery, receive, completeMeetup, verifyHandover
async function markOrderCompleted(
  tx: any,
  order: any,
  extraOrderData: Record<string, unknown> = {}
): Promise<string[]> {
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'COMPLETED', ...extraOrderData },
  });

  const soldBookIds = (order.orderItems || []).map((item: any) => item.bookListingId);
  if (soldBookIds.length > 0) {
    await tx.bookListing.updateMany({
      where: { id: { in: soldBookIds } },
      data: { status: 'SOLD' },
    });
  }

  return soldBookIds;
}

/**
 * ผู้ซื้อส่งคำขอซื้อสินค้าจากตะกร้า (POST /api/orders)
 * - 1 ตะกร้า = 1 ร้านค้า
 * - จำกัดคำขอค้าง REQUESTED ไม่เกิน 3 ออเดอร์
 * - รองรับ Dual Payment (COD / TRANSFER)
 * - คำนวณค่าส่งตามสูตร v4: PICKUP = ฿0, DELIVERY = ฿35 + ฿10*(N-1) + ฿15(ข้ามภาค)
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

  const paymentMethod = normalizePaymentMethod(input.paymentMethod);

  // 1. ตรวจสอบข้อมูลผู้ซื้อ (ไม่บังคับ phoneNumber ตามหลัก PDPA v4)
  const buyer = await db.user.findUnique({
    where: { id: buyerId },
    select: { id: true, phoneNumber: true },
  });

  if (!buyer) {
    throw new AppError('ไม่พบบัญชีผู้ซื้อในระบบ', 404, 'USER_NOT_FOUND');
  }

  // 2. ตรวจสอบโควต้าค้างคำขอ (REQUESTED <= 3)
  const pendingCount = await db.order.count({
    where: { buyerId, status: 'REQUESTED' },
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
    where: { id: { in: input.bookIds } },
  });

  if (books.length !== input.bookIds.length) {
    throw new AppError('ไม่พบหนังสือบางเล่มในระบบ', 404, 'BOOK_NOT_FOUND');
  }

  if (books.some((b: any) => b.sellerId !== input.sellerId)) {
    throw new AppError(
      '1 ตะกร้าต้องเป็นหนังสือจากร้านเดียวกันเท่านั้น',
      400,
      'MULTIPLE_SELLERS_IN_CART'
    );
  }

  if (books.some((b: any) => b.status !== 'AVAILABLE')) {
    throw new AppError(
      'หนังสือบางเล่มในตะกร้าถูกจองหรือขายไปแล้ว',
      400,
      'BOOK_NOT_AVAILABLE'
    );
  }

  if (paymentMethod === 'COD' && books.some((b: any) => b.codEnabled === false)) {
    throw new AppError(
      'หนังสือบางเล่มในตะกร้าไม่รองรับการเก็บเงินปลายทาง/จ่ายตอนรับ',
      400,
      'COD_NOT_ENABLED'
    );
  }

  // 4. ตรวจสอบวิธีจัดส่งและดึงจังหวัดร้านค้าสำหรับคำนวณค่าส่งข้ามภาค
  let sellerProvince: string | null = null;
  if (input.shippingMethod === 'DELIVERY') {
    if (books.some((b: any) => !b.allowDelivery)) {
      throw new AppError('หนังสือบางเล่มในตะกร้าไม่สะดวกจัดส่งพัสดุ', 400, 'DELIVERY_NOT_ALLOWED');
    }
    if (!input.recipientName || !input.deliveryAddress) {
      throw new AppError(
        'กรุณาระบุชื่อผู้รับและที่อยู่จัดส่งพัสดุให้ครบถ้วน',
        400,
        'MISSING_DELIVERY_DETAILS'
      );
    }
    if (db.shopProfile?.findUnique) {
      const shop = await db.shopProfile.findUnique({
        where: { userId: input.sellerId },
        select: { province: true },
      });
      sellerProvince = shop?.province ?? null;
    }
  } else if (input.shippingMethod === 'PICKUP') {
    if (books.some((b: any) => !b.allowPickup)) {
      throw new AppError('หนังสือบางเล่มในตะกร้าไม่สะดวกนัดรับ', 400, 'PICKUP_NOT_ALLOWED');
    }
  } else {
    throw new AppError('วิธีการจัดส่งไม่ถูกต้อง', 400, 'INVALID_SHIPPING_METHOD');
  }

  // 5. คำนวณค่าส่งและยอดรวม (฿35 + ฿10/เล่ม + ฿15 ข้ามภาค)
  const booksPrice = books.reduce((sum: number, b: any) => sum + Number(b.price), 0);
  const shippingFee =
    input.shippingMethod === 'DELIVERY'
      ? calcParcelFee(books.length, sellerProvince, input.buyerProvince)
      : 0;
  const totalPrice = booksPrice + shippingFee;

  let parsedScheduledAt: Date | null = null;
  if (input.scheduledAt) {
    const d = new Date(input.scheduledAt);
    if (!isNaN(d.getTime())) parsedScheduledAt = d;
  }

  // 6. บันทึกลงฐานข้อมูล
  const createdOrder = await db.$transaction(async (tx: any) => {
    const order = await tx.order.create({
      data: {
        buyerId,
        sellerId: input.sellerId,
        shippingMethod: input.shippingMethod,
        paymentMethod,
        shippingFee,
        totalPrice,
        status: 'REQUESTED',
        pickupLat: input.pickupLat ?? null,
        pickupLng: input.pickupLng ?? null,
        pickupLocationName: input.pickupLocationName ?? null,
        scheduledAt: parsedScheduledAt,
        scheduleDateIso: input.scheduleDateIso ?? null,
        scheduleTimeLabel: input.scheduleTimeLabel ?? null,
        scheduleProposedBy:
          parsedScheduledAt || input.scheduleDateIso ? 'BUYER' : null,
        shipWithinDays: input.shipWithinDays ?? null,
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
                  recipientPhone: input.recipientPhone ?? null,
                  province: input.buyerProvince ?? null,
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
      paymentMethod: (order.paymentMethod || paymentMethod) as PaymentMethod,
      status: 'REQUESTED' as const,
      createdAt: order.createdAt,
    };
  });

  await safeNotifyOrder(
    {
      recipientUserId: input.sellerId,
      role: 'SELLER',
      orderId: createdOrder.orderId,
      title: 'มีคำขอสั่งซื้อหนังสือใหม่',
      message: `มีผู้สนใจสั่งซื้อหนังสือจำนวน ${books.length} เล่ม (฿${createdOrder.totalPrice})`,
      badgeText: 'NEW ORDER REQUEST',
      linkPath: `/seller/orders/${createdOrder.orderId}`,
    },
    db
  );

  return createdOrder;
}

/**
 * ดูรายละเอียดคำสั่งซื้อ (GET /api/orders/:id)
 * มี Logic ปกป้องข้อมูลส่วนบุคคล (PDPA) ซ่อนที่อยู่และเบอร์ผู้รับตามสถานะและ Payment Mode
 */
export async function getOrderDetail(
  orderId: string,
  userId: string,
  prismaClient?: any
): Promise<OrderDetail> {
  const db = prismaClient || defaultPrisma;

  const order = await loadAndAuthorizeOrder(db, orderId, userId, {
    role: 'PARTICIPANT',
    forbiddenMessage: 'คุณไม่มีสิทธิ์ดูคำสั่งซื้อนี้',
    include: {
      buyer: true,
      seller: {
        include: {
          shopProfile: { select: { shopName: true } },
        },
      },
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

  const isSeller = userId === order.sellerId;
  const isBuyer = userId === order.buyerId;
  const paymentMethod = (order.paymentMethod || 'COD') as PaymentMethod;

  // กฎ PDPA: ผู้ซื้อเห็นที่อยู่ของตนเองได้เสมอ, ผู้ขายเห็นเมื่อ PAID, SHIPPED หรือ ACCEPTED (COD)
  const sellerCanSeeDeliveryInfo =
    isSeller &&
    (order.status === 'PAID' ||
      order.status === 'SHIPPED' ||
      (paymentMethod === 'COD' && order.status === 'ACCEPTED'));

  const safeDeliveryDetails =
    order.deliveryDetail && (isBuyer || sellerCanSeeDeliveryInfo)
      ? {
          recipientName: order.deliveryDetail.recipientName,
          recipientPhone: order.deliveryDetail.recipientPhone ?? null,
          province: order.deliveryDetail.province ?? null,
          deliveryAddress: order.deliveryDetail.deliveryAddress,
          courierName: order.deliveryDetail.courierName ?? null,
          trackingNumber: order.deliveryDetail.trackingNumber ?? null,
          parcelImageUrl: order.deliveryDetail.parcelImageUrl ?? null,
          shippedAt: order.deliveryDetail.shippedAt ?? null,
        }
      : null;

  const safeBuyerPhone =
    isBuyer || sellerCanSeeDeliveryInfo ? order.buyer.phoneNumber ?? null : null;

  return {
    id: order.id,
    status: order.status,
    shippingMethod: order.shippingMethod,
    paymentMethod,
    shippingFee: Number(order.shippingFee),
    totalPrice: Number(order.totalPrice),
    pickupLat: order.pickupLat !== null ? Number(order.pickupLat) : null,
    pickupLng: order.pickupLng !== null ? Number(order.pickupLng) : null,
    pickupLocationName: order.pickupLocationName ?? null,
    scheduledAt: order.scheduledAt ?? null,
    scheduleDateIso: order.scheduleDateIso ?? null,
    scheduleTimeLabel: order.scheduleTimeLabel ?? null,
    scheduleProposedBy: order.scheduleProposedBy ?? null,
    scheduleConfirmedByBuyer: Boolean(order.scheduleConfirmedByBuyer),
    handoverCode:
      isBuyer || order.status === 'COMPLETED' ? order.handoverCode ?? null : null,
    receivedPhotoUrl: order.receivedPhotoUrl ?? null,
    receivedAt: order.receivedAt ?? null,
    cancelReason: order.cancelReason ?? null,
    dispute: order.disputeReason
      ? {
          reason: order.disputeReason,
          openedBy: order.disputeOpenedBy ?? null,
          openedAt: order.disputedAt,
        }
      : null,
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
      avatarUrl: order.buyer.avatarUrl ?? null,
      phoneNumber: safeBuyerPhone,
      noShowCount: order.buyer.noShowCount ?? 0,
    },
    seller: {
      id: order.seller.id,
      nickname: order.seller.nickname || 'ร้านค้ากองดอง',
      shopName: order.seller.shopProfile?.shopName ?? null,
      avatarUrl: order.seller.avatarUrl ?? null,
      promptpayId: order.seller.promptpayId ?? null,
      verifiedName: order.seller.verifiedName ?? null,
      isVerifiedSeller: Boolean(order.seller.isVerifiedSeller),
    },
    deliveryDetails: safeDeliveryDetails,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
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
      paymentMethod: o.paymentMethod || 'COD',
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
      paymentMethod: o.paymentMethod || 'COD',
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
 * - Selective KYC: นัดรับ (PICKUP) ไม่ต้องยืนยันตัวตน, ส่งพัสดุ (DELIVERY) ต้อง isVerifiedSeller = true
 * - ตัดเครดิตผู้ขาย 1 เครดิต และล็อกหนังสือเป็น RESERVED พร้อม Auto-Reject คำขอซ้อน
 */
export async function acceptOrder(
  orderId: string,
  sellerId: string,
  prismaClient?: any
): Promise<AcceptOrderResult> {
  const db = prismaClient || defaultPrisma;

  const result = await db.$transaction(async (tx: any) => {
    const order = await loadAndAuthorizeOrder(tx, orderId, sellerId, {
      role: 'SELLER',
      forbiddenMessage: 'คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้',
      allowedStatuses: ['REQUESTED'],
      statusErrorBuilder: (s) => `ไม่สามารถรับออเดอร์นี้ได้เนื่องจากสถานะปัจจุบันคือ ${s}`,
      include: {
        seller: true,
        orderItems: { include: { bookListing: true } },
      },
    });

    // Selective KYC: บังคับยืนยันตัวตนเฉพาะออเดอร์ส่งพัสดุ (DELIVERY)
    if (order.shippingMethod === 'DELIVERY' && !order.seller.isVerifiedSeller) {
      throw new AppError(
        'การจัดส่งพัสดุจำเป็นต้องยืนยันตัวตนผู้ขาย (KYC) ก่อนรับคำสั่งซื้อ',
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
    if (order.orderItems.some((item: any) => item.bookListing.status !== 'AVAILABLE')) {
      throw new AppError(
        'หนังสือในคำสั่งซื้อนี้ถูกจองหรือขายไปแล้ว',
        400,
        'BOOK_NOT_AVAILABLE'
      );
    }

    const updatedSeller = await tx.user.update({
      where: { id: sellerId },
      data: { credits: { decrement: 1 } },
      select: { credits: true },
    });

    await tx.creditTransaction.create({
      data: {
        userId: sellerId,
        amount: -1,
        balanceAfter: updatedSeller.credits,
        type: 'ORDER_ACCEPT',
        orderId: order.id,
        note: 'หัก 1 เครดิตเมื่อกดรับคำสั่งซื้อ',
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
        order: { status: 'REQUESTED' },
      },
      select: { orderId: true },
    });

    const rejectedOrderIds: string[] = Array.from(
      new Set(competingOrderItems.map((item: any) => item.orderId))
    );

    if (rejectedOrderIds.length > 0) {
      await tx.order.updateMany({
        where: { id: { in: rejectedOrderIds }, status: 'REQUESTED' },
        data: { status: 'REJECTED' },
      });
    }

    const shipWithinDays = order.shipWithinDays || 2;
    const shipBy =
      order.shippingMethod === 'DELIVERY'
        ? new Date(Date.now() + shipWithinDays * 24 * 60 * 60 * 1000)
        : null;

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'ACCEPTED',
        ...(shipBy ? { shipBy } : {}),
      },
    });

    await createSystemOrderMessage(
      orderId,
      'ผู้ขายตอบรับคำสั่งซื้อแล้ว สามารถสื่อสารรายละเอียดการส่งมอบได้ในห้องแชทนี้',
      'SYSTEM',
      tx
    );

    return {
      buyerId: order.buyerId,
      orderId,
      status: 'ACCEPTED' as const,
      remainingCredits: updatedSeller.credits,
      lockedBookIds: bookListingIds,
      rejectedOrderIds,
    };
  });

  await safeNotifyOrder(
    {
      recipientUserId: result.buyerId,
      role: 'BUYER',
      orderId,
      title: 'ผู้ขายตอบรับคำสั่งซื้อแล้ว!',
      message: 'ร้านค้าได้ตอบรับคำสั่งซื้อและล็อกหนังสือไว้ให้คุณเรียบร้อยแล้ว',
      badgeText: 'ORDER ACCEPTED',
    },
    db
  );

  return {
    orderId: result.orderId,
    status: result.status,
    remainingCredits: result.remainingCredits,
    lockedBookIds: result.lockedBookIds,
    rejectedOrderIds: result.rejectedOrderIds,
  };
}

/**
 * ผู้ขายปฏิเสธคำขอซื้อ (POST /api/orders/:id/reject)
 */
export async function rejectOrder(
  orderId: string,
  sellerId: string,
  prismaClient?: any
): Promise<{ orderId: string; status: 'REJECTED' }> {
  const db = prismaClient || defaultPrisma;

  const order = await loadAndAuthorizeOrder(db, orderId, sellerId, {
    role: 'SELLER',
    forbiddenMessage: 'คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้',
    allowedStatuses: ['REQUESTED'],
    statusErrorBuilder: (s) => `ไม่สามารถปฏิเสธคำสั่งซื้อที่สถานะเป็น ${s} ได้`,
  });

  await db.order.update({
    where: { id: orderId },
    data: { status: 'REJECTED' },
  });

  await safeNotifyOrder(
    {
      recipientUserId: order.buyerId,
      role: 'BUYER',
      orderId,
      title: 'คำสั่งซื้อถูกปฏิเสธ',
      message: 'ผู้ขายไม่สะดวกรับคำสั่งซื้อในขณะนี้ คุณสามารถเลือกซื้อเล่มอื่นต่อได้',
      badgeText: 'ORDER REJECTED',
    },
    db
  );

  return { orderId, status: 'REJECTED' };
}

/**
 * ผู้ซื้อหรือผู้ขายยกเลิกคำสั่งซื้อ (POST /api/orders/:id/cancel)
 * - คืนหนังสือเป็น AVAILABLE และคืน 1 เครดิตให้ผู้ขายหากผู้ซื้อเป็นฝ่ายยกเลิกหลัง ACCEPTED
 */
export async function cancelOrder(
  orderId: string,
  userId: string,
  reason: string,
  prismaClient?: any
): Promise<{ orderId: string; status: 'CANCELLED'; cancelledBy: 'BUYER' | 'SELLER' }> {
  const db = prismaClient || defaultPrisma;

  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    throw new AppError('กรุณาระบุเหตุผลการยกเลิกคำสั่งซื้อ', 400, 'CANCEL_REASON_REQUIRED');
  }

  const outcome = await db.$transaction(async (tx: any) => {
    const order = await loadAndAuthorizeOrder(tx, orderId, userId, {
      role: 'PARTICIPANT',
      forbiddenMessage: 'คุณไม่มีสิทธิ์ยกเลิกคำสั่งซื้อนี้',
      allowedStatuses: ['REQUESTED', 'ACCEPTED', 'SCHEDULED'],
      statusErrorBuilder: (s) => `ไม่สามารถยกเลิกคำสั่งซื้อในสถานะ ${s} ได้`,
      include: { orderItems: true },
    });

    const isBuyer = order.buyerId === userId;
    const cancelledBy: 'BUYER' | 'SELLER' = isBuyer ? 'BUYER' : 'SELLER';
    const wasAccepted = order.status === 'ACCEPTED' || order.status === 'SCHEDULED';

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelReason: trimmedReason,
        cancelledBy,
      },
    });

    if (wasAccepted) {
      const bookListingIds = order.orderItems.map((i: any) => i.bookListingId);
      if (bookListingIds.length > 0) {
        await tx.bookListing.updateMany({
          where: { id: { in: bookListingIds } },
          data: { status: 'AVAILABLE' },
        });
      }

      if (cancelledBy === 'BUYER') {
        const updatedSeller = await tx.user.update({
          where: { id: order.sellerId },
          data: { credits: { increment: 1 } },
          select: { credits: true },
        });
        await tx.creditTransaction.create({
          data: {
            userId: order.sellerId,
            amount: 1,
            balanceAfter: updatedSeller.credits,
            type: 'REFUND_CANCEL',
            orderId: order.id,
            note: 'คืน 1 เครดิตเนื่องจากผู้ซื้อยกเลิกคำสั่งซื้อ',
          },
        });
      }

      await createSystemOrderMessage(
        orderId,
        `คำสั่งซื้อถูกยกเลิกโดย${cancelledBy === 'BUYER' ? 'ผู้ซื้อ' : 'ผู้ขาย'}: ${trimmedReason}`,
        'SYSTEM',
        tx
      );
    }

    return {
      orderId,
      status: 'CANCELLED' as const,
      cancelledBy,
      notifyUserId: isBuyer ? order.sellerId : order.buyerId,
      notifyRole: (isBuyer ? 'SELLER' : 'BUYER') as 'BUYER' | 'SELLER',
    };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.notifyUserId,
      role: outcome.notifyRole,
      orderId,
      title: 'คำสั่งซื้อถูกยกเลิก',
      message: `เหตุผล: ${trimmedReason}`,
      badgeText: 'ORDER CANCELLED',
    },
    db
  );

  return {
    orderId: outcome.orderId,
    status: outcome.status,
    cancelledBy: outcome.cancelledBy,
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

  const order = await loadAndAuthorizeOrder(db, orderId, buyerId, {
    role: 'BUYER',
    shippingMethod: 'DELIVERY',
    shippingErrorMessage: 'การแนบสลิปชำระเงินใช้สำหรับโหมดจัดส่งพัสดุเท่านั้น',
    allowedStatuses: ['ACCEPTED'],
    statusErrorBuilder: (s) =>
      `คำสั่งซื้อต้องอยู่ในสถานะ ACCEPTED เท่านั้นจึงจะชำระเงินได้ (สถานะปัจจุบัน: ${s})`,
    include: { seller: true },
  });

  const transRef = input.transRef || `REF_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const existingSlip = await db.paymentSlip.findUnique({
    where: { transRef },
  });

  if (existingSlip) {
    throw new AppError('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)', 400, 'DUPLICATE_SLIP');
  }

  const slipAmount = input.amount !== undefined ? Number(input.amount) : Number(order.totalPrice);
  if (Math.abs(slipAmount - Number(order.totalPrice)) > 0.01) {
    throw new AppError('ยอดเงินในสลิปไม่ตรงกับยอดรวมของคำสั่งซื้อ', 400, 'SLIP_AMOUNT_MISMATCH');
  }

  if (input.receiverName && order.seller.verifiedName) {
    const cleanReceiver = input.receiverName.replace(/\s+/g, '');
    const cleanSellerVerified = order.seller.verifiedName.replace(/\s+/g, '');
    if (
      !cleanReceiver.includes(cleanSellerVerified) &&
      !cleanSellerVerified.includes(cleanReceiver)
    ) {
      throw new AppError(
        'ชื่อผู้รับเงินในสลิปไม่ตรงกับชื่อยืนยันของผู้ขาย',
        400,
        'SLIP_RECEIVER_MISMATCH'
      );
    }
  }

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

  await safeNotifyOrder(
    {
      recipientUserId: order.sellerId,
      role: 'SELLER',
      orderId,
      title: 'ผู้ซื้อชำระเงินเรียบร้อยแล้ว',
      message: 'กรุณาจัดส่งพัสดุและกรอกเลขติดตามพัสดุในระบบ',
      badgeText: 'PAYMENT VERIFIED',
    },
    db
  );

  return {
    status: 'PAID',
    verificationStatus: 'AUTO_VERIFIED',
    transRef,
  };
}

/**
 * ผู้ขายบันทึกข้อมูลจัดส่งพัสดุ (POST /api/orders/:id/ship)
 * - โหมด TRANSFER: ต้องเป็นสถานะ PAID
 * - โหมด COD: สามารถจัดส่งได้ทันทีในสถานะ ACCEPTED (หรือ PAID)
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

  const order = await loadAndAuthorizeOrder(db, orderId, sellerId, {
    role: 'SELLER',
    shippingMethod: 'DELIVERY',
  });

  const paymentMethod = order.paymentMethod || 'COD';
  const canShipCod = paymentMethod === 'COD' && order.status === 'ACCEPTED';
  if (order.status !== 'PAID' && !canShipCod) {
    throw new AppError(
      `ออเดอร์ยังไม่พร้อมจัดส่ง (สถานะปัจจุบัน: ${order.status})`,
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

    await createSystemOrderMessage(
      orderId,
      `ผู้ขายจัดส่งพัสดุแล้ว (${input.courierName}: ${input.trackingNumber})`,
      'SYSTEM',
      tx
    );
  });

  await safeNotifyOrder(
    {
      recipientUserId: order.buyerId,
      role: 'BUYER',
      orderId,
      title: 'พัสดุถูกจัดส่งแล้ว!',
      message: `${input.courierName} เลขพัสดุ ${input.trackingNumber}`,
      badgeText: 'SHIPPED',
    },
    db
  );

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

  const order = await loadAndAuthorizeOrder(db, orderId, buyerId, {
    role: 'BUYER',
    shippingMethod: 'DELIVERY',
    allowedStatuses: ['SHIPPED'],
    statusErrorBuilder: (s) =>
      `ออเดอร์ต้องอยู่ในสถานะ SHIPPED เท่านั้นจึงจะยืนยันรับของได้ (สถานะปัจจุบัน: ${s})`,
    include: { orderItems: true },
  });

  await db.$transaction(async (tx: any) => {
    await markOrderCompleted(tx, order);
  });

  return { orderId, status: 'COMPLETED' };
}

/**
 * ผู้ซื้อถ่ายรูปยืนยันรับหนังสือพร้อมรีวิว (POST /api/orders/:id/receive)
 * รองรับทั้ง DELIVERY (SHIPPED -> COMPLETED) และ PICKUP (ACCEPTED / SCHEDULED -> COMPLETED)
 */
export async function receiveOrder(
  orderId: string,
  buyerId: string,
  input: ReceiveOrderInput,
  prismaClient?: any
): Promise<{ orderId: string; status: 'COMPLETED'; receivedPhotoUrl: string }> {
  const db = prismaClient || defaultPrisma;

  if (!input.receivedPhotoUrl) {
    throw new AppError('กรุณาแนบรูปถ่ายยืนยันการรับหนังสือ', 400, 'RECEIVED_PHOTO_REQUIRED');
  }

  const order = await loadAndAuthorizeOrder(db, orderId, buyerId, {
    role: 'BUYER',
    include: { orderItems: true },
  });

  const canReceiveDelivery = order.shippingMethod === 'DELIVERY' && order.status === 'SHIPPED';
  const canReceivePickup =
    order.shippingMethod === 'PICKUP' &&
    (order.status === 'ACCEPTED' || order.status === 'SCHEDULED');

  if (!canReceiveDelivery && !canReceivePickup) {
    throw new AppError(
      `ไม่สามารถยืนยันรับหนังสือในสถานะ ${order.status} ได้`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  const receivedAt = new Date();

  await db.$transaction(async (tx: any) => {
    await markOrderCompleted(tx, order, {
      receivedPhotoUrl: input.receivedPhotoUrl,
      receivedAt,
    });

    if (input.review && tx.review?.create) {
      const rating = Math.round(Number(input.review.rating));
      if (isNaN(rating) || rating < 1 || rating > 5) {
        throw new AppError('คะแนนรีวิวต้องอยู่ระหว่าง 1 ถึง 5 ดาว', 400, 'INVALID_RATING');
      }

      const tags = Array.isArray(input.review.tags)
        ? input.review.tags.map((t) => String(t).trim()).filter(Boolean)
        : [];

      await tx.review.create({
        data: {
          orderId,
          reviewerId: buyerId,
          revieweeId: order.sellerId,
          rating,
          isConditionAccurate: Boolean(input.review.isConditionAccurate),
          tags,
          comment: input.review.comment ? input.review.comment.trim() : null,
        },
      });
    }

    await createSystemOrderMessage(
      orderId,
      'ผู้ซื้อยืนยันได้รับหนังสือเรียบร้อยแล้ว คำสั่งซื้อเสร็จสมบูรณ์',
      'SYSTEM',
      tx
    );
  });

  await safeNotifyOrder(
    {
      recipientUserId: order.sellerId,
      role: 'SELLER',
      orderId,
      title: 'ผู้ซื้อยืนยันได้รับหนังสือแล้ว!',
      message: 'คำสั่งซื้อเสร็จสมบูรณ์เรียบร้อยแล้ว',
      badgeText: 'COMPLETED',
    },
    db
  );

  return {
    orderId,
    status: 'COMPLETED',
    receivedPhotoUrl: input.receivedPhotoUrl,
  };
}

/**
 * ผู้ขายกดยืนยันส่งมอบนัดรับสำเร็จ (POST /api/orders/:id/complete-meetup)
 * ใช้ได้สำหรับ PICKUP ในสถานะ ACCEPTED หรือ SCHEDULED (โหมด COD / นัดรับ)
 */
export async function completeMeetupCodOrder(
  orderId: string,
  sellerId: string,
  prismaClient?: any
): Promise<{ orderId: string; status: 'COMPLETED'; soldBookIds: string[] }> {
  const db = prismaClient || defaultPrisma;

  const outcome = await db.$transaction(async (tx: any) => {
    const order = await loadAndAuthorizeOrder(tx, orderId, sellerId, {
      role: 'SELLER',
      shippingMethod: 'PICKUP',
      shippingErrorMessage: 'คำสั่งซื้อนี้ไม่ได้ใช้วิธีนัดรับสินค้า',
      allowedStatuses: ['ACCEPTED', 'SCHEDULED'],
      statusErrorBuilder: (s) => `ไม่สามารถปิดการขายได้ในสถานะ ${s}`,
      include: { orderItems: true },
    });

    const soldBookIds = await markOrderCompleted(tx, order);

    await createSystemOrderMessage(
      orderId,
      'ผู้ขายยืนยันการส่งมอบและรับชำระเงินนัดรับเรียบร้อยแล้ว',
      'SYSTEM',
      tx
    );

    return {
      buyerId: order.buyerId,
      orderId,
      status: 'COMPLETED' as const,
      soldBookIds,
    };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.buyerId,
      role: 'BUYER',
      orderId,
      title: 'นัดรับหนังสือสำเร็จ!',
      message: 'ผู้ขายยืนยันส่งมอบหนังสือเรียบร้อยแล้ว อย่าลืมให้คะแนนร้านค้านะครับ',
      badgeText: 'MEETUP COMPLETED',
    },
    db
  );

  return {
    orderId: outcome.orderId,
    status: outcome.status,
    soldBookIds: outcome.soldBookIds,
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

  const order = await loadAndAuthorizeOrder(db, orderId, sellerId, {
    role: 'SELLER',
    shippingMethod: 'PICKUP',
    shippingErrorMessage: 'การรายงานไม่มาตามนัดใช้สำหรับโหมดนัดรับเท่านั้น',
    allowedStatuses: ['SCHEDULED'],
    statusErrorBuilder: (s) => `ออเดอร์ต้องอยู่ในสถานะ SCHEDULED เท่านั้น (สถานะปัจจุบัน: ${s})`,
  });

  if (!order.scheduledAt) {
    throw new AppError('ยังไม่ได้ระบุวันเวลานัดหมาย', 400, 'NOT_SCHEDULED');
  }

  const eligibleTime = new Date(order.scheduledAt).getTime() + 15 * 60 * 1000;
  if (Date.now() < eligibleTime) {
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

  await safeNotifyOrder(
    {
      recipientUserId: order.buyerId,
      role: 'BUYER',
      orderId,
      title: 'ผู้ขายรายงานว่าไม่พบผู้รับตามนัด',
      message: 'หากเป็นความเข้าใจผิด สามารถกดโต้แย้งได้ภายในห้องแชทคำสั่งซื้อ',
      badgeText: 'MISSED MEETING',
    },
    db
  );

  return { orderId, missedMeetingReportedAt };
}

/**
 * เปิดข้อพิพาทคำสั่งซื้อ (POST /api/orders/:id/dispute)
 */
export async function openDispute(
  orderId: string,
  userId: string,
  reason: string,
  prismaClient?: any
): Promise<{ orderId: string; status: 'DISPUTED'; disputeReason: string }> {
  const db = prismaClient || defaultPrisma;

  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    throw new AppError('กรุณาระบุเหตุผลการเปิดข้อพิพาท', 400, 'DISPUTE_REASON_REQUIRED');
  }

  const order = await loadAndAuthorizeOrder(db, orderId, userId, {
    role: 'PARTICIPANT',
    forbiddenMessage: 'คุณไม่มีสิทธิ์เปิดข้อพิพาทสำหรับคำสั่งซื้อนี้',
    allowedStatuses: ['ACCEPTED', 'SCHEDULED', 'PAID', 'SHIPPED'],
    statusErrorBuilder: (s) => `ไม่สามารถเปิดข้อพิพาทในสถานะ ${s} ได้`,
  });

  const isBuyer = order.buyerId === userId;

  await db.order.update({
    where: { id: orderId },
    data: {
      status: 'DISPUTED',
      disputedBy: userId,
      disputeOpenedBy: isBuyer ? 'BUYER' : 'SELLER',
      disputeReason: trimmedReason,
      disputedAt: new Date(),
    },
  });

  await createSystemOrderMessage(
    orderId,
    `เปิดข้อพิพาทโดย${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}: ${trimmedReason}`,
    'SYSTEM',
    db
  );

  await safeNotifyOrder(
    {
      recipientUserId: isBuyer ? order.sellerId : order.buyerId,
      role: isBuyer ? 'SELLER' : 'BUYER',
      orderId,
      title: 'คำสั่งซื้อถูกเปิดข้อพิพาท',
      message: `เหตุผล: ${trimmedReason}`,
      badgeText: 'DISPUTED',
    },
    db
  );

  return { orderId, status: 'DISPUTED', disputeReason: trimmedReason };
}

/**
 * ผู้ซื้อโต้แย้งกรณีถูกรายงานไม่มาตามนัด (POST /api/orders/:id/dispute-missed-meeting)
 */
export async function disputeMissedMeeting(
  orderId: string,
  buyerId: string,
  reason: string,
  prismaClient?: any
): Promise<{ orderId: string; status: 'DISPUTED'; disputeReason: string }> {
  const db = prismaClient || defaultPrisma;

  const order = await loadAndAuthorizeOrder(db, orderId, buyerId, {
    role: 'BUYER',
    forbiddenMessage: 'เฉพาะผู้ซื้อเท่านั้นที่สามารถโต้แย้งรายงานนี้ได้',
  });

  if (!order.missedMeetingReportedAt) {
    throw new AppError(
      'คำสั่งซื้อนี้ยังไม่มีการรายงานไม่มาตามนัด',
      400,
      'NO_MISSED_MEETING_REPORT'
    );
  }

  return openDispute(
    orderId,
    buyerId,
    reason || 'โต้แย้งการรายงานไม่มาตามนัดหมาย',
    prismaClient
  );
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

  const order = await loadAndAuthorizeOrder(db, orderId, userId, {
    role: 'PARTICIPANT',
    shippingMethod: 'PICKUP',
    allowedStatuses: ['ACCEPTED', 'SCHEDULED'],
    statusErrorBuilder: (s) => `ไม่สามารถบันทึกนัดหมายได้เนื่องจากสถานะปัจจุบันคือ ${s}`,
  });

  const handoverCode = order.handoverCode || generateHandoverCode();
  const scheduledAt = new Date(input.scheduledAt);

  if (isNaN(scheduledAt.getTime())) {
    throw new AppError('วันเวลานัดหมาย (scheduledAt) ไม่ถูกต้อง', 400, 'INVALID_DATE');
  }

  const actorRole = order.buyerId === userId ? 'BUYER' : 'SELLER';

  await db.order.update({
    where: { id: orderId },
    data: {
      status: 'SCHEDULED',
      scheduledAt,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      pickupLocationName: input.pickupLocationName || null,
      handoverCode,
      ...(input.scheduleDateIso !== undefined
        ? { scheduleDateIso: input.scheduleDateIso }
        : {}),
      ...(input.scheduleTimeLabel !== undefined
        ? { scheduleTimeLabel: input.scheduleTimeLabel }
        : {}),
      scheduleProposedBy: actorRole,
      ...(actorRole === 'BUYER' ? { scheduleConfirmedByBuyer: true } : {}),
    },
  });

  await createSystemOrderMessage(
    orderId,
    `อัปเดตเวลานัดรับ: ${input.pickupLocationName || 'จุดนัดรับ'} (${
      input.scheduleTimeLabel || scheduledAt.toISOString()
    })`,
    'SCHEDULE_CARD',
    db
  );

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
    const order = await loadAndAuthorizeOrder(tx, orderId, sellerId, {
      role: 'SELLER',
      shippingMethod: 'PICKUP',
      allowedStatuses: ['SCHEDULED'],
      statusErrorBuilder: (s) =>
        `ออเดอร์ต้องอยู่ในสถานะ SCHEDULED เท่านั้นเพื่อตรวจรหัสส่งมอบ (สถานะปัจจุบัน: ${s})`,
      include: { orderItems: true },
    });

    const cleanInputCode = (handoverCode || '').trim();
    if (!cleanInputCode || cleanInputCode !== order.handoverCode) {
      throw new AppError(
        'รหัสส่งมอบ 6 หลักไม่ถูกต้อง ให้ผู้ขายตรวจดูรหัสบนหน้าจอลูกค้าอีกครั้ง',
        400,
        'INVALID_HANDOVER_CODE'
      );
    }

    const soldBookIds = await markOrderCompleted(tx, order);

    return {
      orderId,
      status: 'COMPLETED',
      soldBookIds,
    };
  });
}
