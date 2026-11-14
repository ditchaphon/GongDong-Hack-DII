import { MaskingResult, SensitiveDataType } from '../types';

// Regex สำหรับ Email
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.]{2,}/gi;

// Regex สำหรับเบอร์โทรศัพท์ (ขึ้นต้นด้วย 0 หรือ +66 รวม 9-10 หลัก รองรับเว้นวรรคและขีด)
const PHONE_REGEX = /(?:\+?66|0)[-.\s]?[0-9](?:[-.\s]?[0-9]){7,8}\b/g;

// Regex สำหรับเลขบัญชีธนาคาร (10-12 หลัก หรือรูปแบบ xxx-x-xxxxx-x)
const BANK_ACCOUNT_REGEX = /\b[0-9]{3}[-.\s]?[0-9][-.\s]?[0-9]{5}[-.\s]?[0-9]\b|\b[0-9]{10,12}\b/g;

// Regex สำหรับ LINE ID, Social Handlers, และคำสั่งติดต่อภายนอก
const LINE_CONTACT_REGEX = /(?:(?:แอด)?ไลน์\s*(?:id|ไอดี)?\s*(?:line\s*:\s*)?[:=\s]?\s*[@a-zA-Z0-9._-]+|\b(?:id\s*)?line\s*(?:id)?\s*[:=\s]\s*[@a-zA-Z0-9._-]+|\bid\s*[:=]\s*[@a-zA-Z0-9._-]+|@[a-zA-Z0-9._-]{3,})/gi;

// Regex สำหรับแพลตฟอร์มโซเชียลภายนอก (Facebook / IG / TikTok / Telegram / WhatsApp)
const SOCIAL_PLATFORM_REGEX = /(?:facebook|\bfb\b|เฟส(?:บุ๊ก|บุ๊ค)?|instagram|\big\b|ไอจี|tiktok|ติ๊กต็อก|messenger|whatsapp|telegram)\s*(?:[:=\-]\s*[@a-zA-Z0-9._\u0E00-\u0E7F-]+)?/gi;

// Regex สำหรับคำชวนโอนตรง / ติดต่อนอกแอป
const OFF_APP_REGEX = /(?:ทักแชทส่วนตัว|ทักส่วนตัว|โอนตรง|โอนนอกแอป|ติดต่อนอกแอป)/gi;

const MASK_REPLACEMENT = '•••';

/**
 * Service ตรวจจับและเซ็นเซอร์ข้อมูลติดต่อส่วนตัวในข้อความแชทและหมายเหตุ (Data Masking)
 * ป้องกันการแอบแลกเบอร์โทร, เลขบัญชี, หรือ LINE ID นอกระบบ
 *
 * @param text ข้อความนำเข้า
 * @returns MaskingResult { maskedText, hasMaskedData, detectedTypes }
 */
export function maskSensitiveData(text: string): MaskingResult {
  if (!text || typeof text !== 'string') {
    return {
      maskedText: text || '',
      hasMaskedData: false,
      detectedTypes: [],
    };
  }

  let maskedText = text;
  const detectedTypesSet = new Set<SensitiveDataType>();

  // 0. ตรวจจับและเซ็นเซอร์ Email (ต้องมาก่อน @handle เพื่อจับทั้ง address)
  if (EMAIL_REGEX.test(maskedText)) {
    detectedTypesSet.add('EMAIL');
    maskedText = maskedText.replace(EMAIL_REGEX, MASK_REPLACEMENT);
  }

  // 1. ตรวจจับและเซ็นเซอร์ LINE ID / Contact Keywords
  if (LINE_CONTACT_REGEX.test(maskedText)) {
    detectedTypesSet.add('LINE_ID');
    maskedText = maskedText.replace(LINE_CONTACT_REGEX, MASK_REPLACEMENT);
  }

  // 2. ตรวจจับและเซ็นเซอร์ Social Platforms & Off-App solicitation
  if (SOCIAL_PLATFORM_REGEX.test(maskedText)) {
    detectedTypesSet.add('SOCIAL');
    maskedText = maskedText.replace(SOCIAL_PLATFORM_REGEX, MASK_REPLACEMENT);
  }
  if (OFF_APP_REGEX.test(maskedText)) {
    detectedTypesSet.add('OFF_APP');
    maskedText = maskedText.replace(OFF_APP_REGEX, MASK_REPLACEMENT);
  }

  // 3. ตรวจจับและเซ็นเซอร์เบอร์โทรศัพท์
  if (PHONE_REGEX.test(maskedText)) {
    detectedTypesSet.add('PHONE');
    maskedText = maskedText.replace(PHONE_REGEX, MASK_REPLACEMENT);
  }

  // 4. ตรวจจับและเซ็นเซอร์เลขบัญชีธนาคาร (ที่ไม่ใช่ส่วนที่ถูกเซ็นเซอร์ไปแล้ว)
  if (BANK_ACCOUNT_REGEX.test(maskedText)) {
    detectedTypesSet.add('BANK_ACCOUNT');
    maskedText = maskedText.replace(BANK_ACCOUNT_REGEX, MASK_REPLACEMENT);
  }

  const detectedTypes = Array.from(detectedTypesSet);

  return {
    maskedText,
    hasMaskedData: detectedTypes.length > 0,
    detectedTypes,
  };
}

function splitGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/**
 * เซ็นเซอร์ชื่อจริงเจ้าของบัญชีรับเงิน (เช่น "สมชาย ใจดี" -> "สม••• ใจ•••")
 * ใช้สำหรับ Human Firewall แสดงเตือนชื่อบัญชีผู้รับโดยไม่เปิดเผยชื่อเต็มตามกฎ PDPA
 */
export function maskAccountHolderName(name?: string | null): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .split(/\s+/)
    .map((part) => {
      const graphemes = splitGraphemes(part);
      if (graphemes.length <= 1) {
        return '•';
      }
      if (graphemes.length === 2) {
        return `${graphemes[0]}•••`;
      }
      return `${graphemes.slice(0, 2).join('')}•••`;
    })
    .join(' ');
}
