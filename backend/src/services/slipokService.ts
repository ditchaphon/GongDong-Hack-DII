import { env } from '../config/env';
import { AppError } from '../types/services';

/**
 * SlipOK slip verification (https://slipok.com).
 * POST https://api.slipok.com/api/line/apikey/{branchId}
 *   header  x-authorization: <API key>
 *   body    { url, log, amount? }
 * `log: true` makes SlipOK remember the slip so a re-used slip returns code 1012.
 */

export interface SlipOkResult {
  transRef: string;
  amount: number;
  senderName: string;
  receiverName?: string;
  transDate?: string;
  raw: unknown;
}

export function isSlipOkConfigured(): boolean {
  return Boolean(env.SLIPOK_API_KEY && env.SLIPOK_BRANCH_ID);
}

const ERROR_MAP: Record<number, { status: number; code: string; message: string }> = {
  1006: { status: 400, code: 'SLIP_INVALID_IMAGE', message: 'รูปภาพไม่ใช่สลิปโอนเงิน หรืออ่าน QR ไม่ได้' },
  1007: { status: 400, code: 'SLIP_NO_QR', message: 'ไม่พบ QR Code บนสลิป กรุณาใช้รูปสลิปที่ชัดเจน' },
  1008: { status: 400, code: 'SLIP_NOT_PAYMENT', message: 'QR นี้ไม่ใช่สลิปการโอนเงิน' },
  1010: { status: 400, code: 'SLIP_PENDING_BANK', message: 'ธนาคารยังไม่ยืนยันรายการนี้ ลองใหม่อีกครั้งในไม่กี่นาที' },
  1011: { status: 400, code: 'SLIP_NOT_FOUND', message: 'ไม่พบรายการโอนนี้ในระบบธนาคาร' },
  1012: { status: 400, code: 'DUPLICATE_SLIP', message: 'สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)' },
  1013: { status: 400, code: 'SLIP_AMOUNT_MISMATCH', message: 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ' },
  1014: { status: 400, code: 'SLIP_RECEIVER_MISMATCH', message: 'บัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีของกองดอง' },
};

const pickName = (party: any): string =>
  String(party?.displayName || party?.name || party?.account?.name?.th || party?.account?.name?.en || '').trim();

export async function verifySlipWithSlipOk(
  slipImageUrl: string,
  options: { amount?: number; log?: boolean } = {}
): Promise<SlipOkResult> {
  if (!isSlipOkConfigured()) {
    throw new AppError('ยังไม่ได้ตั้งค่า SlipOK (SLIPOK_API_KEY / SLIPOK_BRANCH_ID)', 503, 'SLIP_VERIFIER_NOT_CONFIGURED');
  }
  if (/mock-storage\.gongdong\.local/.test(slipImageUrl)) {
    throw new AppError(
      'รูปสลิปยังไม่ได้อัปโหลดขึ้น Supabase Storage จริง (SlipOK เปิดลิงก์จำลองไม่ได้)',
      503,
      'SLIP_STORAGE_NOT_CONFIGURED'
    );
  }

  const body: Record<string, unknown> = { url: slipImageUrl, log: options.log ?? true };
  if (options.amount !== undefined) body.amount = Math.round(options.amount * 100) / 100;

  let response: Response;
  try {
    response = await fetch(`https://api.slipok.com/api/line/apikey/${env.SLIPOK_BRANCH_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': env.SLIPOK_API_KEY as string,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new AppError('เชื่อมต่อระบบตรวจสลิป (SlipOK) ไม่สำเร็จ กรุณาลองใหม่', 502, 'SLIP_VERIFIER_UNREACHABLE');
  }

  const json: any = await response.json().catch(() => ({}));
  const data = json?.data ?? {};

  if (!response.ok || json?.success === false || data?.success === false) {
    const code = Number(json?.code ?? data?.code);
    const mapped = ERROR_MAP[code];
    if (mapped) throw new AppError(mapped.message, mapped.status, mapped.code);
    if (response.status === 401 || response.status === 403) {
      throw new AppError('SlipOK ปฏิเสธ API key หรือ Branch ID', 502, 'SLIP_VERIFIER_AUTH_FAILED');
    }
    throw new AppError(
      `ตรวจสลิปไม่ผ่าน${json?.message ? `: ${json.message}` : ''}`,
      400,
      'SLIP_VERIFICATION_FAILED'
    );
  }

  const transRef = String(data.transRef || '').trim();
  if (!transRef) {
    throw new AppError('SlipOK ไม่ส่งเลขอ้างอิงรายการกลับมา', 502, 'SLIP_VERIFICATION_FAILED');
  }

  return {
    transRef,
    amount: Number(data.amount ?? data.paidLocalAmount ?? 0),
    senderName: pickName(data.sender) || 'ไม่ระบุชื่อผู้โอน',
    receiverName: pickName(data.receiver) || undefined,
    transDate: data.transDate,
    raw: data,
  };
}
