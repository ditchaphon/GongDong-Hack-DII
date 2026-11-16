import { describe, expect, it } from 'vitest';
import { calcParcelFee, regionOfProvince } from '../shippingService';

describe('shippingService', () => {
  describe('regionOfProvince', () => {
    it('จำแนกภูมิภาคของจังหวัดได้ถูกต้อง', () => {
      expect(regionOfProvince('เชียงใหม่')).toBe('N');
      expect(regionOfProvince('ภูเก็ต')).toBe('S');
      expect(regionOfProvince('ขอนแก่น')).toBe('NE');
      expect(regionOfProvince('กรุงเทพมหานคร')).toBe('C');
      expect(regionOfProvince(undefined)).toBe('C');
    });
  });

  describe('calcParcelFee', () => {
    it('คำนวณค่าส่งแบบ Flat Base: เล่มแรก ฿50 + เล่มถัดไป ฿10/เล่ม ทั้งภาคเดียวกันและข้ามภาค', () => {
      expect(calcParcelFee(1, 'เชียงใหม่', 'ลำพูน')).toBe(50);
      expect(calcParcelFee(2, 'เชียงใหม่', 'เชียงราย')).toBe(60);
      expect(calcParcelFee(3, 'กรุงเทพมหานคร', 'นนทบุรี')).toBe(70);
      expect(calcParcelFee(1, 'เชียงใหม่', 'กรุงเทพมหานคร')).toBe(50);
      expect(calcParcelFee(2, 'เชียงใหม่', 'ขอนแก่น')).toBe(60);
      expect(calcParcelFee(3, 'ภูเก็ต', 'เชียงใหม่')).toBe(70);
    });

    it('หากไม่ได้ระบุจังหวัดต้นทาง/ปลายทาง ยังคำนวณตามจำนวนเล่ม และคืน 0 เมื่อไม่มีหนังสือ', () => {
      expect(calcParcelFee(1, null, 'กรุงเทพมหานคร')).toBe(50);
      expect(calcParcelFee(2, 'เชียงใหม่', null)).toBe(60);
      expect(calcParcelFee(0, 'เชียงใหม่', 'กรุงเทพมหานคร')).toBe(0);
    });
  });
});
