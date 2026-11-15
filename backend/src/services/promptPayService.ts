import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { AppError, PromptPayQRResult } from '../types';

/**
 * ล้างและตรวจรูปแบบ PromptPay ID (เบอร์โทร 10 หลัก หรือเลขประจำตัวประชาชน/Tax ID 13 หลัก)
 */
export function sanitizePromptPayId(rawId: string): string {
  const cleanId = rawId.replace(/[-\s]/g, '').trim();

  const isPhone = /^0[0-9]{9}$/.test(cleanId);
  const isCitizenId = /^[0-9]{13}$/.test(cleanId);

  if (!isPhone && !isCitizenId) {
    throw new AppError(
      `PromptPay ID ไม่ถูกต้อง: "${rawId}" (ต้องเป็นเบอร์มือถือ 10 หลักขึ้นต้นด้วย 0 หรือเลขบัตรประชาชน 13 หลัก)`,
      400,
      'INVALID_PROMPTPAY_ID'
    );
  }

  return cleanId;
}

/**
 * Service สร้าง PromptPay EMVCo Payload และ Base64 QR Code PNG
 *
 * @param promptPayId เบอร์มือถือ 10 หลัก หรือเลขประจำตัวประชาชน 13 หลัก
 * @param amount ยอดเงินที่ต้องการให้ชำระ (บาท) ต้องมากกว่า 0
 * @returns PromptPayQRResult { qrDataUrl, payload }
 */
export async function generatePromptPayQR(
  promptPayId: string,
  amount: number
): Promise<PromptPayQRResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(
      'ยอดเงิน (amount) ต้องเป็นตัวเลขที่มากกว่า 0 บาท',
      400,
      'INVALID_AMOUNT'
    );
  }

  const cleanId = sanitizePromptPayId(promptPayId);
  const formattedAmount = Number(amount.toFixed(2));

  // สร้าง EMVCo payload ด้วย promptpay-qr
  const payload = generatePayload(cleanId, { amount: formattedAmount });

  // แปลงเป็น Base64 Data URL สำหรับนำไปใส่ src ใน <img> ได้ทันที
  const qrDataUrl = await QRCode.toDataURL(payload, {
    margin: 2,
    scale: 8,
    errorCorrectionLevel: 'M',
  });

  return {
    qrDataUrl,
    payload,
  };
}
