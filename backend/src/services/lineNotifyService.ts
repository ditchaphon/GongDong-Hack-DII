import { messagingApi, webhook } from '@line/bot-sdk';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { createNotification, NotificationRole } from './notificationService';

export interface LineOrderNotificationParams {
  recipientUserId: string;
  recipientLineUserId?: string | null;
  role: NotificationRole;
  orderId: string;
  title: string;
  message: string;
  badgeText?: string;
  linkPath?: string;
}

function getLineMessagingClient(): messagingApi.MessagingApiClient | null {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    return null;
  }
  return new messagingApi.MessagingApiClient({
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
  });
}

/**
 * สร้าง LINE Flex Message Card สำหรับแจ้งเตือนสถานะคำสั่งซื้อ
 */
export function buildOrderFlexMessage(params: {
  title: string;
  message: string;
  orderId: string;
  badgeText?: string;
  linkUrl: string;
}): messagingApi.FlexMessage {
  return {
    type: 'flex',
    altText: `${params.title}: ${params.message}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: params.badgeText || 'GONGDONG ORDER',
            weight: 'bold',
            color: '#16A34A',
            size: 'xs',
          },
          {
            type: 'text',
            text: params.title,
            weight: 'bold',
            size: 'md',
            wrap: true,
          },
          {
            type: 'text',
            text: params.message,
            size: 'sm',
            color: '#4B5563',
            wrap: true,
          },
          {
            type: 'text',
            text: `Order #${params.orderId.slice(0, 8)}`,
            size: 'xs',
            color: '#9CA3AF',
            margin: 'md',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#111827',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียดคำสั่งซื้อ',
              uri: params.linkUrl,
            },
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
  if (!lineUserId || lineUserId.startsWith('mock_')) {
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
 * ส่งทั้ง In-App Notification และ LINE Push Notification สำหรับเหตุการณ์คำสั่งซื้อ
 */
export async function notifyOrderEvent(
  params: LineOrderNotificationParams,
  prismaClient: any = prisma
): Promise<void> {
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

  const flex = buildOrderFlexMessage({
    title: params.title,
    message: params.message,
    orderId: params.orderId,
    badgeText: params.badgeText,
    linkUrl: fullUrl,
  });

  await pushLineMessage(params.recipientLineUserId, [flex]);
}

/**
 * ประมวลผล Webhook Events จาก LINE Official Account (เช่น follow, message)
 */
export async function handleLineWebhookEvents(
  events: webhook.Event[],
  prismaClient: any = prisma,
  clientOverride?: Pick<messagingApi.MessagingApiClient, 'replyMessage'> | null
): Promise<{ processed: number }> {
  const client =
    clientOverride !== undefined ? clientOverride : getLineMessagingClient();

  let processed = 0;

  for (const event of events) {
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
  }

  return { processed };
}
