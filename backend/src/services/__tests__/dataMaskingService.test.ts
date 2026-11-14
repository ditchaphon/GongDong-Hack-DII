import { describe, it, expect } from 'vitest';
import { maskAccountHolderName, maskSensitiveData } from '../dataMaskingService';

describe('DataMaskingService - Chat & Note Contact Masking', () => {
  it('ข้อความทั่วไปที่ไม่มีข้อมูลติดต่อ ต้องไม่ถูกดัดแปลงและมี hasMaskedData เป็น false', () => {
    const text = 'สวัสดีครับ นัดเจอกันที่หน้าหอสมุดกลาง มช. วันพรุ่งนี้ 13:00 น. ได้ไหมครับ?';
    const result = maskSensitiveData(text);

    expect(result.maskedText).toBe(text);
    expect(result.hasMaskedData).toBe(false);
    expect(result.detectedTypes).toEqual([]);
  });

  it('ตัวเลขทั่วไป เช่น ราคา, ส่วนลด, เปอร์เซ็นต์, หรือจำนวนเล่ม ต้องไม่ถูกเซ็นเซอร์', () => {
    const text = 'หนังสือเล่มนี้ราคาปก 350 บาท ขาย 200 บาท ซื้อ 2 เล่มลด 10% สภาพ 95% เลยครับ';
    const result = maskSensitiveData(text);

    expect(result.maskedText).toBe(text);
    expect(result.hasMaskedData).toBe(false);
  });

  it('ควรตรวจจับและเซ็นเซอร์เบอร์โทรศัพท์ 10 หลัก (ทั้งแบบติดกันและมีขีด)', () => {
    const text1 = 'สะดวกโทร 0812345678 นะครับ';
    const result1 = maskSensitiveData(text1);
    expect(result1.maskedText).toBe('สะดวกโทร ••• นะครับ');
    expect(result1.hasMaskedData).toBe(true);
    expect(result1.detectedTypes).toContain('PHONE');

    const text2 = 'โทรหาผมได้ที่ 089-876-5432 หรือ 062 111 2233 ครับ';
    const result2 = maskSensitiveData(text2);
    expect(result2.maskedText).toBe('โทรหาผมได้ที่ ••• หรือ ••• ครับ');
    expect(result2.hasMaskedData).toBe(true);
    expect(result2.detectedTypes).toContain('PHONE');
  });

  it('ควรตรวจจับและเซ็นเซอร์เบอร์บ้าน 9 หลัก และรหัสประเทศ +66', () => {
    const text1 = 'เบอร์บ้าน 02-123-4567 ครับ';
    const result1 = maskSensitiveData(text1);
    expect(result1.maskedText).toBe('เบอร์บ้าน ••• ครับ');
    expect(result1.detectedTypes).toContain('PHONE');

    const text2 = 'เบอร์อินเตอร์ +66812345678';
    const result2 = maskSensitiveData(text2);
    expect(result2.maskedText).toBe('เบอร์อินเตอร์ •••');
    expect(result2.detectedTypes).toContain('PHONE');
  });

  it('ควรตรวจจับและเซ็นเซอร์เลขบัญชีธนาคาร 10-12 หลัก', () => {
    const text1 = 'โอนเงินเข้าบัญชี 123-4-56789-0 ธนาคารกรุงไทย';
    const result1 = maskSensitiveData(text1);
    expect(result1.maskedText).toBe('โอนเงินเข้าบัญชี ••• ธนาคารกรุงไทย');
    expect(result1.hasMaskedData).toBe(true);
    expect(result1.detectedTypes).toContain('BANK_ACCOUNT');

    const text2 = 'เลขบัญชี 987654321012 ได้เลยครับ';
    const result2 = maskSensitiveData(text2);
    expect(result2.maskedText).toBe('เลขบัญชี ••• ได้เลยครับ');
    expect(result2.detectedTypes).toContain('BANK_ACCOUNT');
  });

  it('ควรตรวจจับและเซ็นเซอร์ LINE ID และ Social Handles', () => {
    const text1 = 'แอดมาที่ line: bookshop_cm ได้เลย';
    const result1 = maskSensitiveData(text1);
    expect(result1.maskedText).toBe('แอดมาที่ ••• ได้เลย');
    expect(result1.hasMaskedData).toBe(true);
    expect(result1.detectedTypes).toContain('LINE_ID');

    const text2 = 'ทักไลน์มาคุย ไลน์ id: @reading_club';
    const result2 = maskSensitiveData(text2);
    expect(result2.maskedText).toBe('ทักไลน์มาคุย •••');
    expect(result2.detectedTypes).toContain('LINE_ID');
  });

  it('ควรตรวจจับและเซ็นเซอร์ข้อมูลหลายประเภทที่ปนกันในประโยคเดียวได้อย่างครบถ้วน', () => {
    const text = 'แอดไลน์ line: booklover หรือโทร 081-234-5678 โอนเข้า 123-4-56789-0 ได้เลย';
    const result = maskSensitiveData(text);

    expect(result.maskedText).toBe('••• หรือโทร ••• โอนเข้า ••• ได้เลย');
    expect(result.hasMaskedData).toBe(true);
    expect(result.detectedTypes).toContain('LINE_ID');
    expect(result.detectedTypes).toContain('PHONE');
    expect(result.detectedTypes).toContain('BANK_ACCOUNT');
  });

  it('กรณีข้อความว่างเปล่าหรือ null/undefined ต้องไม่ error', () => {
    expect(maskSensitiveData('')).toEqual({
      maskedText: '',
      hasMaskedData: false,
      detectedTypes: [],
    });
    // @ts-expect-error testing invalid type input
    expect(maskSensitiveData(null)).toEqual({
      maskedText: '',
      hasMaskedData: false,
      detectedTypes: [],
    });
  });

  it('maskAccountHolderName: เซ็นเซอร์ชื่อบัญชีผู้รับตามหลัก PDPA โดยคงตัวอักษรนำหน้าไว้เตือน Human Firewall', () => {
    expect(maskAccountHolderName('สมชาย ใจดี')).toBe('สม••• ใจ•••');
    expect(maskAccountHolderName('ป้า')).toBe('ป้•••');
    expect(maskAccountHolderName('รักดี')).toBe('รัก•••');
    expect(maskAccountHolderName('ก')).toBe('•');
    expect(maskAccountHolderName('')).toBeNull();
    expect(maskAccountHolderName(null)).toBeNull();
  });
});
