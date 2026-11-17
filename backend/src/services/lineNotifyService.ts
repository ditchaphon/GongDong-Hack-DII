import { messagingApi, webhook } from '@line/bot-sdk';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { createNotification, NotificationRole } from './notificationService';

export const LIFF_ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export interface LineOrderNotificationParams {
  recipientUserId: string;
  recipientLineUserId?: string | null;
  role: NotificationRole;
  orderId: string;
  title: string;
  message: string;
  badgeText?: string;
  linkPath?: string;
  /** Set false for in-app-only events (e.g. order chat, reviews, completion/expiry). */
  pushLine?: boolean;
  /** Force LINE Push even when the recipient was active in LIFF within the last 2 minutes. */
  forcePushLine?: boolean;
}

function getLineMessagingClient(): messagingApi.MessagingApiClient | null {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    return null;
  }
  return new messagingApi.MessagingApiClient({
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
  });
}

interface OrderFlexTheme {
  headerBg: string;
  softBg: string;
  accentColor: string;
  buttonBg: string;
  statusLabel: string;
  ctaLabel: string;
}

function resolveOrderFlexTheme(badgeText?: string): OrderFlexTheme {
  const normalized = (badgeText || '').toUpperCase();

  if (normalized.includes('NEW ORDER')) {
    return {
      headerBg: '#8B5E3C',
      softBg: '#FDF8F3',
      accentColor: '#6B4628',
      buttonBg: '#8B5E3C',
      statusLabel: '📚 คำขอสั่งซื้อใหม่',
      ctaLabel: 'ดูคำขอและตอบรับ',
    };
  }

  if (normalized.includes('SHIPPED')) {
    return {
      headerBg: '#0369A1',
      softBg: '#F0F9FF',
      accentColor: '#0369A1',
      buttonBg: '#0284C7',
      statusLabel: '📦 จัดส่งพัสดุแล้ว',
      ctaLabel: 'ดูเลขพัสดุและติดตาม',
    };
  }

  if (normalized.includes('MEETUP COMPLETED')) {
    return {
      headerBg: '#15803D',
      softBg: '#F0FDF4',
      accentColor: '#15803D',
      buttonBg: '#16A34A',
      statusLabel: '⭐ นัดรับสำเร็จ · อย่าลืมรีวิว',
      ctaLabel: 'ให้คะแนนและรีวิวร้าน',
    };
  }

  if (
    normalized.includes('DISPUTE RESOLVED') ||
    normalized.includes('COMPLETED')
  ) {
    return {
      headerBg: '#15803D',
      softBg: '#F0FDF4',
      accentColor: '#15803D',
      buttonBg: '#16A34A',
      statusLabel: '✅ ดำเนินการเรียบร้อย',
      ctaLabel: 'ดูรายละเอียดคำสั่งซื้อ',
    };
  }

  if (
    normalized.includes('DISPUTE') ||
    normalized.includes('MISSED')
  ) {
    return {
      headerBg: '#B91C1C',
      softBg: '#FEF2F2',
      accentColor: '#B91C1C',
      buttonBg: '#DC2626',
      statusLabel: '⚠️ แจ้งเตือนข้อพิพาท / นัดหมาย',
      ctaLabel: 'ตรวจสอบรายละเอียด',
    };
  }

  if (
    normalized.includes('REJECTED') ||
    normalized.includes('CANCELLED') ||
    normalized.includes('EXPIRED')
  ) {
    return {
      headerBg: '#475569',
      softBg: '#F8FAFC',
      accentColor: '#475569',
      buttonBg: '#334155',
      statusLabel: 'ℹ️ อัปเดตสถานะคำสั่งซื้อ',
      ctaLabel: 'ดูรายละเอียดคำสั่งซื้อ',
    };
  }

  return {
    headerBg: '#0F766E',
    softBg: '#F0FDFA',
    accentColor: '#0F766E',
    buttonBg: '#0D9488',
    statusLabel: '🤝 ผู้ขายรับออเดอร์แล้ว',
    ctaLabel: 'เปิดแชทและดูออเดอร์',
  };
}

/**
 * สร้าง LINE Flex Message Card สำหรับแจ้งเตือนสถานะคำสั่งซื้อ
 */
export function buildOrderFlexMessage(params: {
  title: string;
  message: string;
  orderId: string;
  badgeText?: string;
  role?: NotificationRole;
  linkUrl: string;
}): messagingApi.FlexMessage {
  const theme = resolveOrderFlexTheme(params.badgeText);
  const roleLabel =
    params.role === 'SELLER'
      ? 'สำหรับผู้ขาย'
      : params.role === 'BUYER'
      ? 'สำหรับผู้ซื้อ'
      : null;

  const headerTopContents: messagingApi.FlexComponent[] = [
    {
      type: 'text',
      text: 'GONGDONG · กองดอง',
      size: 'xs',
      weight: 'bold',
      color: '#FFFFFFE6',
      flex: 1,
    },
  ];

  if (roleLabel) {
    headerTopContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#FFFFFF29',
      cornerRadius: '99px',
      paddingStart: '10px',
      paddingEnd: '10px',
      paddingTop: '3px',
      paddingBottom: '3px',
      flex: 0,
      contents: [
        {
          type: 'text',
          text: roleLabel,
          size: 'xxs',
          weight: 'bold',
          color: '#FFFFFF',
        },
      ],
    });
  }

  return {
    type: 'flex',
    altText: `${params.title}: ${params.message}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: theme.headerBg,
        paddingAll: '16px',
        spacing: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: headerTopContents,
          },
          {
            type: 'text',
            text: theme.statusLabel,
            size: 'sm',
            weight: 'bold',
            color: '#FFFFFF',
            margin: 'xs',
            wrap: true,
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#FFFFFF',
        paddingAll: '18px',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: params.title,
            weight: 'bold',
            size: 'lg',
            color: '#0F172A',
            wrap: true,
          },
          {
            type: 'text',
            text: params.message,
            size: 'sm',
            color: '#475569',
            wrap: true,
          },
          {
            type: 'separator',
            color: '#E2E8F0',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: theme.softBg,
            cornerRadius: '10px',
            paddingAll: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            contents: [
              {
                type: 'text',
                text: 'หมายเลขคำสั่งซื้อ',
                size: 'xs',
                color: '#64748B',
                flex: 0,
              },
              {
                type: 'text',
                text: `#${params.orderId.slice(0, 8).toUpperCase()}`,
                size: 'xs',
                weight: 'bold',
                color: theme.accentColor,
                align: 'end',
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#FFFFFF',
        paddingAll: '16px',
        paddingTop: '4px',
        spacing: 'xs',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: theme.buttonBg,
            action: {
              type: 'uri',
              label: theme.ctaLabel,
              uri: params.linkUrl,
            },
          },
          {
            type: 'text',
            text: 'แตะเพื่อเปิดจัดการต่อในแอป GongDong',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
            margin: 'sm',
          },
        ],
      },
    },
  };
}

/**
 * ส่งข้อความ LINE Push Message อย่างปลอดภัย (ไม่โยน Error หากยังไม่ได้ตั้งค่า Token หรือเป็น Mock User)
 */
export async function pushLineMessage(
  lineUserId: string | null | undefined,
  messages: messagingApi.Message[],
  clientOverride?: Pick<messagingApi.MessagingApiClient, 'pushMessage'> | null
): Promise<{ sent: boolean; reason?: string }> {
  if (
    !lineUserId ||
    lineUserId.startsWith('mock_') ||
    lineUserId.startsWith('line_')
  ) {
    return { sent: false, reason: 'MOCK_OR_MISSING_LINE_ID' };
  }

  const client =
    clientOverride !== undefined ? clientOverride : getLineMessagingClient();

  if (!client) {
    return { sent: false, reason: 'MISSING_CHANNEL_ACCESS_TOKEN' };
  }

  try {
    await client.pushMessage({
      to: lineUserId,
      messages,
    });
    return { sent: true };
  } catch (error) {
    console.warn('[lineNotifyService] Failed to push LINE message:', error);
    return { sent: false, reason: 'PUSH_FAILED' };
  }
}

/**
 * Link opened from a LINE card button. With LINE_LIFF_ID set it becomes
 * https://liff.line.me/{liffId}/orders/123, which opens the page inside the
 * LIFF webview already logged in. Without it, fall back to FRONTEND_URL.
 */
export function buildAppLink(linkPath: string): string {
  const path = linkPath.startsWith('/') ? linkPath : `/${linkPath}`;
  const liffId = env.LINE_LIFF_ID?.trim();
  if (liffId) return `https://liff.line.me/${liffId}${path}`;
  const primaryFrontendUrl =
    env.FRONTEND_URL.split(',')[0]?.trim().replace(/\/+$/, '') || 'http://localhost:3000';
  return `${primaryFrontendUrl}${path}`;
}

/**
 * ดึง lineUserId และ lastActiveAt ของผู้รับจากฐานข้อมูลเพื่อตรวจสิทธิ์การส่ง LINE Push
 */
async function resolveRecipientPushTarget(
  recipientUserId: string,
  providedLineUserId: string | null | undefined,
  prismaClient: any
): Promise<{ lineUserId: string | null | undefined; isRecentlyActiveInLiff: boolean }> {
  if (!recipientUserId || typeof prismaClient?.user?.findUnique !== 'function') {
    return { lineUserId: providedLineUserId, isRecentlyActiveInLiff: false };
  }
  try {
    const user = await prismaClient.user.findUnique({
      where: { id: recipientUserId },
      select: { lineUserId: true, lastActiveAt: true },
    });
    const lastActiveMs = user?.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
    const isRecentlyActiveInLiff =
      Number.isFinite(lastActiveMs) &&
      lastActiveMs > 0 &&
      Date.now() - lastActiveMs <= LIFF_ACTIVE_WINDOW_MS;
    return {
      lineUserId: providedLineUserId !== undefined ? providedLineUserId : (user?.lineUserId ?? null),
      isRecentlyActiveInLiff,
    };
  } catch (err) {
    console.warn('[lineNotifyService] Failed to resolve recipient lineUserId:', err);
    return { lineUserId: providedLineUserId, isRecentlyActiveInLiff: false };
  }
}

/**
 * ส่งทั้ง In-App Notification และ LINE Push Notification สำหรับเหตุการณ์คำสั่งซื้อ
 * - ข้าม LINE Push เมื่อ pushLine === false หรือผู้รับกำลังเปิดใช้งาน LIFF อยู่ภายใน 2 นาทีล่าสุด
 */
export async function notifyOrderEvent(
  params: LineOrderNotificationParams,
  prismaClient: any = prisma,
  clientOverride?: Pick<messagingApi.MessagingApiClient, 'pushMessage'> | null
): Promise<{ pushed: boolean; reason?: string }> {
  const linkPath = params.linkPath || `/orders/${params.orderId}`;
  const fullUrl = buildAppLink(linkPath);

  try {
    await createNotification(
      {
        userId: params.recipientUserId,
        role: params.role,
        type: 'ORDER',
        title: params.title,
        message: params.message,
        linkUrl: linkPath,
      },
      prismaClient
    );
  } catch (err) {
    console.warn('[lineNotifyService] Failed to persist in-app notification:', err);
  }

  if (params.pushLine === false) {
    return { pushed: false, reason: 'LINE_PUSH_DISABLED' };
  }

  const { lineUserId: recipientLineUserId, isRecentlyActiveInLiff } =
    await resolveRecipientPushTarget(
      params.recipientUserId,
      params.recipientLineUserId,
      prismaClient
    );

  if (isRecentlyActiveInLiff && !params.forcePushLine) {
    return { pushed: false, reason: 'USER_ACTIVE_IN_LIFF' };
  }

  const flex = buildOrderFlexMessage({
    title: params.title,
    message: params.message,
    orderId: params.orderId,
    badgeText: params.badgeText,
    role: params.role,
    linkUrl: fullUrl,
  });

  const pushResult = await pushLineMessage(recipientLineUserId, [flex], clientOverride);
  return { pushed: pushResult.sent, reason: pushResult.reason };
}

const WEBHOOK_DEDUP_TTL_MS = 10 * 60 * 1000;
const processedWebhookEvents = new Map<string, number>();

function isDuplicateWebhookEvent(webhookEventId?: string): boolean {
  if (!webhookEventId) return false;
  const now = Date.now();
  const expiresAt = processedWebhookEvents.get(webhookEventId);
  if (expiresAt && expiresAt > now) {
    return true;
  }
  if (processedWebhookEvents.size > 2000) {
    for (const [id, exp] of processedWebhookEvents.entries()) {
      if (exp <= now) processedWebhookEvents.delete(id);
    }
  }
  processedWebhookEvents.set(webhookEventId, now + WEBHOOK_DEDUP_TTL_MS);
  return false;
}

/**
 * ประมวลผล Webhook Events จาก LINE Official Account (เช่น follow, message)
 */
export async function handleLineWebhookEvents(
  events: webhook.Event[],
  prismaClient: any = prisma,
  clientOverride?: Pick<messagingApi.MessagingApiClient, 'replyMessage'> | null
): Promise<{ processed: number; skippedDuplicates?: number }> {
  const client =
    clientOverride !== undefined ? clientOverride : getLineMessagingClient();

  let processed = 0;
  let skippedDuplicates = 0;

  for (const event of events) {
    const eventId = (event as { webhookEventId?: string }).webhookEventId;
    if (isDuplicateWebhookEvent(eventId)) {
      skippedDuplicates++;
      continue;
    }

    try {
      if (event.type === 'follow') {
        const lineUserId = event.source?.userId;
        if (lineUserId && prismaClient?.user?.findUnique) {
          const user = await prismaClient.user.findUnique({
            where: { lineUserId },
            select: { id: true },
          });
          if (user) {
            await createNotification(
              {
                userId: user.id,
                role: 'BUYER',
                type: 'SYSTEM',
                title: 'เชื่อมต่อ LINE OA สำเร็จ',
                message: 'คุณจะได้รับการแจ้งเตือนสถานะคำสั่งซื้อผ่าน LINE Official Account แล้ว',
              },
              prismaClient
            );
          }
        }

        if (client && event.replyToken) {
          try {
            await client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: 'text',
                  text: 'ยินดีต้อนรับสู่ GongDong! คุณจะได้รับการแจ้งเตือนคำสั่งซื้อและนัดรับหนังสือผ่านทาง LINE นี้ครับ 📚',
                },
              ],
            });
          } catch (err) {
            console.warn('[lineNotifyService] Failed to reply follow event:', err);
          }
        }
        processed++;
      }
    } catch (err) {
      console.warn('[lineNotifyService] Error handling webhook event:', err);
    }
  }

  return skippedDuplicates > 0 ? { processed, skippedDuplicates } : { processed };
}
