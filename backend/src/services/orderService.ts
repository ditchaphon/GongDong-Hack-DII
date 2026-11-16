import crypto from 'crypto';
import { prisma as defaultPrisma } from '../config/prisma';
import { env } from '../config/env';
import { calcParcelFee } from './shippingService';
import { createSystemOrderMessage } from './messageService';
import { maskAccountHolderName, maskSensitiveData } from './dataMaskingService';
import { notifyOrderEvent } from './lineNotifyService';
import { generatePromptPayQR } from './promptPayService';
import { extractStoragePathFromUrl, resolveSignedStorageUrl } from './uploadService';
import {
  AcceptOrderResult,
  AppError,
  CreateBatchOrdersInput,
  CreateBatchOrdersResult,
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

const MAX_PENDING_REQUESTS = 10;
const REQUEST_EXPIRE_MS = 24 * 60 * 60 * 1000;
const SHIPPED_AUTO_COMPLETE_MS = 7 * 24 * 60 * 60 * 1000;
const SCHEDULE_PAST_GRACE_MS = 5 * 60 * 1000;
const HANDOVER_MAX_ATTEMPTS = 5;
const HANDOVER_LOCKOUT_MS = 15 * 60 * 1000;
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyStore = new Map<string, { expiresAt: number; promise: Promise<any> }>();
const handoverAttemptsStore = new Map<
  string,
  { failedCount: number; windowExpiresAt: number; lockedUntil: number }
>();

export function clearHandoverAttemptsForTest(): void {
  handoverAttemptsStore.clear();
}

function validatePickupCoordinates(lat: number, lng: number): void {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new AppError(
      'พิกัดจุดนัดรับไม่ถูกต้อง (ละติจูดต้องอยู่ระหว่าง -90 ถึง 90 และลองจิจูด -180 ถึง 180)',
      400,
      'INVALID_COORDINATES'
    );
  }
}

function validateScheduledAtFuture(scheduledAt: Date): void {
  if (isNaN(scheduledAt.getTime())) {
    throw new AppError('วันเวลานัดหมาย (scheduledAt) ไม่ถูกต้อง', 400, 'INVALID_DATE');
  }
  if (scheduledAt.getTime() < Date.now() - SCHEDULE_PAST_GRACE_MS) {
    throw new AppError(
      'ไม่สามารถกำหนดวันเวลานัดหมายย้อนหลังได้ กรุณาเลือกเวลาในอนาคต',
      400,
      'SCHEDULE_IN_THE_PAST'
    );
  }
}

function isRequestedOrderExpired(
  order: { status?: string; createdAt?: Date | string | null },
  nowMs = Date.now()
): boolean {
  if (order?.status !== 'REQUESTED' || !order.createdAt) return false;
  const createdMs = new Date(order.createdAt).getTime();
  return Number.isFinite(createdMs) && nowMs - createdMs >= REQUEST_EXPIRE_MS;
}

function isShippedOrderAutoCompletable(
  order: { status?: string; shippingMethod?: string; updatedAt?: Date | string | null },
  nowMs = Date.now()
): boolean {
  if (
    order?.status !== 'SHIPPED' ||
    (order.shippingMethod && order.shippingMethod !== 'DELIVERY') ||
    !order.updatedAt
  ) {
    return false;
  }
  const updatedMs = new Date(order.updatedAt).getTime();
  return Number.isFinite(updatedMs) && nowMs - updatedMs >= SHIPPED_AUTO_COMPLETE_MS;
}

async function expireOverdueRequestedOrders(
  db: any,
  whereFilter: Record<string, unknown> = {},
  options?: { notify?: boolean }
): Promise<number> {
  if (
    typeof db?.order?.findMany !== 'function' ||
    typeof db?.order?.updateMany !== 'function'
  ) {
    return 0;
  }

  const cutoff = new Date(Date.now() - REQUEST_EXPIRE_MS);
  const overdue = await db.order.findMany({
    where: {
      ...whereFilter,
      status: 'REQUESTED',
      createdAt: { lte: cutoff },
    },
    select: { id: true, buyerId: true, sellerId: true },
  });

  if (!Array.isArray(overdue) || overdue.length === 0) {
    return 0;
  }

  const ids = overdue.map((o: any) => o.id).filter(Boolean);
  if (ids.length === 0) return 0;

  const updateRes = await db.order.updateMany({
    where: { id: { in: ids }, status: 'REQUESTED' },
    data: { status: 'EXPIRED' },
  });

  if (options?.notify) {
    for (const o of overdue) {
      if (!o?.buyerId) continue;
      await safeNotifyOrder(
        {
          recipientUserId: o.buyerId,
          role: 'BUYER',
          orderId: o.id,
          title: 'คำขอซื้อหมดอายุแล้ว',
          message: 'ผู้ขายไม่ได้ตอบรับภายใน 24 ชั่วโมง คุณสามารถเลือกสั่งซื้อจากร้านอื่นได้',
          badgeText: 'ORDER EXPIRED',
        },
        db
      );
    }
  }

  return typeof updateRes?.count === 'number' ? updateRes.count : ids.length;
}

async function autoCompleteOverdueShippedOrders(
  db: any,
  whereFilter: Record<string, unknown> = {},
  options?: { notify?: boolean }
): Promise<number> {
  if (typeof db?.order?.findMany !== 'function') {
    return 0;
  }

  const cutoff = new Date(Date.now() - SHIPPED_AUTO_COMPLETE_MS);
  const overdue = await db.order.findMany({
    where: {
      ...whereFilter,
      status: 'SHIPPED',
      shippingMethod: 'DELIVERY',
      updatedAt: { lte: cutoff },
    },
    include: { orderItems: true },
  });

  if (!Array.isArray(overdue) || overdue.length === 0) {
    return 0;
  }

  let completedCount = 0;
  for (const order of overdue) {
    try {
      await withTransaction(db, async (tx: any) => {
        const writeTx = tx?.order?.updateMany ? tx : db;
        await markOrderCompleted(writeTx, order);
        if (writeTx?.orderMessage?.create) {
          await createSystemOrderMessage(
            order.id,
            'ระบบปิดคำสั่งซื้ออัตโนมัติเนื่องจากครบกำหนด 7 วันหลังจัดส่งพัสดุ',
            'SYSTEM',
            writeTx
          );
        }
      });
      completedCount += 1;

      if (options?.notify) {
        await safeNotifyOrder(
          {
            recipientUserId: order.sellerId,
            role: 'SELLER',
            orderId: order.id,
            title: 'ปิดการขายอัตโนมัติ (ครบ 7 วัน)',
            message: 'คำสั่งซื้อครบกำหนด 7 วันหลังจัดส่งและปิดการขายเรียบร้อยแล้ว',
            badgeText: 'AUTO COMPLETED',
          },
          db
        );
        await safeNotifyOrder(
          {
            recipientUserId: order.buyerId,
            role: 'BUYER',
            orderId: order.id,
            title: 'คำสั่งซื้อปิดอัตโนมัติ (ครบ 7 วัน)',
            message: 'หากมีปัญหาเพิ่มเติมสามารถติดต่อทีมงานได้',
            badgeText: 'AUTO COMPLETED',
          },
          db
        );
      }
    } catch (err) {
      // Skip concurrent status conflicts cleanly
      if ((err as any)?.code !== 'ORDER_STATUS_CONFLICT') {
        console.warn('[orderService] Failed auto-completing shipped order:', order.id, err);
      }
    }
  }

  return completedCount;
}

function runWithIdempotency<T>(
  scopeKey: string | undefined,
  operation: () => Promise<T>
): Promise<T> {
  if (!scopeKey) {
    return operation();
  }

  const now = Date.now();
  const existing = idempotencyStore.get(scopeKey);
  if (existing && existing.expiresAt > now) {
    return existing.promise as Promise<T>;
  }

  if (idempotencyStore.size > 1000) {
    for (const [key, entry] of idempotencyStore.entries()) {
      if (entry.expiresAt <= now) {
        idempotencyStore.delete(key);
      }
    }
  }

  const promise = operation().catch((err) => {
    idempotencyStore.delete(scopeKey);
    throw err;
  });

  idempotencyStore.set(scopeKey, {
    expiresAt: now + IDEMPOTENCY_TTL_MS,
    promise,
  });

  return promise;
}

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
async function withTransaction<T>(db: any, fn: (tx: any) => Promise<T>): Promise<T> {
  if (typeof db?.$transaction === 'function') {
    return await db.$transaction(fn);
  }
  return await fn(db);
}

async function updateOrderStatusAtomic(
  tx: any,
  orderId: string,
  expectedStatuses: string | string[],
  data: Record<string, unknown>
): Promise<void> {
  const statusFilter = Array.isArray(expectedStatuses)
    ? { in: expectedStatuses }
    : expectedStatuses;

  if (typeof tx?.order?.updateMany === 'function') {
    const result = await tx.order.updateMany({
      where: {
        id: orderId,
        status: statusFilter,
      },
      data,
    });
    if (result && typeof result.count === 'number') {
      if (result.count === 0) {
        throw new AppError(
          'สถานะคำสั่งซื้อเปลี่ยนแปลงไปแล้ว กรุณารีเฟรชและลองใหม่อีกครั้ง',
          409,
          'ORDER_STATUS_CONFLICT'
        );
      }
      return;
    }
  }

  await tx.order.update({
    where: { id: orderId },
    data,
  });
}

async function markOrderCompleted(
  tx: any,
  order: any,
  extraOrderData: Record<string, unknown> = {}
): Promise<string[]> {
  await updateOrderStatusAtomic(tx, order.id, order.status, {
    status: 'COMPLETED',
    ...extraOrderData,
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
 * ตรวจสอบความถูกต้องเบื้องต้นของคำขอสร้างออเดอร์เดี่ยว (ก่อนเปิด Transaction)
 */
function validateCreateOrderInput(buyerId: string, input: CreateOrderInput): string[] {
  if (!input.bookIds || input.bookIds.length === 0) {
    throw new AppError('กรุณาเลือกหนังสืออย่างน้อย 1 เล่ม', 400, 'EMPTY_CART', {
      sellerId: input.sellerId,
    });
  }

  const uniqueBookIds = Array.from(new Set(input.bookIds));
  if (uniqueBookIds.length !== input.bookIds.length) {
    throw new AppError('พบหนังสือซ้ำซ้อนในรายการสั่งซื้อ', 400, 'DUPLICATE_BOOK_IDS', {
      sellerId: input.sellerId,
    });
  }

  if (buyerId === input.sellerId) {
    throw new AppError('คุณไม่สามารถสั่งซื้อหนังสือของตนเองได้', 400, 'CANNOT_BUY_OWN_BOOK', {
      sellerId: input.sellerId,
    });
  }

  return uniqueBookIds;
}

/**
 * สร้างคำสั่งซื้อ 1 รายการภายใน Transaction (ใช้ร่วมกันระหว่าง createOrder และ createBatchOrders)
 */
async function createOrderInTx(
  tx: any,
  db: any,
  buyerId: string,
  input: CreateOrderInput,
  uniqueBookIds: string[],
  scopedIdempotencyKey?: string
): Promise<{ result: CreateOrderResult; bookCount: number; sellerId: string }> {
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);
  const orderRepo = tx.order?.findFirst ? tx.order : db.order;
  const bookRepo = tx.bookListing?.findMany ? tx.bookListing : db.bookListing;
  const shopRepo = tx.shopProfile?.findUnique ? tx.shopProfile : db.shopProfile;

  // บังคับไม่เกิน 1 คำขอ REQUESTED ต่อ 1 ร้านค้า เพื่อกันการสแปมคำขอร้านเดิม
  if (orderRepo?.findFirst) {
    const existingForSeller = await orderRepo.findFirst({
      where: { buyerId, sellerId: input.sellerId, status: 'REQUESTED' },
      select: { id: true },
    });
    if (existingForSeller) {
      throw new AppError(
        'คุณมีคำขอซื้อที่รอร้านค้านี้อนุมัติอยู่แล้ว กรุณารอร้านตอบรับหรือยกเลิกคำขอเดิมก่อน',
        400,
        'PENDING_ORDER_EXISTS_FOR_SELLER',
        { sellerId: input.sellerId, existingOrderId: existingForSeller.id }
      );
    }
  }

  // ตรวจสอบรายการหนังสือภายใน Transaction
  const books = await bookRepo.findMany({
    where: { id: { in: uniqueBookIds } },
  });

  if (books.length !== uniqueBookIds.length) {
    const foundIds = new Set(books.map((b: any) => b.id));
    const missingIds = uniqueBookIds.filter((id) => !foundIds.has(id));
    throw new AppError('ไม่พบหนังสือบางเล่มในระบบ', 404, 'BOOK_NOT_FOUND', {
      sellerId: input.sellerId,
      invalidBookIds: missingIds,
    });
  }

  const wrongSellerBooks = books.filter((b: any) => b.sellerId !== input.sellerId);
  if (wrongSellerBooks.length > 0) {
    throw new AppError(
      '1 ตะกร้าต้องเป็นหนังสือจากร้านเดียวกันเท่านั้น',
      400,
      'MULTIPLE_SELLERS_IN_CART',
      {
        sellerId: input.sellerId,
        invalidBookIds: wrongSellerBooks.map((b: any) => b.id),
      }
    );
  }

  const unavailableBooks = books.filter((b: any) => b.status !== 'AVAILABLE');
  if (unavailableBooks.length > 0) {
    throw new AppError(
      'หนังสือบางเล่มในตะกร้าถูกจองหรือขายไปแล้ว',
      400,
      'BOOK_NOT_AVAILABLE',
      {
        sellerId: input.sellerId,
        invalidBookIds: unavailableBooks.map((b: any) => b.id),
      }
    );
  }

  const nonCodBooks = paymentMethod === 'COD' ? books.filter((b: any) => b.codEnabled === false) : [];
  if (nonCodBooks.length > 0) {
    throw new AppError(
      'หนังสือบางเล่มในตะกร้าไม่รองรับการเก็บเงินปลายทาง/จ่ายตอนรับ',
      400,
      'COD_NOT_ENABLED',
      {
        sellerId: input.sellerId,
        invalidBookIds: nonCodBooks.map((b: any) => b.id),
      }
    );
  }

  if (input.shippingMethod === 'DELIVERY') {
    const disallowedDelivery = books.filter((b: any) => !b.allowDelivery);
    if (disallowedDelivery.length > 0) {
      throw new AppError('หนังสือบางเล่มในตะกร้าไม่สะดวกจัดส่งพัสดุ', 400, 'DELIVERY_NOT_ALLOWED', {
        sellerId: input.sellerId,
        invalidBookIds: disallowedDelivery.map((b: any) => b.id),
      });
    }
    if (!input.recipientName || !input.deliveryAddress) {
      throw new AppError(
        'กรุณาระบุชื่อผู้รับและที่อยู่จัดส่งพัสดุให้ครบถ้วน',
        400,
        'MISSING_DELIVERY_DETAILS',
        { sellerId: input.sellerId }
      );
    }
  } else if (input.shippingMethod === 'PICKUP') {
    const disallowedPickup = books.filter((b: any) => !b.allowPickup);
    if (disallowedPickup.length > 0) {
      throw new AppError('หนังสือบางเล่มในตะกร้าไม่สะดวกนัดรับ', 400, 'PICKUP_NOT_ALLOWED', {
        sellerId: input.sellerId,
        invalidBookIds: disallowedPickup.map((b: any) => b.id),
      });
    }
  } else {
    throw new AppError('วิธีการจัดส่งไม่ถูกต้อง', 400, 'INVALID_SHIPPING_METHOD', {
      sellerId: input.sellerId,
    });
  }

  // ดึงจังหวัดและกำหนดวันจัดส่งจริงจาก ShopProfile บน Server (ไม่เชื่อค่าที่ Client ส่งมา)
  let sellerProvince: string | null = null;
  let shipWithinDays: number | null = input.shippingMethod === 'DELIVERY' ? 2 : null;
  if (shopRepo?.findUnique) {
    const shop = await shopRepo.findUnique({
      where: { userId: input.sellerId },
      select: { province: true, shipWithinDays: true },
    });
    sellerProvince = shop?.province ?? null;
    if (input.shippingMethod === 'DELIVERY' && typeof shop?.shipWithinDays === 'number') {
      shipWithinDays = shop.shipWithinDays;
    }
  }

  const booksPrice = books.reduce((sum: number, b: any) => sum + Number(b.price), 0);
  const shippingFee =
    input.shippingMethod === 'DELIVERY'
      ? calcParcelFee(books.length, sellerProvince, input.buyerProvince)
      : 0;
  const totalPrice = booksPrice + shippingFee;

  if (
    typeof input.expectedTotal === 'number' &&
    Number.isFinite(input.expectedTotal) &&
    Math.abs(totalPrice - input.expectedTotal) > 0.01
  ) {
    throw new AppError(
      'ราคาหนังสือหรือค่าจัดส่งมีการเปลี่ยนแปลง กรุณาตรวจสอบยอดใหม่อีกครั้ง',
      409,
      'PRICE_CHANGED',
      {
        sellerId: input.sellerId,
        expectedTotal: input.expectedTotal,
        actualTotal: totalPrice,
      }
    );
  }

  if (input.pickupLat !== undefined || input.pickupLng !== undefined) {
    validatePickupCoordinates(Number(input.pickupLat), Number(input.pickupLng));
  }

  let parsedScheduledAt: Date | null = null;
  if (input.scheduledAt) {
    const d = new Date(input.scheduledAt);
    validateScheduledAtFuture(d);
    parsedScheduledAt = d;
  }

  const order = await tx.order.create({
    data: {
      buyerId,
      sellerId: input.sellerId,
      shippingMethod: input.shippingMethod,
      paymentMethod,
      shippingFee,
      totalPrice,
      status: 'REQUESTED',
      ...(scopedIdempotencyKey ? { idempotencyKey: scopedIdempotencyKey } : {}),
      pickupLat: input.pickupLat ?? null,
      pickupLng: input.pickupLng ?? null,
      pickupLocationName: input.pickupLocationName ?? null,
      scheduledAt: parsedScheduledAt,
      scheduleDateIso: input.scheduleDateIso ?? null,
      scheduleTimeLabel: input.scheduleTimeLabel ?? null,
      scheduleProposedBy:
        parsedScheduledAt || input.scheduleDateIso ? 'BUYER' : null,
      shipWithinDays,
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
    bookCount: books.length,
    sellerId: input.sellerId,
    result: {
      orderId: order.id,
      totalPrice: Number(order.totalPrice),
      shippingFee: Number(order.shippingFee),
      paymentMethod: (order.paymentMethod || paymentMethod) as PaymentMethod,
      status: 'REQUESTED' as const,
      createdAt: order.createdAt,
    },
  };
}

function buildScopedIdempotencyKey(
  mode: 'single' | 'batch',
  buyerId: string,
  rawKey: string,
  sellerId: string
): string {
  const cleanKey = rawKey.trim().slice(0, 64);
  return `${buyerId}:${mode}:${cleanKey}:${sellerId}`;
}

function serializeExistingOrderResult(order: any): CreateOrderResult {
  return {
    orderId: order.id,
    totalPrice: Number(order.totalPrice),
    shippingFee: Number(order.shippingFee),
    paymentMethod: (order.paymentMethod || 'COD') as PaymentMethod,
    status: (order.status || 'REQUESTED') as 'REQUESTED',
    createdAt: order.createdAt,
  };
}

/**
 * สร้างคำสั่งซื้อหลายร้านค้าพร้อมกันใน Transaction เดียว (All-or-Nothing)
 * รองรับ DB-backed Idempotency Key (ข้าม Restart) ร่วมกับ in-flight dedup
 */
async function executeBatchOrders(
  buyerId: string,
  inputs: CreateOrderInput[],
  prismaClient?: any,
  idempotency?: { mode: 'single' | 'batch'; key?: string }
): Promise<CreateBatchOrdersResult> {
  const db = prismaClient || defaultPrisma;

  if (!inputs || inputs.length === 0) {
    throw new AppError('กรุณาเลือกรายการสั่งซื้ออย่างน้อย 1 ร้านค้า', 400, 'EMPTY_CART');
  }

  const validatedEntries: Array<{
    input: CreateOrderInput;
    uniqueBookIds: string[];
    scopedKey?: string;
  }> = [];
  const batchSellerIds = new Set<string>();
  const rawIdempotencyKey = idempotency?.key?.trim();
  const idemMode = idempotency?.mode ?? 'batch';

  for (const item of inputs) {
    const uniqueBookIds = validateCreateOrderInput(buyerId, item);
    if (batchSellerIds.has(item.sellerId)) {
      throw new AppError(
        'ไม่สามารถส่งคำขอซื้อหลายออเดอร์พร้อมกันไปยังร้านเดียวกันได้',
        400,
        'DUPLICATE_SELLER_IN_BATCH',
        { sellerId: item.sellerId }
      );
    }
    batchSellerIds.add(item.sellerId);
    validatedEntries.push({
      input: item,
      uniqueBookIds,
      scopedKey: rawIdempotencyKey
        ? buildScopedIdempotencyKey(idemMode, buyerId, rawIdempotencyKey, item.sellerId)
        : undefined,
    });
  }

  const expectedScopedKeys = validatedEntries
    .map((e) => e.scopedKey)
    .filter((k): k is string => Boolean(k));

  const findPersistedByKeys = async (): Promise<CreateOrderResult[] | null> => {
    if (expectedScopedKeys.length === 0 || typeof db.order?.findMany !== 'function') {
      return null;
    }
    const existing = await db.order.findMany({
      where: { idempotencyKey: { in: expectedScopedKeys } },
    });
    if (!Array.isArray(existing) || existing.length !== expectedScopedKeys.length) {
      return null;
    }
    const byKey = new Map(existing.map((row: any) => [row.idempotencyKey, row]));
    const ordered = expectedScopedKeys.map((key) => byKey.get(key));
    if (ordered.some((row) => !row)) return null;
    return ordered.map(serializeExistingOrderResult);
  };

  const alreadyPersisted = await findPersistedByKeys();
  if (alreadyPersisted) {
    return { orders: alreadyPersisted };
  }

  let createdEntries: Array<{ result: CreateOrderResult; bookCount: number; sellerId: string }>;
  try {
    createdEntries = await db.$transaction(async (tx: any) => {
      const userRepo = tx.user?.findUnique ? tx.user : db.user;
      const orderRepo = tx.order?.count ? tx.order : db.order;

      const buyer = await userRepo.findUnique({
        where: { id: buyerId },
        select: { id: true, phoneNumber: true },
      });
      if (!buyer) {
        throw new AppError('ไม่พบบัญชีผู้ซื้อในระบบ', 404, 'USER_NOT_FOUND');
      }

      await expireOverdueRequestedOrders(tx, { buyerId });

      const pendingCount = await orderRepo.count({
        where: { buyerId, status: 'REQUESTED' },
      });

      if (pendingCount + validatedEntries.length > MAX_PENDING_REQUESTS) {
        throw new AppError(
          `คุณมีคำขอซื้อที่รอการตอบรับเกินโควต้าสูงสุด ${MAX_PENDING_REQUESTS} ออเดอร์แล้ว กรุณารอร้านค้าตอบรับหรือยกเลิกคำขอเดิม`,
          400,
          'TOO_MANY_PENDING_REQUESTS',
          { currentPending: pendingCount, maxPending: MAX_PENDING_REQUESTS }
        );
      }

      const results: Array<{ result: CreateOrderResult; bookCount: number; sellerId: string }> = [];
      for (const entry of validatedEntries) {
        results.push(
          await createOrderInTx(tx, db, buyerId, entry.input, entry.uniqueBookIds, entry.scopedKey)
        );
      }
      return results;
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const recovered = await findPersistedByKeys();
      if (recovered) {
        return { orders: recovered };
      }
    }
    throw error;
  }

  for (const created of createdEntries) {
    await safeNotifyOrder(
      {
        recipientUserId: created.sellerId,
        role: 'SELLER',
        orderId: created.result.orderId,
        title: 'มีคำขอสั่งซื้อหนังสือใหม่',
        message: `มีผู้สนใจสั่งซื้อหนังสือจำนวน ${created.bookCount} เล่ม (฿${created.result.totalPrice})`,
        badgeText: 'NEW ORDER REQUEST',
        linkPath: `/orders/${created.result.orderId}`,
      },
      db
    );
  }

  return {
    orders: createdEntries.map((entry) => entry.result),
  };
}

/**
 * ผู้ซื้อส่งคำขอซื้อสินค้าจากตะกร้า (POST /api/orders)
 * - 1 ออเดอร์ = 1 ร้านค้า
 * - จำกัดคำขอค้าง REQUESTED ไม่เกิน 10 ออเดอร์ และไม่เกิน 1 ออเดอร์ค้างต่อร้านค้าเดียวกัน
 * - คำนวณค่าส่งตามสูตร v4: PICKUP = ฿0, DELIVERY = ฿35 + ฿10*(N-1) + ฿15(ข้ามภาค)
 */
export async function createOrder(
  buyerId: string,
  input: CreateOrderInput,
  prismaClient?: any
): Promise<CreateOrderResult> {
  const scopeKey = input.idempotencyKey ? `single:${buyerId}:${input.idempotencyKey}` : undefined;
  return runWithIdempotency(scopeKey, async () => {
    const batch = await executeBatchOrders(buyerId, [input], prismaClient, {
      mode: 'single',
      key: input.idempotencyKey,
    });
    return batch.orders[0];
  });
}

/**
 * ผู้ซื้อส่งคำขอซื้อหลายร้านค้าพร้อมกันแบบ All-or-Nothing (POST /api/orders/batch)
 */
export async function createBatchOrders(
  buyerId: string,
  input: CreateBatchOrdersInput,
  prismaClient?: any
): Promise<CreateBatchOrdersResult> {
  const scopeKey = input.idempotencyKey ? `batch:${buyerId}:${input.idempotencyKey}` : undefined;
  return runWithIdempotency(scopeKey, () =>
    executeBatchOrders(buyerId, input.orders, prismaClient, {
      mode: 'batch',
      key: input.idempotencyKey,
    })
  );
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

  let order = await loadAndAuthorizeOrder(db, orderId, userId, {
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
      reviews: true,
      paymentSlips: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
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

  if (isRequestedOrderExpired(order)) {
    const updatedCount = await expireOverdueRequestedOrders(db, { id: orderId });
    if (updatedCount > 0) {
      order = { ...order, status: 'EXPIRED' };
    }
  } else if (isShippedOrderAutoCompletable(order)) {
    const completedCount = await autoCompleteOverdueShippedOrders(db, { id: orderId });
    if (completedCount > 0) {
      order = { ...order, status: 'COMPLETED' };
    }
  }

  const isSeller = userId === order.sellerId;
  const isBuyer = userId === order.buyerId;
  const paymentMethod = (order.paymentMethod || 'COD') as PaymentMethod;

  // กฎ PDPA:
  // - ผู้ซื้อเห็นที่อยู่/เบอร์ปลายทางของตนเองได้เสมอ
  // - ผู้ขายเห็นข้อมูลจัดส่งเฉพาะโหมด DELIVERY เมื่อ PAID, SHIPPED หรือ ACCEPTED (COD) เท่านั้น
  // - เบอร์ส่วนตัวในโปรไฟล์ผู้ซื้อ (buyer.phoneNumber) ไม่เปิดเผยให้ผู้ขายในทุกสถานะ
  // - ตัวตนผู้ซื้อ (nickname / avatarUrl) ถูกพรางจนกว่าผู้ขายจะกดรับออเดอร์ (พ้น REQUESTED)
  const sellerCanSeeDeliveryInfo =
    isSeller &&
    order.shippingMethod === 'DELIVERY' &&
    (order.status === 'PAID' ||
      order.status === 'SHIPPED' ||
      (paymentMethod === 'COD' && order.status === 'ACCEPTED'));

  const hideBuyerIdentityForSeller = isSeller && order.status === 'REQUESTED';

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

  const safeBuyerPhone = isBuyer ? order.buyer.phoneNumber ?? null : null;

  const buyerReview = Array.isArray(order.reviews)
    ? order.reviews.find((r: any) => !order.buyerId || r.reviewerId === order.buyerId) ||
      order.reviews[0]
    : null;

  const latestSlip = Array.isArray(order.paymentSlips) ? order.paymentSlips[0] : null;
  const resolvedPaymentSlipUrl = latestSlip?.slipImageUrl
    ? await resolveSignedStorageUrl('slips', latestSlip.slipImageUrl, latestSlip.storagePath)
    : null;

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
    missedMeetingReportedAt: order.missedMeetingReportedAt ?? null,
    cancelReason: order.cancelReason ?? null,
    review: buyerReview
      ? {
          rating: Number(buyerReview.rating),
          isConditionAccurate: buyerReview.isConditionAccurate ?? null,
          tags: Array.isArray(buyerReview.tags) ? buyerReview.tags : [],
          comment: buyerReview.comment ?? null,
          createdAt: buyerReview.createdAt,
        }
      : null,
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
      grade: item.bookListing.grade,
    })),
    buyer: {
      id: order.buyer.id,
      nickname: hideBuyerIdentityForSeller
        ? `ผู้ซื้อ #${order.id.slice(-4)}`
        : order.buyer.nickname || 'ผู้ซื้อกองดอง',
      avatarUrl: hideBuyerIdentityForSeller ? null : order.buyer.avatarUrl ?? null,
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
    paymentSlipUrl: resolvedPaymentSlipUrl,
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

  await expireOverdueRequestedOrders(db, {
    OR: [{ buyerId: userId }, { sellerId: userId }],
  });
  await autoCompleteOverdueShippedOrders(db, {
    OR: [{ buyerId: userId }, { sellerId: userId }],
  });

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
      buyerNickname:
        o.status === 'REQUESTED'
          ? `ผู้ซื้อ #${String(o.id).slice(-4)}`
          : o.buyer.nickname || 'ผู้ซื้อกองดอง',
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

    if (isRequestedOrderExpired(order)) {
      await updateOrderStatusAtomic(tx, orderId, 'REQUESTED', { status: 'EXPIRED' });
      return {
        expired: true as const,
        buyerId: order.buyerId,
      };
    }

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

    let remainingCredits: number | undefined;
    if (typeof tx?.user?.updateMany === 'function') {
      const debitResult = await tx.user.updateMany({
        where: { id: sellerId, credits: { gte: 1 } },
        data: { credits: { decrement: 1 } },
      });
      if (debitResult && typeof debitResult.count === 'number') {
        if (debitResult.count === 0) {
          throw new AppError(
            'เครดิตไม่เพียงพอ กรุณาเติมเครดิตก่อนรับคำสั่งซื้อ',
            400,
            'INSUFFICIENT_CREDITS'
          );
        }
        const refreshed =
          typeof tx.user.findUnique === 'function'
            ? await tx.user.findUnique({
                where: { id: sellerId },
                select: { credits: true },
              })
            : null;
        remainingCredits =
          refreshed?.credits !== undefined
            ? Number(refreshed.credits)
            : Number(order.seller.credits) - 1;
      }
    }

    if (remainingCredits === undefined) {
      const updatedSeller = await tx.user.update({
        where: { id: sellerId },
        data: { credits: { decrement: 1 } },
        select: { credits: true },
      });
      remainingCredits = Number(updatedSeller.credits);
    }

    await tx.creditTransaction.create({
      data: {
        userId: sellerId,
        amount: -1,
        balanceAfter: remainingCredits,
        type: 'ORDER_ACCEPT',
        orderId: order.id,
        note: 'หัก 1 เครดิตเมื่อกดรับคำสั่งซื้อ',
      },
    });

    const lockResult = await tx.bookListing.updateMany({
      where: { id: { in: bookListingIds }, status: 'AVAILABLE' },
      data: { status: 'RESERVED' },
    });

    if (
      lockResult &&
      typeof lockResult.count === 'number' &&
      lockResult.count !== bookListingIds.length
    ) {
      throw new AppError(
        'หนังสือบางเล่มถูกจองหรือขายไปแล้วระหว่างดำเนินการ กรุณารีเฟรชและลองใหม่อีกครั้ง',
        409,
        'BOOK_NOT_AVAILABLE'
      );
    }

    const competingOrderItems = await tx.orderItem.findMany({
      where: {
        bookListingId: { in: bookListingIds },
        orderId: { not: orderId },
        order: { status: 'REQUESTED' },
      },
      select: {
        orderId: true,
        order: { select: { buyerId: true } },
      },
    });

    const rejectedBuyerByOrder = new Map<string, string | undefined>();
    for (const item of competingOrderItems) {
      if (!rejectedBuyerByOrder.has(item.orderId)) {
        rejectedBuyerByOrder.set(item.orderId, item.order?.buyerId);
      }
    }
    const rejectedOrderIds: string[] = Array.from(rejectedBuyerByOrder.keys());

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

    await updateOrderStatusAtomic(tx, orderId, 'REQUESTED', {
      status: 'ACCEPTED',
      ...(shipBy ? { shipBy } : {}),
    });

    await createSystemOrderMessage(
      orderId,
      'ผู้ขายตอบรับคำสั่งซื้อแล้ว สามารถสื่อสารรายละเอียดการส่งมอบได้ในห้องแชทนี้',
      'SYSTEM',
      tx
    );

    return {
      expired: false as const,
      buyerId: order.buyerId,
      orderId,
      status: 'ACCEPTED' as const,
      remainingCredits,
      lockedBookIds: bookListingIds,
      rejectedOrderIds,
      rejectedOrders: Array.from(rejectedBuyerByOrder.entries()).map(([id, bId]) => ({
        orderId: id,
        buyerId: bId,
      })),
    };
  });

  if (result.expired) {
    await safeNotifyOrder(
      {
        recipientUserId: result.buyerId,
        role: 'BUYER',
        orderId,
        title: 'คำขอซื้อหมดอายุแล้ว',
        message: 'คำขอซื้อเกินกำหนด 24 ชั่วโมงแล้ว กรุณาส่งคำขอใหม่อีกครั้งหากยังต้องการสั่งซื้อ',
        badgeText: 'ORDER EXPIRED',
      },
      db
    );
    throw new AppError(
      'คำขอซื้อหมดอายุแล้ว (เกิน 24 ชั่วโมงโดยไม่มีการตอบรับ)',
      400,
      'ORDER_EXPIRED'
    );
  }

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

  for (const rejected of result.rejectedOrders) {
    if (!rejected.buyerId) continue;
    await safeNotifyOrder(
      {
        recipientUserId: rejected.buyerId,
        role: 'BUYER',
        orderId: rejected.orderId,
        title: 'คำขอซื้อถูกยกเลิกอัตโนมัติ',
        message: 'หนังสือบางเล่มในคำขอถูกขายให้ผู้ซื้อท่านอื่นแล้ว กรุณาเลือกหนังสือเล่มใหม่',
        badgeText: 'ORDER AUTO-REJECTED',
      },
      db
    );
  }

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

  const order = await withTransaction(db, async (tx: any) => {
    const loaded = await loadAndAuthorizeOrder(
      tx?.order?.findUnique ? tx : db,
      orderId,
      sellerId,
      {
        role: 'SELLER',
        forbiddenMessage: 'คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้',
        allowedStatuses: ['REQUESTED'],
        statusErrorBuilder: (s) => `ไม่สามารถปฏิเสธคำสั่งซื้อที่สถานะเป็น ${s} ได้`,
      }
    );

    const updateClient = tx?.order?.findUnique ? tx : db;
    await updateOrderStatusAtomic(updateClient, orderId, 'REQUESTED', {
      status: 'REJECTED',
    });

    return loaded;
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

    await updateOrderStatusAtomic(tx, orderId, order.status, {
      status: 'CANCELLED',
      cancelReason: trimmedReason,
      cancelledBy,
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
 * สร้าง PromptPay QR สำหรับผู้ซื้อชำระเงินค่าหนังสือ (GET /api/orders/:id/payment-qr)
 */
export async function getOrderPaymentQR(
  orderId: string,
  buyerId: string,
  prismaClient?: any
): Promise<{
  orderId: string;
  amount: number;
  recipientLabel: string;
  qrDataUrl: string;
  payload: string;
}> {
  const db = prismaClient || defaultPrisma;

  const order = await loadAndAuthorizeOrder(db, orderId, buyerId, {
    role: 'BUYER',
    shippingMethod: 'DELIVERY',
    shippingErrorMessage: 'คิวอาร์พร้อมเพย์ใช้สำหรับออเดอร์จัดส่งพัสดุเท่านั้น',
    allowedStatuses: ['ACCEPTED'],
    statusErrorBuilder: (s) =>
      `คำสั่งซื้อต้องอยู่ในสถานะ ACCEPTED เท่านั้นจึงจะสร้างคิวอาร์ชำระเงินได้ (สถานะปัจจุบัน: ${s})`,
    include: {
      seller: {
        include: {
          shopProfile: { select: { shopName: true } },
        },
      },
    },
  });

  if (normalizePaymentMethod(order.paymentMethod) === 'COD') {
    throw new AppError(
      'ออเดอร์นี้เลือกชำระแบบเก็บเงินปลายทาง (COD) ไม่ต้องชำระผ่าน PromptPay QR',
      400,
      'NOT_TRANSFER_ORDER'
    );
  }

  if (!order.seller?.promptpayId) {
    throw new AppError(
      'ร้านค้ายังไม่ได้ตั้งค่าบัญชีพร้อมเพย์รับเงิน',
      400,
      'SELLER_PROMPTPAY_NOT_CONFIGURED'
    );
  }

  const amount = Number(order.totalPrice);
  const qr = await generatePromptPayQR(order.seller.promptpayId, amount);

  const maskedVerified = maskAccountHolderName(order.seller.verifiedName);
  const shopName = order.seller.shopProfile?.shopName || order.seller.nickname || 'ร้านค้ากองดอง';
  const recipientLabel = maskedVerified ? `${maskedVerified} · ${shopName}` : shopName;

  return {
    orderId: order.id,
    amount,
    recipientLabel,
    qrDataUrl: qr.qrDataUrl,
    payload: qr.payload,
  };
}

/**
 * ผู้ซื้อแนบสลิปชำระเงินค่าหนังสือ (POST /api/orders/:id/payment-slip)
 */
export async function verifyOrderPaymentSlip(
  orderId: string,
  buyerId: string,
  input: PaymentSlipInput,
  prismaClient?: any,
  slipVerifier?: (
    slipImageUrl: string,
    options: { amount?: number; log?: boolean }
  ) => Promise<{ transRef: string; amount: number; receiverName?: string }>
): Promise<{ status: 'PAID'; verificationStatus: string; transRef: string }> {
  const db = prismaClient || defaultPrisma;

  if (!input.slipImageUrl) {
    throw new AppError('กรุณาแนบรูปลิงก์สลิปโอนเงิน (slipImageUrl)', 400, 'MISSING_SLIP_IMAGE');
  }

  // Real verification (SlipOK) runs before the DB transaction so a slow
  // network call never holds row locks. Its results replace client claims.
  if (slipVerifier) {
    const pending = await db.order.findUnique({ where: { id: orderId }, select: { totalPrice: true } });
    if (!pending) throw new AppError('ไม่พบคำสั่งซื้อ', 404, 'ORDER_NOT_FOUND');
    const verified = await slipVerifier(input.slipImageUrl, {
      amount: Number(pending.totalPrice),
      log: true,
    });
    input = {
      ...input,
      transRef: verified.transRef,
      amount: verified.amount,
      receiverName: verified.receiverName ?? input.receiverName,
    };
  } else if (env.NODE_ENV === 'production') {
    throw new AppError(
      'ระบบตรวจสลิปอัตโนมัติยังไม่ได้เปิดใช้งานใน Production (Missing SLIPOK_API_KEY)',
      503,
      'SLIP_VERIFIER_NOT_CONFIGURED'
    );
  }

  const transRef = input.transRef || `REF_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await loadAndAuthorizeOrder(readClient, orderId, buyerId, {
      role: 'BUYER',
      shippingMethod: 'DELIVERY',
      shippingErrorMessage: 'การแนบสลิปชำระเงินใช้สำหรับโหมดจัดส่งพัสดุเท่านั้น',
      allowedStatuses: ['ACCEPTED'],
      statusErrorBuilder: (s) =>
        `คำสั่งซื้อต้องอยู่ในสถานะ ACCEPTED เท่านั้นจึงจะชำระเงินได้ (สถานะปัจจุบัน: ${s})`,
      include: { seller: true },
    });

    if (order.paymentMethod === 'COD') {
      throw new AppError(
        'คำสั่งซื้อแบบเก็บเงินปลายทาง (COD) ไม่ต้องแนบสลิปโอนเงิน',
        400,
        'COD_ORDER_NO_SLIP'
      );
    }

    const slipClient = tx?.paymentSlip?.findFirst
      ? tx.paymentSlip
      : tx?.paymentSlip?.findUnique
      ? tx.paymentSlip
      : db.paymentSlip;

    const existingSlip =
      typeof slipClient?.findFirst === 'function'
        ? await slipClient.findFirst({
            where: {
              OR: [{ transRef }, { slipImageUrl: input.slipImageUrl }],
            },
          })
        : await slipClient.findUnique({
            where: { transRef },
          });

    if (existingSlip) {
      throw new AppError('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)', 400, 'DUPLICATE_SLIP');
    }

    const slipAmount = input.amount !== undefined ? Number(input.amount) : Number(order.totalPrice);
    if (!Number.isFinite(slipAmount) || Math.abs(slipAmount - Number(order.totalPrice)) > 0.01) {
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

    const storagePath =
      input.storagePath?.trim() || extractStoragePathFromUrl('slips', input.slipImageUrl);

    try {
      await tx.paymentSlip.create({
        data: {
          userId: buyerId,
          orderId,
          slipType: 'ORDER_PAYMENT',
          slipImageUrl: input.slipImageUrl,
          ...(storagePath ? { storagePath } : {}),
          transRef,
          amount: slipAmount,
          receiverName: input.receiverName || order.seller.verifiedName,
          verificationStatus: 'AUTO_VERIFIED',
          verifiedAt: new Date(),
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new AppError('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)', 400, 'DUPLICATE_SLIP');
      }
      throw err;
    }

    await updateOrderStatusAtomic(tx, orderId, 'ACCEPTED', {
      status: 'PAID',
    });

    return { sellerId: order.sellerId };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.sellerId,
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

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await loadAndAuthorizeOrder(readClient, orderId, sellerId, {
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

    await tx.orderDeliveryDetail.update({
      where: { orderId },
      data: {
        courierName: input.courierName,
        trackingNumber: input.trackingNumber,
        parcelImageUrl: input.parcelImageUrl || null,
        shippedAt: new Date(),
      },
    });

    await updateOrderStatusAtomic(tx, orderId, order.status, {
      status: 'SHIPPED',
    });

    await createSystemOrderMessage(
      orderId,
      `ผู้ขายจัดส่งพัสดุแล้ว (${input.courierName}: ${input.trackingNumber})`,
      'SYSTEM',
      tx
    );

    return { buyerId: order.buyerId };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.buyerId,
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

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await loadAndAuthorizeOrder(readClient, orderId, buyerId, {
      role: 'BUYER',
      shippingMethod: 'DELIVERY',
      allowedStatuses: ['SHIPPED'],
      statusErrorBuilder: (s) =>
        `ออเดอร์ต้องอยู่ในสถานะ SHIPPED เท่านั้นจึงจะยืนยันรับของได้ (สถานะปัจจุบัน: ${s})`,
      include: { orderItems: true },
    });

    await markOrderCompleted(tx, order);
    return { sellerId: order.sellerId };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.sellerId,
      role: 'SELLER',
      orderId,
      title: 'ผู้ซื้อยืนยันได้รับหนังสือแล้ว!',
      message: 'คำสั่งซื้อเสร็จสมบูรณ์เรียบร้อยแล้ว',
      badgeText: 'COMPLETED',
    },
    db
  );

  return { orderId, status: 'COMPLETED' };
}

/**
 * ผู้ซื้อถ่ายรูปยืนยันรับหนังสือพร้อมรีวิว (POST /api/orders/:id/receive)
 * รองรับเฉพาะโหมด DELIVERY (SHIPPED -> COMPLETED) ส่วนนัดรับต้องให้ผู้ขายกรอกรหัส 6 หลักเท่านั้น
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

  const receivedAt = new Date();

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await loadAndAuthorizeOrder(readClient, orderId, buyerId, {
      role: 'BUYER',
      include: { orderItems: true },
    });

    if (order.shippingMethod !== 'DELIVERY') {
      throw new AppError(
        'การยืนยันรับสินค้าผ่านหน้านี้รองรับเฉพาะคำสั่งซื้อแบบจัดส่งพัสดุ (DELIVERY) เท่านั้น สำหรับนัดรับกรุณาใช้รหัสส่งมอบ 6 หลัก',
        400,
        'PICKUP_USE_HANDOVER_CODE'
      );
    }

    if (order.status !== 'SHIPPED') {
      throw new AppError(
        `ไม่สามารถยืนยันรับหนังสือในสถานะ ${order.status} ได้ (ต้องอยู่ในสถานะ SHIPPED)`,
        400,
        'INVALID_ORDER_STATUS'
      );
    }

    await markOrderCompleted(tx, order, {
      receivedPhotoUrl: input.receivedPhotoUrl,
      receivedAt,
    });

    if (input.review && tx.review?.create) {
      const rating = Math.round(Number(input.review.rating));
      if (isNaN(rating) || rating < 1 || rating > 5) {
        throw new AppError('คะแนนรีวิวต้องอยู่ระหว่าง 1 ถึง 5 ดาว', 400, 'INVALID_RATING');
      }

      if (typeof tx.review.findFirst === 'function') {
        const existing = await tx.review.findFirst({
          where: { orderId, reviewerId: buyerId },
          select: { id: true },
        });
        if (existing) {
          throw new AppError('คุณได้รีวิวคำสั่งซื้อนี้ไปแล้ว', 400, 'ALREADY_REVIEWED');
        }
      }

      const tags = Array.isArray(input.review.tags)
        ? input.review.tags.map((t) => String(t).trim()).filter(Boolean)
        : [];
      const rawComment = input.review.comment ? input.review.comment.trim() : '';
      const safeComment = rawComment ? maskSensitiveData(rawComment).maskedText : null;

      try {
        await tx.review.create({
          data: {
            orderId,
            reviewerId: buyerId,
            revieweeId: order.sellerId,
            rating,
            isConditionAccurate: Boolean(input.review.isConditionAccurate),
            tags,
            comment: safeComment,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          throw new AppError('คุณได้รีวิวคำสั่งซื้อนี้ไปแล้ว', 400, 'ALREADY_REVIEWED');
        }
        throw err;
      }
    }

    await createSystemOrderMessage(
      orderId,
      'ผู้ซื้อยืนยันได้รับหนังสือเรียบร้อยแล้ว คำสั่งซื้อเสร็จสมบูรณ์',
      'SYSTEM',
      tx
    );

    return { sellerId: order.sellerId };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.sellerId,
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
  _orderId: string,
  _sellerId: string,
  _prismaClient?: any
): Promise<{ orderId: string; status: 'COMPLETED'; soldBookIds: string[] }> {
  throw new AppError(
    'สำหรับการนัดรับ กรุณาให้ผู้ซื้อแสดงรหัสส่งมอบ 6 หลัก และให้ผู้ขายกรอกรหัสผ่าน /api/orders/:id/handover เพื่อปิดออเดอร์',
    400,
    'HANDOVER_CODE_REQUIRED'
  );
}

/**
 * ผู้ขายกดรายงานว่า "ผู้ซื้อไม่มาตามนัด" (POST /api/orders/:id/report-missed-meeting)
 * เปลี่ยนสถานะเป็น DISPUTED ทันทีเพื่อให้ผู้ซื้อโต้แย้งและแอดมินตรวจสอบได้
 */
export async function reportMissedMeeting(
  orderId: string,
  sellerId: string,
  reasonOrDb?: string | any,
  prismaClient?: any
): Promise<{ orderId: string; status: 'DISPUTED'; missedMeetingReportedAt: Date }> {
  const reason = typeof reasonOrDb === 'string' ? reasonOrDb.trim() : '';
  const db =
    (typeof reasonOrDb === 'string' ? prismaClient : reasonOrDb) || defaultPrisma;
  const disputeReason = reason || 'ผู้ขายรายงานว่าผู้ซื้อไม่มาตามนัด';

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await loadAndAuthorizeOrder(readClient, orderId, sellerId, {
      role: 'SELLER',
      shippingMethod: 'PICKUP',
      shippingErrorMessage: 'การรายงานไม่มาตามนัดใช้สำหรับโหมดนัดรับเท่านั้น',
      allowedStatuses: ['SCHEDULED'],
      statusErrorBuilder: (s) => `ออเดอร์ต้องอยู่ในสถานะ SCHEDULED เท่านั้น (สถานะปัจจุบัน: ${s})`,
    });

    if (!order.scheduledAt) {
      throw new AppError('ยังไม่ได้ระบุวันเวลานัดหมาย', 400, 'NOT_SCHEDULED');
    }

    if (!order.scheduleConfirmedByBuyer) {
      throw new AppError(
        'ผู้ซื้อยังไม่ได้ยืนยันเวลานัดหมายนี้ จึงยังไม่สามารถรายงานไม่มาตามนัดได้',
        400,
        'SCHEDULE_NOT_CONFIRMED_BY_BUYER'
      );
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
    const writeClient = tx?.order?.findUnique ? tx : db;
    await updateOrderStatusAtomic(writeClient, orderId, 'SCHEDULED', {
      status: 'DISPUTED',
      missedMeetingReportedAt,
      disputedBy: sellerId,
      disputeOpenedBy: 'SELLER',
      disputeReason,
      disputedAt: missedMeetingReportedAt,
    });

    if (tx?.orderMessage?.create || db?.orderMessage?.create) {
      await createSystemOrderMessage(
        orderId,
        `ผู้ขายรายงานว่าไม่พบผู้รับตามนัด: ${disputeReason}`,
        'SYSTEM',
        tx?.orderMessage?.create ? tx : db
      );
    }

    return { buyerId: order.buyerId, missedMeetingReportedAt };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.buyerId,
      role: 'BUYER',
      orderId,
      title: 'ผู้ขายรายงานว่าไม่พบผู้รับตามนัด',
      message: 'หากเป็นความเข้าใจผิด สามารถกดโต้แย้งได้ภายในห้องแชทคำสั่งซื้อ',
      badgeText: 'MISSED MEETING',
    },
    db
  );

  return {
    orderId,
    status: 'DISPUTED',
    missedMeetingReportedAt: outcome.missedMeetingReportedAt,
  };
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

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await loadAndAuthorizeOrder(readClient, orderId, userId, {
      role: 'PARTICIPANT',
      forbiddenMessage: 'คุณไม่มีสิทธิ์เปิดข้อพิพาทสำหรับคำสั่งซื้อนี้',
      allowedStatuses: ['ACCEPTED', 'SCHEDULED', 'PAID', 'SHIPPED'],
      statusErrorBuilder: (s) => `ไม่สามารถเปิดข้อพิพาทในสถานะ ${s} ได้`,
    });

    const isBuyer = order.buyerId === userId;
    const writeClient = tx?.order?.findUnique ? tx : db;

    await updateOrderStatusAtomic(writeClient, orderId, order.status, {
      status: 'DISPUTED',
      disputedBy: userId,
      disputeOpenedBy: isBuyer ? 'BUYER' : 'SELLER',
      disputeReason: trimmedReason,
      disputedAt: new Date(),
    });

    if (tx?.orderMessage?.create || db?.orderMessage?.create) {
      await createSystemOrderMessage(
        orderId,
        `เปิดข้อพิพาทโดย${isBuyer ? 'ผู้ซื้อ' : 'ผู้ขาย'}: ${trimmedReason}`,
        'SYSTEM',
        tx?.orderMessage?.create ? tx : db
      );
    }

    return {
      isBuyer,
      recipientUserId: isBuyer ? order.sellerId : order.buyerId,
    };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.recipientUserId,
      role: outcome.isBuyer ? 'SELLER' : 'BUYER',
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
    allowedStatuses: ['SCHEDULED', 'DISPUTED'],
    statusErrorBuilder: (s) => `ไม่สามารถโต้แย้งรายงานไม่มาตามนัดในสถานะ ${s} ได้`,
  });

  if (!order.missedMeetingReportedAt) {
    throw new AppError(
      'คำสั่งซื้อนี้ยังไม่มีการรายงานไม่มาตามนัด',
      400,
      'NO_MISSED_MEETING_REPORT'
    );
  }

  const rebuttalReason = (reason || '').trim() || 'โต้แย้งการรายงานไม่มาตามนัดหมาย';

  if (order.status === 'SCHEDULED') {
    return openDispute(orderId, buyerId, rebuttalReason, prismaClient);
  }

  const combinedReason = order.disputeReason
    ? `${order.disputeReason}\n[คำโต้แย้งจากผู้ซื้อ]: ${rebuttalReason}`
    : rebuttalReason;

  await withTransaction(db, async (tx: any) => {
    const writeClient = tx?.order?.findUnique ? tx : db;
    await updateOrderStatusAtomic(writeClient, orderId, 'DISPUTED', {
      disputeReason: combinedReason,
    });

    if (tx?.orderMessage?.create || db?.orderMessage?.create) {
      await createSystemOrderMessage(
        orderId,
        `คำโต้แย้งจากผู้ซื้อกรณีไม่มาตามนัด: ${rebuttalReason}`,
        'SYSTEM',
        tx?.orderMessage?.create ? tx : db
      );
    }
  });

  await safeNotifyOrder(
    {
      recipientUserId: order.sellerId,
      role: 'SELLER',
      orderId,
      title: 'ผู้ซื้อส่งคำโต้แย้งกรณีไม่มาตามนัด',
      message: `เหตุผล: ${rebuttalReason}`,
      badgeText: 'DISPUTE REBUTTAL',
    },
    db
  );

  return { orderId, status: 'DISPUTED', disputeReason: combinedReason };
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

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await loadAndAuthorizeOrder(readClient, orderId, userId, {
      role: 'PARTICIPANT',
      shippingMethod: 'PICKUP',
      allowedStatuses: ['ACCEPTED', 'SCHEDULED'],
      statusErrorBuilder: (s) => `ไม่สามารถบันทึกนัดหมายได้เนื่องจากสถานะปัจจุบันคือ ${s}`,
    });

    validatePickupCoordinates(input.pickupLat, input.pickupLng);

    const handoverCode = order.handoverCode || generateHandoverCode();
    const scheduledAt = new Date(input.scheduledAt);
    validateScheduledAtFuture(scheduledAt);

    const actorRole = order.buyerId === userId ? 'BUYER' : 'SELLER';
    const writeClient = tx?.order?.findUnique ? tx : db;

    await updateOrderStatusAtomic(writeClient, orderId, order.status, {
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
      scheduleConfirmedByBuyer: actorRole === 'BUYER',
    });

    await createSystemOrderMessage(
      orderId,
      `อัปเดตเวลานัดรับ: ${input.pickupLocationName || 'จุดนัดรับ'} (${
        input.scheduleTimeLabel || scheduledAt.toISOString()
      })`,
      'SCHEDULE_CARD',
      tx?.orderMessage?.create ? tx : db
    );

    return {
      scheduledAt,
      handoverCode,
      actorRole,
      recipientUserId: actorRole === 'BUYER' ? order.sellerId : order.buyerId,
      recipientRole: (actorRole === 'BUYER' ? 'SELLER' : 'BUYER') as 'BUYER' | 'SELLER',
    };
  });

  const scheduleSummary = `${input.pickupLocationName || 'จุดนัดรับ'} (${
    input.scheduleTimeLabel || outcome.scheduledAt.toISOString()
  })`;

  await safeNotifyOrder(
    {
      recipientUserId: outcome.recipientUserId,
      role: outcome.recipientRole,
      orderId,
      title:
        outcome.actorRole === 'SELLER'
          ? 'ผู้ขายเสนอนัดรับหนังสือ'
          : 'ผู้ซื้อยืนยัน/อัปเดตเวลานัดรับแล้ว',
      message:
        outcome.actorRole === 'SELLER'
          ? `จุดนัดรับ: ${scheduleSummary} · กรุณาตรวจสอบและกดยืนยันนัดหมาย`
          : `ยืนยันนัดรับที่ ${scheduleSummary}`,
      badgeText:
        outcome.actorRole === 'SELLER' ? 'SCHEDULE PROPOSED' : 'SCHEDULE CONFIRMED',
    },
    db
  );

  return {
    orderId,
    status: 'SCHEDULED',
    scheduledAt: outcome.scheduledAt,
    handoverCode: outcome.handoverCode,
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

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await loadAndAuthorizeOrder(readClient, orderId, sellerId, {
      role: 'SELLER',
      shippingMethod: 'PICKUP',
      allowedStatuses: ['SCHEDULED'],
      statusErrorBuilder: (s) =>
        `ออเดอร์ต้องอยู่ในสถานะ SCHEDULED เท่านั้นเพื่อตรวจรหัสส่งมอบ (สถานะปัจจุบัน: ${s})`,
      include: { orderItems: true },
    });

    const attemptKey = `${orderId}:${sellerId}`;
    const now = Date.now();
    const attemptEntry = handoverAttemptsStore.get(attemptKey);
    if (attemptEntry && attemptEntry.lockedUntil > now) {
      throw new AppError(
        'กรอกรหัสส่งมอบผิดเกินจำนวนครั้งที่กำหนด กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง',
        429,
        'HANDOVER_RATE_LIMITED'
      );
    }

    const cleanInputCode = (handoverCode || '').trim();
    if (!cleanInputCode || cleanInputCode !== order.handoverCode) {
      const prevCount =
        attemptEntry && attemptEntry.windowExpiresAt > now ? attemptEntry.failedCount : 0;
      const nextCount = prevCount + 1;
      const isNowLocked = nextCount >= HANDOVER_MAX_ATTEMPTS;
      handoverAttemptsStore.set(attemptKey, {
        failedCount: nextCount,
        windowExpiresAt: now + HANDOVER_LOCKOUT_MS,
        lockedUntil: isNowLocked ? now + HANDOVER_LOCKOUT_MS : 0,
      });

      if (isNowLocked) {
        throw new AppError(
          'กรอกรหัสส่งมอบผิดเกิน 5 ครั้ง ระบบล็อกชั่วคราว 15 นาที',
          429,
          'HANDOVER_RATE_LIMITED'
        );
      }

      throw new AppError(
        'รหัสส่งมอบ 6 หลักไม่ถูกต้อง ให้ผู้ขายตรวจดูรหัสบนหน้าจอลูกค้าอีกครั้ง',
        400,
        'INVALID_HANDOVER_CODE'
      );
    }

    handoverAttemptsStore.delete(attemptKey);

    const soldBookIds = await markOrderCompleted(tx, order);

    if (tx?.orderMessage?.create) {
      await createSystemOrderMessage(
        orderId,
        'ผู้ขายยืนยันรหัสส่งมอบ 6 หลักเรียบร้อยแล้ว คำสั่งซื้อเสร็จสมบูรณ์',
        'SYSTEM',
        tx
      );
    }

    return {
      buyerId: order.buyerId,
      soldBookIds,
    };
  });

  await safeNotifyOrder(
    {
      recipientUserId: outcome.buyerId,
      role: 'BUYER',
      orderId,
      title: 'นัดรับหนังสือสำเร็จ!',
      message: 'ผู้ขายยืนยันรหัสส่งมอบ 6 หลักเรียบร้อยแล้ว อย่าลืมให้คะแนนร้านค้านะครับ',
      badgeText: 'MEETUP COMPLETED',
    },
    db
  );

  return {
    orderId,
    status: 'COMPLETED',
    soldBookIds: outcome.soldBookIds,
  };
}

export interface ResolveDisputedOrderInput {
  resolution: 'COMPLETED' | 'CANCELLED';
  adminNote: string;
  refundCredit?: boolean;
  incrementBuyerNoShow?: boolean;
}

export interface ResolveDisputedOrderResult {
  orderId: string;
  status: 'COMPLETED' | 'CANCELLED';
  refundedCredit: boolean;
  incrementedBuyerNoShow: boolean;
  releasedBookIds: string[];
  soldBookIds: string[];
}

/**
 * แอดมินสรุปและปิดเคสข้อพิพาท (POST /api/admin/orders/:id/resolve)
 */
export async function resolveDisputedOrder(
  orderId: string,
  input: ResolveDisputedOrderInput,
  prismaClient?: any
): Promise<ResolveDisputedOrderResult> {
  const db = prismaClient || defaultPrisma;
  const trimmedNote = (input.adminNote || '').trim();

  if (!trimmedNote) {
    throw new AppError('กรุณาระบุหมายเหตุการตัดสินของแอดมิน', 400, 'ADMIN_NOTE_REQUIRED');
  }

  if (input.resolution !== 'COMPLETED' && input.resolution !== 'CANCELLED') {
    throw new AppError(
      'ค่า resolution ต้องเป็น COMPLETED หรือ CANCELLED เท่านั้น',
      400,
      'INVALID_RESOLUTION'
    );
  }

  const outcome = await withTransaction(db, async (tx: any) => {
    const readClient = tx?.order?.findUnique ? tx : db;
    const order = await readClient.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status !== 'DISPUTED') {
      throw new AppError(
        `คำสั่งซื้อต้องอยู่ในสถานะ DISPUTED เท่านั้นจึงจะปิดข้อพิพาทได้ (สถานะปัจจุบัน: ${order.status})`,
        400,
        'INVALID_ORDER_STATUS'
      );
    }

    const writeClient = tx?.order?.updateMany || tx?.order?.update ? tx : db;
    const bookIds = (order.orderItems || []).map((i: any) => i.bookListingId).filter(Boolean);

    if (input.resolution === 'COMPLETED') {
      const soldBookIds = await markOrderCompleted(writeClient, order);
      if (writeClient?.orderMessage?.create) {
        await createSystemOrderMessage(
          orderId,
          `แอดมินสรุปข้อพิพาท: ปิดการขายสำเร็จ (${trimmedNote})`,
          'SYSTEM',
          writeClient
        );
      }

      return {
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        status: 'COMPLETED' as const,
        refundedCredit: false,
        incrementedBuyerNoShow: false,
        releasedBookIds: [] as string[],
        soldBookIds,
      };
    }

    await updateOrderStatusAtomic(writeClient, orderId, 'DISPUTED', {
      status: 'CANCELLED',
      cancelReason: `[แอดมิน] ${trimmedNote}`,
      cancelledBy: 'ADMIN',
    });

    if (bookIds.length > 0 && writeClient?.bookListing?.updateMany) {
      await writeClient.bookListing.updateMany({
        where: { id: { in: bookIds } },
        data: { status: 'AVAILABLE' },
      });
    }

    let refundedCredit = false;
    if (input.refundCredit && writeClient?.user?.update) {
      const updatedSeller = await writeClient.user.update({
        where: { id: order.sellerId },
        data: { credits: { increment: 1 } },
        select: { credits: true },
      });
      if (writeClient?.creditTransaction?.create) {
        await writeClient.creditTransaction.create({
          data: {
            userId: order.sellerId,
            amount: 1,
            balanceAfter: updatedSeller?.credits,
            type: 'REFUND_DISPUTE',
            orderId,
            note: `คืน 1 เครดิตจากการตัดสินข้อพิพาทโดยแอดมิน: ${trimmedNote}`,
          },
        });
      }
      refundedCredit = true;
    }

    let incrementedBuyerNoShow = false;
    if (input.incrementBuyerNoShow && writeClient?.user?.update) {
      await writeClient.user.update({
        where: { id: order.buyerId },
        data: { noShowCount: { increment: 1 } },
      });
      incrementedBuyerNoShow = true;
    }

    if (writeClient?.orderMessage?.create) {
      await createSystemOrderMessage(
        orderId,
        `แอดมินสรุปข้อพิพาท: ยกเลิกคำสั่งซื้อ (${trimmedNote})`,
        'SYSTEM',
        writeClient
      );
    }

    return {
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: 'CANCELLED' as const,
      refundedCredit,
      incrementedBuyerNoShow,
      releasedBookIds: bookIds,
      soldBookIds: [] as string[],
    };
  });

  const summaryMsg =
    outcome.status === 'COMPLETED'
      ? `แอดมินสรุปข้อพิพาท: ปิดการขายสำเร็จ (${trimmedNote})`
      : `แอดมินสรุปข้อพิพาท: ยกเลิกคำสั่งซื้อ (${trimmedNote})`;

  await safeNotifyOrder(
    {
      recipientUserId: outcome.buyerId,
      role: 'BUYER',
      orderId,
      title: 'ข้อพิพาทได้รับการตัดสินแล้ว',
      message: summaryMsg,
      badgeText: 'DISPUTE RESOLVED',
    },
    db
  );
  await safeNotifyOrder(
    {
      recipientUserId: outcome.sellerId,
      role: 'SELLER',
      orderId,
      title: 'ข้อพิพาทได้รับการตัดสินแล้ว',
      message: summaryMsg,
      badgeText: 'DISPUTE RESOLVED',
    },
    db
  );

  return {
    orderId,
    status: outcome.status,
    refundedCredit: outcome.refundedCredit,
    incrementedBuyerNoShow: outcome.incrementedBuyerNoShow,
    releasedBookIds: outcome.releasedBookIds,
    soldBookIds: outcome.soldBookIds,
  };
}

/**
 * งานกวาดออเดอร์หมดอายุอัตโนมัติ (เรียกผ่าน Cron Endpoint และ Lazy Expiration):
 * - REQUESTED เกิน 24 ชม. -> EXPIRED
 * - SHIPPED (DELIVERY) เกิน 7 วัน -> COMPLETED
 */
export async function expireStaleOrders(
  prismaClient?: any
): Promise<{ expiredRequestedCount: number; autoCompletedShippedCount: number }> {
  const db = prismaClient || defaultPrisma;
  const expiredRequestedCount = await expireOverdueRequestedOrders(db, {}, { notify: true });
  const autoCompletedShippedCount = await autoCompleteOverdueShippedOrders(db, {}, { notify: true });
  return {
    expiredRequestedCount,
    autoCompletedShippedCount,
  };
}

export type AdminOrderStatusFilter = 'DISPUTED' | 'RESOLVED' | 'ALL';

export interface AdminOrderListItem {
  id: string;
  status: string;
  shippingMethod: string;
  paymentMethod: PaymentMethod;
  totalPrice: number;
  shippingFee: number;
  cancelReason: string | null;
  receivedPhotoUrl: string | null;
  paymentSlipUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  dispute: {
    reason: string | null;
    openedBy: string | null;
    openedAt: Date | null;
    missedMeetingReportedAt: Date | null;
  };
  schedule: {
    locationName: string | null;
    dateIso: string | null;
    timeLabel: string | null;
    scheduledAt: Date | null;
    confirmedByBuyer: boolean;
  } | null;
  buyer: {
    id: string;
    nickname: string | null;
    displayName: string;
    avatarUrl: string | null;
    noShowCount: number;
  };
  seller: {
    id: string;
    nickname: string | null;
    displayName: string;
    shopName: string | null;
    credits: number;
  };
  items: Array<{
    bookId: string;
    title: string;
    price: number;
    grade: string;
    coverImageUrl: string;
  }>;
  recentMessages: Array<{
    id: string;
    senderRole: string;
    senderName: string | null;
    kind: string;
    text: string;
    createdAt: Date;
  }>;
}

/**
 * ดึงรายการคำสั่งซื้อที่มีข้อพิพาทสำหรับ Admin UI (GET /api/admin/orders?status=DISPUTED)
 */
export async function getAdminOrders(
  options: { status?: AdminOrderStatusFilter } = {},
  prismaClient?: any
): Promise<AdminOrderListItem[]> {
  const db = prismaClient || defaultPrisma;
  const filter = options.status || 'DISPUTED';

  const where =
    filter === 'RESOLVED'
      ? {
          status: { in: ['COMPLETED', 'CANCELLED'] },
          OR: [
            { disputeOpenedBy: { not: null } },
            { disputedAt: { not: null } },
            { cancelledBy: 'ADMIN' },
          ],
        }
      : filter === 'ALL'
      ? {
          OR: [
            { status: 'DISPUTED' },
            { disputeOpenedBy: { not: null } },
            { disputedAt: { not: null } },
          ],
        }
      : { status: 'DISPUTED' };

  const orders = await db.order.findMany({
    where,
    orderBy: [{ disputedAt: 'desc' }, { updatedAt: 'desc' }],
    take: 50,
    include: {
      buyer: {
        select: {
          id: true,
          nickname: true,
          displayName: true,
          avatarUrl: true,
          noShowCount: true,
        },
      },
      seller: {
        select: {
          id: true,
          nickname: true,
          displayName: true,
          credits: true,
          shopProfile: { select: { shopName: true } },
        },
      },
      orderItems: {
        include: {
          bookListing: {
            include: {
              bookCatalog: { select: { title: true, coverUrl: true } },
              images: {
                orderBy: [{ isCover: 'desc' }, { displayOrder: 'asc' }],
                take: 1,
              },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          sender: { select: { id: true, nickname: true, displayName: true } },
        },
      },
      paymentSlips: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return await Promise.all(
    (orders || []).map(async (order: any): Promise<AdminOrderListItem> => {
      const latestSlip = Array.isArray(order.paymentSlips) ? order.paymentSlips[0] : null;
      const paymentSlipUrl = latestSlip?.slipImageUrl
        ? await resolveSignedStorageUrl('slips', latestSlip.slipImageUrl, latestSlip.storagePath)
        : null;

      const rawMessages = Array.isArray(order.messages) ? [...order.messages].reverse() : [];

      return {
        id: order.id,
        status: order.status,
        shippingMethod: order.shippingMethod,
        paymentMethod: (order.paymentMethod || 'COD') as PaymentMethod,
        totalPrice: Number(order.totalPrice),
        shippingFee: Number(order.shippingFee),
        cancelReason: order.cancelReason ?? null,
        receivedPhotoUrl: order.receivedPhotoUrl ?? null,
        paymentSlipUrl,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        dispute: {
          reason: order.disputeReason ?? null,
          openedBy: order.disputeOpenedBy ?? null,
          openedAt: order.disputedAt ?? null,
          missedMeetingReportedAt: order.missedMeetingReportedAt ?? null,
        },
        schedule:
          order.shippingMethod === 'PICKUP' &&
          (order.scheduledAt || order.pickupLocationName || order.scheduleDateIso)
            ? {
                locationName: order.pickupLocationName ?? null,
                dateIso: order.scheduleDateIso ?? null,
                timeLabel: order.scheduleTimeLabel ?? null,
                scheduledAt: order.scheduledAt ?? null,
                confirmedByBuyer: Boolean(order.scheduleConfirmedByBuyer),
              }
            : null,
        buyer: {
          id: order.buyer?.id || order.buyerId,
          nickname: order.buyer?.nickname ?? null,
          displayName: order.buyer?.displayName || 'ผู้ซื้อ',
          avatarUrl: order.buyer?.avatarUrl ?? null,
          noShowCount: order.buyer?.noShowCount ?? 0,
        },
        seller: {
          id: order.seller?.id || order.sellerId,
          nickname: order.seller?.nickname ?? null,
          displayName: order.seller?.displayName || 'ผู้ขาย',
          shopName: order.seller?.shopProfile?.shopName ?? null,
          credits: order.seller?.credits ?? 0,
        },
        items: (order.orderItems || []).map((item: any) => ({
          bookId: item.bookListingId,
          title: item.bookListing?.bookCatalog?.title || 'หนังสือ',
          price: Number(item.price),
          grade: item.bookListing?.grade || '',
          coverImageUrl:
            item.bookListing?.images?.[0]?.imageUrl ||
            item.bookListing?.bookCatalog?.coverUrl ||
            '',
        })),
        recentMessages: rawMessages.map((msg: any) => ({
          id: msg.id,
          senderRole: msg.senderRole,
          senderName: msg.sender?.nickname || msg.sender?.displayName || null,
          kind: msg.kind,
          text: msg.text,
          createdAt: msg.createdAt,
        })),
      };
    })
  );
}
