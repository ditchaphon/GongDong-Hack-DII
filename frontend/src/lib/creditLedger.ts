import { CreditEntry, CreditReason, CreditPack } from '@/types/v4';

/**
 * v4 credit ledger — pure functions.
 * Free to list. −1 credit on ACCEPTED. Reject = free. New user = 1 free credit.
 */

export const ACCEPT_COST = 1;
export const SIGNUP_BONUS = 1;

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 3,
    price: 20,
    note: 'ลองขาย 3 ออเดอร์',
  },
  {
    id: 'bookworm',
    name: 'Bookworm',
    credits: 10,
    price: 50,
    note: 'คุ้มที่สุด · ฿5 ต่อออเดอร์',
    isPopular: true,
  },
  {
    id: 'merchant',
    name: 'Merchant',
    credits: 25,
    price: 100,
    note: 'สำหรับร้านที่ขายเยอะ',
  },
];

export const CREDIT_REASON_LABEL: Record<CreditReason, string> = {
  SIGNUP_BONUS: 'เครดิตฟรีสำหรับผู้ใช้ใหม่',
  ACCEPT_ORDER: 'รับออเดอร์',
  NO_SHOW_REFUND: 'คืนเครดิต (ผู้ซื้อไม่มาตามนัด)',
  TOPUP: 'เติมเครดิต',
};

export function balanceOf(ledger: CreditEntry[]): number {
  return ledger.reduce((sum, entry) => sum + entry.delta, 0);
}

/** Newest first. */
export function sortLedger(ledger: CreditEntry[]): CreditEntry[] {
  return [...ledger].sort(
    (a, b) => new Date(b.atISO).getTime() - new Date(a.atISO).getTime()
  );
}

export interface LedgerResult {
  ok: boolean;
  ledger: CreditEntry[];
  entry?: CreditEntry;
  error?: string;
}

function push(
  ledger: CreditEntry[],
  reason: CreditReason,
  delta: number,
  extra: { orderId?: string; note?: string; atISO?: string } = {}
): LedgerResult {
  const nextBalance = balanceOf(ledger) + delta;
  if (nextBalance < 0) {
    return { ok: false, ledger, error: 'เครดิตไม่พอ กรุณาเติมเครดิตก่อน' };
  }
  const entry: CreditEntry = {
    id: `credit-${ledger.length + 1}-${Date.now()}`,
    atISO: extra.atISO ?? new Date().toISOString(),
    reason,
    delta,
    balanceAfter: nextBalance,
    orderId: extra.orderId,
    note: extra.note,
  };
  return { ok: true, ledger: [entry, ...ledger], entry };
}

export function canAcceptOrder(ledger: CreditEntry[]): boolean {
  return balanceOf(ledger) >= ACCEPT_COST;
}

export function spendForAccept(ledger: CreditEntry[], orderId: string): LedgerResult {
  if (!canAcceptOrder(ledger)) {
    return { ok: false, ledger, error: 'เครดิตไม่พอ กรุณาเติมเครดิตก่อนรับออเดอร์' };
  }
  return push(ledger, 'ACCEPT_ORDER', -ACCEPT_COST, { orderId });
}

export function refundNoShow(ledger: CreditEntry[], orderId: string): LedgerResult {
  return push(ledger, 'NO_SHOW_REFUND', ACCEPT_COST, { orderId });
}

export function topUp(ledger: CreditEntry[], pack: CreditPack): LedgerResult {
  return push(ledger, 'TOPUP', pack.credits, { note: `แพ็กเกจ ${pack.name}` });
}

export function signupBonus(ledger: CreditEntry[]): LedgerResult {
  return push(ledger, 'SIGNUP_BONUS', SIGNUP_BONUS);
}
