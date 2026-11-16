/**
 * LINE assets for Phase 6.
 *
 * Spec-only: no real LINE API call is made anywhere here. `sendFlex` is a stub
 * that logs the intended payload so the UI can be wired up truthfully later.
 */

export const LIFF_ID_PLACEHOLDER = '{LIFF_ID}';

export function deepLink(path: string): string {
  return `https://liff.line.me/${LIFF_ID_PLACEHOLDER}${path}`;
}

export interface RichMenuItem {
  label: string;
  path: string;
  icon: string;
  description: string;
}

export const RICH_MENU_ITEMS: RichMenuItem[] = [
  { label: 'หาหนังสือ', path: '/', icon: '🔍', description: 'เปิดฟีดหนังสือและค้นหา' },
  { label: 'ขายหนังสือ', path: '/seller/list', icon: '📚', description: 'เริ่มลงขาย / ต่อเนื่อง wizard' },
  { label: 'ออเดอร์', path: '/orders', icon: '📦', description: 'ออเดอร์ที่ซื้อ / ที่ขาย' },
  { label: 'ช่วยเหลือ', path: '/help', icon: '❓', description: 'คำถามที่พบบ่อยและช่วยเหลือ' },
];

export interface FlexTemplate {
  id: string;
  event: string;
  title: string;
  body: string;
  trigger: string;
  ctaLabel: string;
  deepLinkPath: string;
  altText: string;
  flex: {
    type: 'flex';
    altText: string;
    contents: Record<string, unknown>;
  };
}

function bubble(title: string, body: string, ctaLabel: string, uri: string): FlexTemplate['flex']['contents'] {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: title, weight: 'bold', size: 'md', color: '#1e293b', wrap: true },
        { type: 'text', text: body, size: 'sm', color: '#475569', wrap: true },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          action: { type: 'uri', label: ctaLabel, uri },
        },
      ],
    },
  };
}

const T = (id: string, event: string, title: string, body: string, trigger: string, ctaLabel: string, path: string): FlexTemplate => ({
  id,
  event,
  title,
  body,
  trigger,
  ctaLabel,
  deepLinkPath: path,
  altText: title,
  flex: { type: 'flex', altText: title, contents: bubble(title, body, ctaLabel, deepLink(path)) },
});

export const FLEX_TEMPLATES: FlexTemplate[] = [
  T('new-request', 'คำขอซื้อใหม่', 'มีคนขอซื้อหนังสือของคุณ', 'ผู้ซื้อขอซื้อ “ดาบพิฆาตอสูร” ฿1,850 · นัดรับ/ส่งพัสดุ', 'ผู้ซื้อกด “ขอซื้อ” ในตะกร้า', 'ดูออเดอร์', '/orders'),
  T('accepted', 'ผู้ขายรับแล้ว', 'ผู้ขายรับออเดอร์แล้ว', 'เปิดแชทในออเดอร์แล้ว · นัดเวลาและจุดรับ หรือชำระเงิน', 'ผู้ขายกด “รับออเดอร์” (ใช้ 1 เครดิต)', 'เปิดแชท', '/orders'),
  T('rejected', 'ปฏิเสธ / หมดเวลา', 'ออเดอร์ถูกปฏิเสธหรือหมดเวลา', 'คำขอซื้อนี้ไม่ได้รับการตอบรับภายใน 24 ชม.', 'ผู้ขายปฏิเสธ หรือครบ 24 ชม.', 'ดูรายละเอียด', '/orders'),
  T('meetup-proposed', 'นัดเวลาแล้ว', 'ผู้ขายเสนอเวลานัดรับ', 'นัดรับ: 13 พ.ย. 15:30 · หน้าหอสมุดกลาง มช.', 'ผู้ขายกด “เสนอเวลา” ในแชท', 'ยืนยันเวลา', '/orders'),
  T('meetup-confirmed', 'ยืนยันเวลานัดแล้ว', 'เวลานัดรับยืนยันแล้ว', 'พบกันตามเวลาที่นัด · อย่าลืมรหัสรับของ 6 หลัก', 'ผู้ซื้อกด “ยืนยัน”', 'ดูรหัสรับของ', '/orders'),
  T('reminder-1h', 'แจ้งเตือน 1 ชม. ก่อนนัด', 'อีก 1 ชั่วโมงจะถึงเวลานัดรับ', 'เตรียมหนังสือและรหัสรับของให้พร้อม', 'ระบบส่งก่อนเวลานัด 1 ชม.', 'เปิดออเดอร์', '/orders'),
  T('slip-passed', 'สลิปผ่าน', 'ตรวจสอบสลิปผ่านแล้ว', 'ออเดอร์พร้อมจัดส่ง · ผู้ขายต้องส่งภายใน 48 ชม.', 'ระบบตรวจสลิปผ่าน', 'ดูที่อยู่ผู้รับ', '/orders'),
  T('slip-failed', 'สลิปไม่ผ่าน', 'ตรวจสอบสลิปไม่ผ่าน', 'กรุณาอัปโหลดสลิปใหม่ หรือรอแอดมินตรวจสอบ', 'ระบบตรวจสลิปไม่ผ่าน / quota หมด', 'อัปโหลดใหม่', '/orders'),
  T('paid-seller', 'ชำระเงินแล้ว (ผู้ขาย)', 'ผู้ซื้อชำระเงินแล้ว', 'กรุณาจัดส่งภายใน 48 ชม. และกรอกเลขพัสดุ', 'สถานะเปลี่ยนเป็น PAID', 'กรอกเลขพัสดุ', '/orders'),
  T('shipped-buyer', 'จัดส่งแล้ว (ผู้ซื้อ)', 'พัสดุถูกจัดส่งแล้ว', 'เลขพัสดุ: TH123456789 · ติดตามได้ที่ลิงก์', 'ผู้ขายกรอกเลขพัสดุ', 'ติดตามพัสดุ', '/orders'),
  T('completed-review', 'สำเร็จ — ขอรีวิว', 'ออเดอร์สำเร็จแล้ว', 'ช่วยให้คะแนนร้านและคุณภาพหนังสือได้ไหม', 'รหัสรับของถูกต้อง / ซื้อยืนยันรับของ', 'ให้คะแนน', '/orders'),
  T('dispute-opened', 'แจ้งปัญหา', 'มีการแจ้งปัญหาในออเดอร์', 'ทีมงานกำลังตรวจสอบ · ติดต่อผ่านแชทในออเดอร์', 'ผู้ซื้อ/ผู้ขายกด “แจ้งปัญหา”', 'เปิดแชท', '/orders'),
  T('chat-message', 'ข้อความใหม่ในแชท', 'มีข้อความใหม่ในออเดอร์', 'ผู้ขาย: นัดรับที่หอสมุดได้ไหม', 'ข้อความใหม่ (ส่งไม่เกิน 1 ครั้ง/30 นาที/ออเดอร์)', 'เปิดแชท', '/orders'),
  T('credit-topup', 'เติมเครดิตสำเร็จ', 'เติมเครดิตสำเร็จแล้ว', 'ยอดใหม่ 5 เครดิต · ใช้รับออเดอร์ได้แล้ว', 'แอดมินอนุมัติสลิปเติมเครดิต', 'ดูเครดิต', '/seller/credits'),
];

export interface SendFlexResult {
  ok: boolean;
  mocked: true;
  userId: string;
  templateId: string;
  payload: FlexTemplate['flex'];
}

/**
 * Stub only — no network call. Replace with the real Messaging API later.
 */
export async function sendFlex(userId: string, templateId: string): Promise<SendFlexResult> {
  const template = FLEX_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown flex template: ${templateId}`);
  // eslint-disable-next-line no-console
  console.log('[sendFlex stub]', { userId, templateId, altText: template.altText });
  return { ok: true, mocked: true, userId, templateId, payload: template.flex };
}
