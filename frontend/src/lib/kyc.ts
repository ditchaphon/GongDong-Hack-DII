/**
 * Format-only KYC checks for the prototype (no external identity API).
 * Raw identifiers never leave the form: only masked values are stored.
 */

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

/** Thai national ID: 13 digits, last digit is a mod-11 checksum. */
export function isValidThaiId(raw: string): boolean {
  const id = onlyDigits(raw);
  if (!/^\d{13}$/.test(id)) return false;
  if (id[0] === '0') return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  return check === Number(id[12]);
}

/** Groups input as 1-2345-67890-12-3 while typing. */
export function formatThaiId(raw: string): string {
  const d = onlyDigits(raw).slice(0, 13);
  const parts = [d.slice(0, 1), d.slice(1, 5), d.slice(5, 10), d.slice(10, 12), d.slice(12, 13)];
  return parts.filter(Boolean).join('-');
}

export function maskThaiId(raw: string): string {
  const d = onlyDigits(raw);
  return `x-xxxx-xxxxx-${d.slice(10, 12)}-${d.slice(12, 13)}`;
}

export type PromptPayType = 'PHONE' | 'NATIONAL_ID';

/** PromptPay accepts a Thai mobile number (0x, 10 digits) or a national ID. */
export function detectPromptPay(raw: string): PromptPayType | null {
  const d = onlyDigits(raw);
  if (/^0[689]\d{8}$/.test(d)) return 'PHONE';
  if (d.length === 13 && isValidThaiId(d)) return 'NATIONAL_ID';
  return null;
}

export function maskPromptPay(raw: string): string {
  const d = onlyDigits(raw);
  if (d.length === 10) return `${d.slice(0, 2)}x-xxx-${d.slice(6)}`;
  return maskThaiId(d);
}

/** Thai or English letters, spaces, dots and hyphens; at least 2 letters. */
export function isValidPersonName(value: string): boolean {
  const clean = value.trim();
  return clean.length >= 2 && /^[฀-๿a-zA-Z .'-]+$/.test(clean);
}
