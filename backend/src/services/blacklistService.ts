import { env } from '../config/env';
import { AppError } from '../types/services';

/**
 * Blacklistseller ID card summary check (https://api.blacklistseller.com).
 * POST /api/v1/queries/idcard-summary/
 *   header  X-API-Key: <API key>
 *   body    { idcard: "<13-digit national ID>" }
 */

export interface BlacklistCheckResult {
  found: boolean;
  freqCount: number;
  totalPrice: number;
  message?: string;
}

export interface BlacklistCheckOptions {
  apiKey?: string;
  apiUrl?: string;
  fetchFn?: typeof fetch;
}

export function isBlacklistSellerConfigured(apiKeyOverride?: string): boolean {
  const key = apiKeyOverride !== undefined ? apiKeyOverride : env.BLACKLISTSELLER_API_KEY;
  return Boolean(key?.trim());
}

/**
 * ตรวจสอบเลขบัตรประชาชน 13 หลักกับฐานข้อมูล Blacklistseller
 * (ไม่เก็บและไม่ log เลขบัตรประชาชนดิบ)
 */
export async function checkIdCardWithBlacklistSeller(
  nationalId: string,
  options: BlacklistCheckOptions = {}
): Promise<BlacklistCheckResult> {
  const digits = nationalId.replace(/\D/g, '');
  if (digits.length !== 13) {
    throw new AppError('เลขบัตรประชาชน 13 หลักไม่ถูกต้อง', 400, 'INVALID_NATIONAL_ID');
  }

  const apiKey = (options.apiKey !== undefined ? options.apiKey : env.BLACKLISTSELLER_API_KEY)?.trim();
  if (!apiKey) {
    throw new AppError(
      'ยังไม่ได้ตั้งค่า Blacklistseller API Key (BLACKLISTSELLER_API_KEY)',
      503,
      'BLACKLIST_API_NOT_CONFIGURED'
    );
  }

  const apiUrl = (options.apiUrl || env.BLACKLISTSELLER_API_URL).trim();
  const fetchFn = options.fetchFn || fetch;

  let response: Response;
  try {
    response = await fetchFn(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ idcard: digits }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError(
      'เชื่อมต่อระบบตรวจสอบบัญชีดำ (Blacklistseller) ไม่สำเร็จ กรุณาลองใหม่',
      502,
      'BLACKLIST_API_UNREACHABLE'
    );
  }

  const json: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 400) {
      throw new AppError('เลขบัตรประชาชนไม่ตรงรูปแบบที่ระบบตรวจสอบรองรับ', 400, 'INVALID_NATIONAL_ID');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        'Blacklistseller ปฏิเสธ API key หรือแพ็กเกจปัจจุบันไม่รองรับการตรวจสอบ',
        502,
        'BLACKLIST_API_AUTH_FAILED'
      );
    }
    if (response.status === 429) {
      throw new AppError(
        'ระบบตรวจสอบบัญชีดำถูกใช้งานเกินโควตาชั่วคราว กรุณาลองใหม่ภายหลัง',
        503,
        'BLACKLIST_API_RATE_LIMITED'
      );
    }
    throw new AppError(
      'ระบบตรวจสอบบัญชีดำ (Blacklistseller) ขัดข้องชั่วคราว กรุณาลองใหม่',
      502,
      'BLACKLIST_API_ERROR'
    );
  }

  const result = json?.result ?? {};
  const dataRows: any[] = Array.isArray(result?.data) ? result.data : [];
  const freqCount = dataRows.reduce((sum, row) => sum + Number(row?.freq_count || 0), 0);
  const totalPrice = dataRows.reduce((sum, row) => sum + Number(row?.total_price || 0), 0);
  const found = Boolean(result?.found) || freqCount > 0 || dataRows.length > 0;

  return {
    found,
    freqCount,
    totalPrice,
    message: typeof json?.message === 'string' ? json.message : undefined,
  };
}
