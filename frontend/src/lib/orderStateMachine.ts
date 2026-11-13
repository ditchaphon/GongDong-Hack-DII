import { V4Delivery, V4Order, V4OrderStatus, ViewRole } from '@/types/v4';

/**
 * GongDong v4 order state machine, timers and "who must act" logic.
 * Pure functions only — no React, no mock data.
 */

export type StatusTone =
  | 'amber'
  | 'blue'
  | 'teal'
  | 'emerald'
  | 'rose'
  | 'slate'
  | 'violet';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  explanation: string;
  whoActs: ViewRole | 'BOTH' | 'ADMIN' | 'NONE';
  /** Hours allowed in this state, counted from updatedAtISO. */
  timerHours?: number;
}

export const STATUS_META: Record<V4OrderStatus, StatusMeta> = {
  REQUESTED: {
    label: 'รอผู้ขายตอบรับ',
    tone: 'amber',
    explanation: 'ส่งคำขอแล้ว · หนังสือยังไม่ถูกล็อก ผู้ซื้อคนอื่นขอได้',
    whoActs: 'SELLER',
    timerHours: 24,
  },
  ACCEPTED: {
    label: 'รอชำระเงิน',
    tone: 'blue',
    explanation: 'ผู้ขายรับคำขอแล้ว · ชำระเงินเพื่อให้ผู้ขายเริ่มจัดส่ง',
    whoActs: 'BOTH',
    timerHours: 24,
  },
  SCHEDULED: {
    label: 'นัดรับแล้ว',
    tone: 'teal',
    explanation: 'ผู้ขายรับคำขอแล้ว · เจอกันตามนัด ตรวจหนังสือ จ่ายเงิน แล้วให้ผู้ขายสแกน QR',
    whoActs: 'BOTH',
  },
  PAID: {
    label: 'รอผู้ขายจัดส่ง',
    tone: 'blue',
    explanation: 'ชำระเงินแล้ว (ระบบพักเงินไว้) · ผู้ขายกำลังเตรียมจัดส่ง',
    whoActs: 'SELLER',
    timerHours: 48,
  },
  SHIPPED: {
    label: 'กำลังจัดส่ง',
    tone: 'violet',
    explanation: 'ผู้ขายส่งของแล้ว · ติดตามด้วยเลขพัสดุ',
    whoActs: 'BUYER',
    timerHours: 7 * 24,
  },
  COMPLETED: {
    label: 'สำเร็จ',
    tone: 'emerald',
    explanation: 'ปิดออเดอร์แล้ว · แชทอ่านได้อย่างเดียว',
    whoActs: 'NONE',
  },
  REJECTED: {
    label: 'ถูกปฏิเสธ',
    tone: 'slate',
    explanation: 'ผู้ขายปฏิเสธคำขอ · ไม่เสียเครดิต',
    whoActs: 'NONE',
  },
  EXPIRED: {
    label: 'หมดเวลา',
    tone: 'slate',
    explanation: 'ไม่มีการตอบรับภายในเวลาที่กำหนด',
    whoActs: 'NONE',
  },
  CANCELLED: {
    label: 'ยกเลิกแล้ว',
    tone: 'slate',
    explanation: 'คำขอหรือออเดอร์นี้ถูกยกเลิก',
    whoActs: 'NONE',
  },
  DISPUTED: {
    label: 'อยู่ระหว่างตรวจสอบ',
    tone: 'rose',
    explanation: 'แอดมินกำลังตรวจสอบ · เวลาทั้งหมดหยุดชั่วคราว',
    whoActs: 'ADMIN',
  },
};

export const TIMER_HOURS = {
  acceptRequest: 24,
  payParcel: 24,
  shipParcel: 48,
  autoComplete: 7 * 24,
  meetupGrace: 48,
  noShowEligibleAfterMinutes: 15,
  noShowDisputeWindowHours: 24,
  handoverCodeWindowHours: 48,
} as const;

export const MAIN_PATH: Record<V4Delivery, V4OrderStatus[]> = {
  MEETUP: ['REQUESTED', 'SCHEDULED', 'COMPLETED'],
  PARCEL: ['REQUESTED', 'ACCEPTED', 'PAID', 'SHIPPED', 'COMPLETED'],
};

const TRANSITIONS: Record<V4OrderStatus, V4OrderStatus[]> = {
  REQUESTED: ['ACCEPTED', 'SCHEDULED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  ACCEPTED: ['SCHEDULED', 'PAID', 'CANCELLED', 'DISPUTED'],
  SCHEDULED: ['COMPLETED', 'DISPUTED'],
  PAID: ['SHIPPED', 'DISPUTED'],
  SHIPPED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
};

export function nextStatuses(from: V4OrderStatus): V4OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Can this order move to `to`?
 * SCHEDULED only exists for meetup, PAID/SHIPPED only for parcel.
 */
export function canTransition(
  order: Pick<V4Order, 'status' | 'delivery'>,
  to: V4OrderStatus
): boolean {
  if (!nextStatuses(order.status).includes(to)) return false;
  if (order.delivery === 'MEETUP' && (to === 'PAID' || to === 'SHIPPED')) return false;
  if (order.delivery === 'PARCEL' && to === 'SCHEDULED') return false;
  return true;
}

export function isTerminal(status: V4OrderStatus): boolean {
  return ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(status);
}

export function isOpen(status: V4OrderStatus): boolean {
  return !isTerminal(status) && status !== 'DISPUTED';
}

/** Main-path step index; terminal exits return -1. */
export function timelineIndex(
  delivery: V4Delivery,
  status: V4OrderStatus
): number {
  return MAIN_PATH[delivery].indexOf(status);
}

export interface TimerInfo {
  deadline: Date;
  msLeft: number;
  hoursLeft: number;
  expired: boolean;
  label: string;
}

/** Timer for the current state, counted from the last status change. */
export function getTimerInfo(
  order: Pick<V4Order, 'status' | 'delivery' | 'updatedAtISO'>,
  now: Date = new Date()
): TimerInfo | null {
  const meta = STATUS_META[order.status];
  if (!meta.timerHours) return null;
  const deadline = new Date(
    new Date(order.updatedAtISO).getTime() + meta.timerHours * 3600 * 1000
  );
  const msLeft = deadline.getTime() - now.getTime();
  return {
    deadline,
    msLeft: Math.max(0, msLeft),
    hoursLeft: Math.max(0, Math.ceil(msLeft / 3600000)),
    expired: msLeft <= 0,
    label:
      order.status === 'REQUESTED'
        ? 'ผู้ขายต้องตอบรับภายใน'
        : order.status === 'ACCEPTED'
        ? 'ผู้ซื้อต้องชำระเงินภายใน'
        : order.status === 'PAID'
        ? 'ผู้ขายต้องจัดส่งภายใน'
        : 'รอผู้ซื้อกดรับของ',
  };
}

export type ActionKey =
  | 'WAIT'
  | 'RESPOND_REQUEST'
  | 'CANCEL_REQUEST'
  | 'PROPOSE_MEETUP'
  | 'CONFIRM_MEETUP'
  | 'PAY_ORDER'
  | 'WAIT_PAYMENT'
  | 'SHIP_PARCEL'
  | 'WAIT_SHIPMENT'
  | 'SHOW_HANDOVER_CODE'
  | 'ENTER_HANDOVER_CODE'
  | 'CONFIRM_RECEIVED'
  | 'VIEW_TRACKING'
  | 'REVIEW'
  | 'VIEW_DISPUTE'
  | 'NONE';

export interface OrderAction {
  key: ActionKey;
  title: string;
  description: string;
  whoActs: ViewRole | 'BOTH' | 'ADMIN' | 'NONE';
  primaryLabel?: string;
}

const sellerActions: Partial<Record<V4OrderStatus, OrderAction>> = {
  REQUESTED: {
    key: 'RESPOND_REQUEST',
    title: 'มีคำขอซื้อรอคุณตอบรับ',
    description: 'รับออเดอร์ใช้ 1 เครดิต · ปฏิเสธไม่เสียเครดิต',
    whoActs: 'SELLER',
    primaryLabel: 'ดูคำขอ',
  },
  ACCEPTED: {
    key: 'PROPOSE_MEETUP',
    title: 'นัดรับกับผู้ซื้อ',
    description: 'เสนอวันเวลาและจุดนัดในแชทออเดอร์',
    whoActs: 'SELLER',
    primaryLabel: 'นัดรับ',
  },
  PAID: {
    key: 'SHIP_PARCEL',
    title: 'จัดส่งตามเวลาที่ตั้งไว้',
    description: 'ส่งแล้วใส่เลขพัสดุให้ผู้ซื้อติดตาม',
    whoActs: 'SELLER',
    primaryLabel: 'ใส่เลขพัสดุ',
  },
  SHIPPED: {
    key: 'WAIT_SHIPMENT',
    title: 'รอผู้ซื้อถ่ายรูปยืนยันรับของ',
    description: 'ได้รับเงินเมื่อผู้ซื้อยืนยัน · ครบ 7 วันระบบปิดให้อัตโนมัติ',
    whoActs: 'BUYER',
  },
  SCHEDULED: {
    key: 'ENTER_HANDOVER_CODE',
    title: 'ไปตามนัด แล้วสแกน QR ของผู้ซื้อ',
    description: 'สแกนหลังผู้ซื้อตรวจหนังสือและจ่ายเงินแล้ว เพื่อปิดการขาย',
    whoActs: 'SELLER',
    primaryLabel: 'สแกน QR ผู้ซื้อ',
  },
  COMPLETED: {
    key: 'NONE',
    title: 'ปิดการขายแล้ว',
    description: 'ดูรีวิวจากผู้ซื้อได้ในออเดอร์',
    whoActs: 'NONE',
  },
  DISPUTED: {
    key: 'VIEW_DISPUTE',
    title: 'แอดมินกำลังตรวจสอบ',
    description: 'คุณส่งข้อมูลเพิ่มได้ในแชทออเดอร์',
    whoActs: 'ADMIN',
  },
};

const buyerActions: Partial<Record<V4OrderStatus, OrderAction>> = {
  REQUESTED: {
    key: 'WAIT',
    title: 'รอผู้ขายตอบรับ',
    description: 'หนังสือยังไม่ถูกล็อก · ขอซื้อเล่มอื่นได้อีก 2 รายการ',
    whoActs: 'SELLER',
  },
  ACCEPTED: {
    key: 'PAY_ORDER',
    title: 'ผู้ขายรับแล้ว · ชำระเงิน',
    description: 'สแกน QR แล้วแนบสลิป · ระบบพักเงินไว้จนคุณได้รับของ',
    whoActs: 'BUYER',
    primaryLabel: 'ไปหน้าชำระเงิน',
  },
  SCHEDULED: {
    key: 'SHOW_HANDOVER_CODE',
    title: 'นัดรับแล้ว · เปิด QR ตอนรับของ',
    description: 'ตรวจหนังสือและจ่ายเงินก่อน แล้วให้ผู้ขายสแกน QR',
    whoActs: 'BUYER',
    primaryLabel: 'แสดง QR รับของ',
  },
  PAID: {
    key: 'WAIT_SHIPMENT',
    title: 'รอผู้ขายจัดส่ง',
    description: 'ผู้ขายกำลังเตรียมส่งตามเวลาที่ร้านตั้งไว้',
    whoActs: 'SELLER',
  },
  SHIPPED: {
    key: 'CONFIRM_RECEIVED',
    title: 'กำลังจัดส่ง · ได้รับแล้วถ่ายรูปยืนยัน',
    description: 'ติดตามด้วยเลขพัสดุ · ได้รับแล้วถ่ายรูปและรีวิว',
    whoActs: 'BUYER',
    primaryLabel: 'ได้รับของแล้ว',
  },
  COMPLETED: {
    key: 'REVIEW',
    title: 'ให้คะแนนร้าน',
    description: 'สภาพหนังสือตรงเกรดไหม · แพ็กดีไหม',
    whoActs: 'BOTH',
    primaryLabel: 'ให้คะแนน',
  },
  DISPUTED: {
    key: 'VIEW_DISPUTE',
    title: 'อยู่ระหว่างตรวจสอบ',
    description: 'แนบหลักฐานเพิ่มได้ในแชทออเดอร์',
    whoActs: 'ADMIN',
  },
};

export function getNextAction(order: V4Order, role: ViewRole): OrderAction {
  const map = role === 'SELLER' ? sellerActions : buyerActions;
  const action = map[order.status];

  if (order.status === 'ACCEPTED') {
    if (role === 'SELLER' && order.delivery === 'PARCEL') {
      return {
        key: 'WAIT_PAYMENT',
        title: 'รอผู้ซื้อชำระเงิน',
        description: 'เมื่อตรวจสลิปผ่านแล้ว ระบบจะให้คุณกรอกเลขพัสดุ',
        whoActs: 'BUYER',
      };
    }
    if (role === 'BUYER' && order.delivery === 'MEETUP') {
      return order.schedule && !order.schedule.confirmedByBuyer
        ? {
            key: 'CONFIRM_MEETUP',
            title: 'ยืนยันนัดรับ',
            description: 'ผู้ขายเสนอเวลาและจุดนัดมาแล้ว',
            whoActs: 'BUYER',
            primaryLabel: 'ยืนยันนัด',
          }
        : {
            key: 'WAIT',
            title: 'รอผู้ขายเสนอนัด',
            description: 'ใช้แชทออเดอร์ตกลงวันเวลาและจุดนัด',
            whoActs: 'SELLER',
          };
    }
  }

  if (order.status === 'COMPLETED' && (role === 'SELLER' || order.review)) {
    return {
      key: 'NONE',
      title: role === 'SELLER' ? 'ปิดการขายแล้ว' : 'รีวิวแล้ว · ขอบคุณที่ใช้กองดอง',
      description: STATUS_META.COMPLETED.explanation,
      whoActs: 'NONE',
    };
  }

  if (action) return action;

  return {
    key: 'NONE',
    title: STATUS_META[order.status].label,
    description: STATUS_META[order.status].explanation,
    whoActs: STATUS_META[order.status].whoActs,
  };
}

/** Chat opens after ACCEPTED and becomes read-only at COMPLETED. */
export function canChat(status: V4OrderStatus): boolean {
  return status !== 'REQUESTED' && status !== 'REJECTED' && status !== 'EXPIRED';
}

export function isChatReadOnly(status: V4OrderStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}
