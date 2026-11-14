import { describe, it, expect } from 'vitest';
import { generatePromptPayQR, sanitizePromptPayId } from '../promptPayService';

describe('PromptPayService - EMVCo Payload & QR Code Generation', () => {
  describe('sanitizePromptPayId', () => {
    it('ควรตัดขีดและช่องว่างออกจากเบอร์โทรศัพท์ 10 หลักได้อย่างถูกต้อง', () => {
      expect(sanitizePromptPayId('081-234-5678')).toBe('0812345678');
      expect(sanitizePromptPayId('081 234 5678')).toBe('0812345678');
    });

    it('ควรตัดขีดและช่องว่างออกจากเลขบัตรประชาชน 13 หลักได้อย่างถูกต้อง', () => {
      expect(sanitizePromptPayId('1-5099-01234-56-7')).toBe('1509901234567');
      expect(sanitizePromptPayId('1 5099 01234 56 7')).toBe('1509901234567');
    });

    it('ควรโยน Error เมื่อ PromptPay ID ไม่ใช่เบอร์มือถือ 10 หลัก หรือเลขบัตร ปชช. 13 หลัก', () => {
      expect(() => sanitizePromptPayId('0812345')).toThrow('PromptPay ID ไม่ถูกต้อง');
      expect(() => sanitizePromptPayId('abc1234567890')).toThrow('PromptPay ID ไม่ถูกต้อง');
      expect(() => sanitizePromptPayId('12345678901234')).toThrow('PromptPay ID ไม่ถูกต้อง');
    });
  });

  describe('generatePromptPayQR', () => {
    it('ควรสร้าง Base64 PNG และ EMVCo Payload จากเบอร์โทรศัพท์สำเร็จ', async () => {
      const result = await generatePromptPayQR('081-234-5678', 175.00);

      // ตรวจสอบ Data URL รูปภาพ Base64
      expect(result.qrDataUrl).toBeDefined();
      expect(result.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);

      // ตรวจสอบโครงสร้าง EMVCo Payload ของพร้อมเพย์
      expect(result.payload).toBeDefined();
      expect(typeof result.payload).toBe('string');
      expect(result.payload.startsWith('000201010212')).toBe(true); // Tag 00 & Tag 01 EMV standard
      expect(result.payload).toContain('175.00'); // ยอดเงินใน payload
    });

    it('ควรสร้าง QR Code จากเลขบัตรประชาชน 13 หลักสำเร็จ', async () => {
      const result = await generatePromptPayQR('1-5099-01234-56-7', 500);

      expect(result.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(result.payload.startsWith('000201010212')).toBe(true);
      expect(result.payload).toContain('500.00');
    });

    it('ควรโยน Error เมื่อยอดเงินน้อยกว่าหรือเท่ากับ 0 บาท', async () => {
      await expect(generatePromptPayQR('0812345678', 0)).rejects.toThrow(
        'ยอดเงิน (amount) ต้องเป็นตัวเลขที่มากกว่า 0 บาท'
      );
      await expect(generatePromptPayQR('0812345678', -50)).rejects.toThrow(
        'ยอดเงิน (amount) ต้องเป็นตัวเลขที่มากกว่า 0 บาท'
      );
      await expect(generatePromptPayQR('0812345678', NaN)).rejects.toThrow(
        'ยอดเงิน (amount) ต้องเป็นตัวเลขที่มากกว่า 0 บาท'
      );
    });

    it('ควรโยน Error เมื่อระบุ PromptPay ID ผิดพลาด', async () => {
      await expect(generatePromptPayQR('081234', 100)).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_PROMPTPAY_ID',
      });
    });
  });
});
