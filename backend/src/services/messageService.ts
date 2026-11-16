import { prisma } from '../config/prisma';
import { AppError } from '../types';
import { maskSensitiveData } from './dataMaskingService';
import { notifyOrderEvent } from './lineNotifyService';

const BLOCKED_CHAT_STATUSES = new Set(['REQUESTED', 'REJECTED', 'EXPIRED']);
const READONLY_CHAT_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
const MAX_MESSAGE_LENGTH = 1000;
export const CHAT_NOTIFY_COOLDOWN_MS = 3 * 60 * 1000;

export interface SendOrderMessageInput {
  text: string;
  kind?: 'TEXT' | 'SCHEDULE_CARD';
}

export interface OrderMessageItem {
  id: string;
  orderId: string;
  senderId: string | null;
  senderRole: string;
  kind: string;
  text: string;
  isMasked: boolean;
  createdAt: Date;
  sender: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  } | null;
}

async function verifyOrderParticipant(orderId: string, userId: string, db: any) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, buyerId: true, sellerId: true, status: true },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  if (order.buyerId !== userId && order.sellerId !== userId) {
    throw new AppError('คุณไม่มีสิทธิ์เข้าถึงห้องแชทของคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  return order;
}

function formatOrderMessage(msg: any): OrderMessageItem {
  return {
    id: msg.id,
    orderId: msg.orderId,
    senderId: msg.senderId,
    senderRole: msg.senderRole,
    kind: msg.kind,
    text: msg.text,
    isMasked: msg.isMasked,
    createdAt: msg.createdAt,
    sender: msg.sender
      ? {
          id: msg.sender.id,
          nickname: msg.sender.nickname,
          avatarUrl: msg.sender.avatarUrl,
        }
      : null,
  };
}

/**
 * ดึงประวัติข้อความในห้องแชทของคำสั่งซื้อ (ซ่อนห้องแชทหากผู้ขายยังไม่ตอบรับ)
 */
export async function getOrderMessages(
  orderId: string,
  userId: string,
  prismaClient: any = prisma
): Promise<OrderMessageItem[]> {
  const order = await verifyOrderParticipant(orderId, userId, prismaClient);

  if (BLOCKED_CHAT_STATUSES.has(order.status)) {
    return [];
  }

  const messages = await prismaClient.orderMessage.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
  });

  return messages.map(formatOrderMessage);
}

/**
 * ส่งข้อความในห้องแชทคำสั่งซื้อ พร้อมปิดบังข้อมูลส่วนตัว (PDPA Masking) อัตโนมัติ
 */
export async function sendOrderMessage(
  orderId: string,
  userId: string,
  input: SendOrderMessageInput,
  prismaClient: any = prisma
): Promise<OrderMessageItem> {
  const order = await verifyOrderParticipant(orderId, userId, prismaClient);

  if (BLOCKED_CHAT_STATUSES.has(order.status)) {
    throw new AppError(
      'ห้องแชทจะเปิดใช้งานหลังจากผู้ขายตอบรับคำสั่งซื้อแล้ว',
      400,
      'CHAT_NOT_OPEN'
    );
  }

  if (READONLY_CHAT_STATUSES.has(order.status)) {
    throw new AppError(
      'คำสั่งซื้อนี้เสร็จสิ้นหรือยกเลิกแล้ว ห้องแชทอยู่ในโหมดอ่านอย่างเดียว',
      400,
      'CHAT_READ_ONLY'
    );
  }

  const rawText = (input.text || '').trim();
  if (!rawText) {
    throw new AppError('กรุณาระบุข้อความก่อนส่ง', 400, 'EMPTY_MESSAGE');
  }
  if (rawText.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(
      `ข้อความต้องยาวไม่เกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร`,
      400,
      'MESSAGE_TOO_LONG'
    );
  }

  const masking = maskSensitiveData(rawText);
  const senderRole = order.buyerId === userId ? 'BUYER' : 'SELLER';
  const kind = input.kind === 'SCHEDULE_CARD' ? 'SCHEDULE_CARD' : 'TEXT';

  const created = await prismaClient.orderMessage.create({
    data: {
      orderId,
      senderId: userId,
      senderRole,
      kind,
      text: masking.maskedText,
      isMasked: masking.hasMaskedData,
    },
    include: {
      sender: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
  });

  if (prismaClient?.notification?.create) {
    try {
      let shouldNotify = true;
      if (typeof prismaClient.orderMessage?.findFirst === 'function') {
        const recentFromSameSender = await prismaClient.orderMessage.findFirst({
          where: {
            orderId,
            senderId: userId,
            id: { not: created.id },
            createdAt: {
              gte: new Date(Date.now() - CHAT_NOTIFY_COOLDOWN_MS),
            },
          },
          select: { id: true },
        });
        if (recentFromSameSender) {
          shouldNotify = false;
        }
      }

      if (shouldNotify) {
        const recipientUserId = senderRole === 'BUYER' ? order.sellerId : order.buyerId;
        const recipientRole = senderRole === 'BUYER' ? 'SELLER' : 'BUYER';
        const senderLabel =
          created.sender?.nickname ||
          (senderRole === 'BUYER' ? 'ผู้ซื้อ' : 'ผู้ขาย');
        const preview =
          masking.maskedText.length > 90
            ? `${masking.maskedText.slice(0, 90)}…`
            : masking.maskedText;

        await notifyOrderEvent(
          {
            recipientUserId,
            role: recipientRole,
            orderId,
            title: `ข้อความใหม่จาก${senderLabel}`,
            message: preview,
            badgeText: 'NEW CHAT MESSAGE',
            linkPath: `/orders/${orderId}`,
            pushLine: false,
          },
          prismaClient
        );
      }
    } catch (err) {
      console.warn('[messageService] Failed to send chat notification:', err);
    }
  }

  return formatOrderMessage(created);
}

/**
 * บันทึกข้อความระบบ (System Card / Notification) ลงในห้องแชทของคำสั่งซื้อ
 */
export async function createSystemOrderMessage(
  orderId: string,
  text: string,
  kind: 'SYSTEM' | 'SCHEDULE_CARD' = 'SYSTEM',
  prismaClient: any = prisma
): Promise<void> {
  if (!prismaClient?.orderMessage?.create) {
    return;
  }

  await prismaClient.orderMessage.create({
    data: {
      orderId,
      senderId: null,
      senderRole: 'SYSTEM',
      kind,
      text,
      isMasked: false,
    },
  });
}
