/**
 * v4 masking / anti-leak rules.
 * Used by chat, listing descriptions and shop names.
 */

export const MASK = '•••';

export type LeakKind = 'PHONE' | 'LINE' | 'HANDLE' | 'EMAIL' | 'BANK' | 'SOCIAL' | 'OFF_APP';

interface Rule {
  kind: LeakKind;
  re: RegExp;
}

// Order matters: longest / most specific first.
const RULES: Rule[] = [
  { kind: 'EMAIL', re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/g },
  { kind: 'PHONE', re: /(?:\+?66|0)\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}/g },
  { kind: 'BANK', re: /\b\d{10,15}\b/g },
  { kind: 'PHONE', re: /\b\d{9,10}\b/g },
  { kind: 'HANDLE', re: /(^|[\s(])@[A-Za-z0-9._-]{2,}/g },
  { kind: 'LINE', re: /line\s*id|lineid|ไลน์|ไอดีไลน์|แอดไลน์/gi },
  { kind: 'SOCIAL', re: /facebook|\bfb\b|เฟส(?:บุ๊ก|บุ๊ค)?|instagram|\big\b|ไอจี|tiktok|ติ๊กต็อก|messenger|whatsapp|telegram/gi },
  { kind: 'OFF_APP', re: /เบอร์(?:โทร)?|โทรหา|โทรมา|ทักแชทส่วนตัว|ทักส่วนตัว|โอนตรง|โอนนอกแอป|เลขบัญชี|นอกแอป/gi },
];

function applyRules(text: string): { masked: string; hits: { kind: LeakKind; value: string }[] } {
  let masked = text;
  const hits: { kind: LeakKind; value: string }[] = [];

  for (const rule of RULES) {
    masked = masked.replace(rule.re, (match, prefix?: string) => {
      hits.push({ kind: rule.kind, value: match.trim() });
      const leading = typeof prefix === 'string' ? prefix : '';
      return `${leading}${MASK}`;
    });
  }

  return { masked, hits };
}

/** Replace phone-like, LINE, @handle, email and bank-like tokens with `•••`. */
export function maskContact(text: string): string {
  return applyRules(text).masked;
}

/** True when the text still contains something that looks like contact data. */
export function hasContactLeak(text: string): boolean {
  return applyRules(text).hits.length > 0;
}

export interface ContactLeak {
  kind: LeakKind;
  value: string;
}

/** Listing / shop-name validation: block save and explain which token is the problem. */
export function findContactLeaks(text: string): ContactLeak[] {
  const seen = new Set<string>();
  return applyRules(text).hits.filter((hit) => {
    const key = `${hit.kind}:${hit.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const KIND_LABEL: Record<LeakKind, string> = {
  PHONE: 'เบอร์โทร',
  LINE: 'ไลน์',
  HANDLE: 'ไอดีโซเชียล',
  EMAIL: 'อีเมล',
  BANK: 'เลขบัญชี',
  SOCIAL: 'โซเชียล',
  OFF_APP: 'ชวนติดต่อนอกแอป',
};

/** Human-readable list of what was hidden, e.g. "เบอร์โทร, ไลน์". */
export function describeLeaks(text: string): string {
  const kinds = Array.from(new Set(applyRules(text).hits.map((hit) => hit.kind)));
  return kinds.map((kind) => KIND_LABEL[kind]).join(', ');
}
