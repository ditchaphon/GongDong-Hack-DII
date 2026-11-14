import { describe, expect, it, vi } from 'vitest';
import {
  addMeetupPoint,
  deleteMeetupPoint,
  isValidThaiNationalId,
  maskThaiNationalId,
  submitSellerKyc,
  upsertMyShop,
} from '../shopService';

describe('shopService', () => {
  // เลขบัตร 13 หลักจำลองที่ผ่าน Mod-11: 1101700203451 -> compute valid check digit
  // 1*13 + 1*12 + 0*11 + 1*10 + 7*9 + 0*8 + 0*7 + 2*6 + 0*5 + 3*4 + 4*3 + 5*2 = 13+12+0+10+63+0+0+12+0+12+12+10 = 144 -> 144%11=1 -> (11-1)%10=0 => 1101700203450
  const VALID_THAI_ID = '1101700203450';

  describe('Thai National ID Validation & Masking', () => {
    it('ตรวจสอบ Mod-11 และ mask เหลือ 3 หลักท้ายอย่างถูกต้อง', () => {
      expect(isValidThaiNationalId(VALID_THAI_ID)).toBe(true);
      expect(isValidThaiNationalId('1-1017-00203-45-0')).toBe(true);
      expect(isValidThaiNationalId('1101700203459')).toBe(false);
      expect(isValidThaiNationalId('0101700203450')).toBe(false);
      expect(maskThaiNationalId(VALID_THAI_ID)).toBe('x-xxxx-xxxxx-45-0');
    });
  });

  describe('upsertMyShop', () => {
    it('สร้างหรืออัปเดตร้านค้าพร้อมตั้ง setupComplete = true', async () => {
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue({ id: 'usr-1' }) },
        shopProfile: {
          upsert: vi.fn().mockResolvedValue({
            id: 'shop-1',
            shopName: 'ร้านหนังสือหลังมอ',
            description: 'หนังสือมือสองสภาพดี',
            avatarUrl: null,
            province: 'เชียงใหม่',
            availableDays: ['เสาร์', 'อาทิตย์'],
            availableSlots: ['13:00-15:00'],
            supportsParcel: true,
            shipMode: 'AFTER_ACCEPT',
            shipWithinDays: 2,
            setupComplete: true,
            meetupPoints: [],
          }),
        },
      };

      const res = await upsertMyShop(
        'usr-1',
        {
          shopName: 'ร้านหนังสือหลังมอ',
          province: 'เชียงใหม่',
          availableDays: ['เสาร์', 'อาทิตย์'],
          availableSlots: ['13:00-15:00'],
          supportsParcel: true,
        },
        mockPrisma
      );

      expect(res.shop_name).toBe('ร้านหนังสือหลังมอ');
      expect(res.setup_complete).toBe(true);
    });

    it('ปฏิเสธเมื่อไม่ระบุชื่อร้านค้า', async () => {
      await expect(
        upsertMyShop(
          'usr-1',
          {
            shopName: '   ',
            province: 'เชียงใหม่',
            availableDays: [],
            availableSlots: [],
            supportsParcel: false,
          },
          {}
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'MISSING_SHOP_NAME' });
    });
  });

  describe('Meetup Points', () => {
    it('เพิ่มและลบจุดนัดรับพร้อมตรวจสิทธิ์เจ้าของร้าน', async () => {
      const mockPrisma = {
        shopProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'shop-1', userId: 'usr-1' }) },
        shopMeetupPoint: {
          create: vi.fn().mockResolvedValue({
            id: 'pt-1',
            name: 'หน้าหอสมุดกลาง มช.',
            province: 'เชียงใหม่',
            lat: 18.795,
            lng: 98.952,
            note: 'หน้าป้าย',
          }),
          findUnique: vi.fn().mockResolvedValue({
            id: 'pt-1',
            shopProfile: { userId: 'other-user' },
          }),
          delete: vi.fn(),
        },
      };

      const created = await addMeetupPoint(
        'usr-1',
        { name: 'หน้าหอสมุดกลาง มช.', province: 'เชียงใหม่', lat: 18.795, lng: 98.952 },
        mockPrisma
      );
      expect(created.id).toBe('pt-1');

      await expect(deleteMeetupPoint('usr-1', 'pt-1', mockPrisma)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('submitSellerKyc', () => {
    it('บันทึกเฉพาะเลขบัตรแบบ Masked และเปิด isVerifiedSeller = true', async () => {
      const mockPrisma = {
        user: {
          update: vi.fn().mockResolvedValue({
            isVerifiedSeller: true,
            kycFirstName: 'สมชาย',
            kycLastName: 'ใจดี',
            kycNationalIdMasked: 'x-xxxx-xxxxx-45-0',
            kycVerifiedAt: new Date('2026-11-14T10:00:00Z'),
          }),
        },
      };

      const res = await submitSellerKyc(
        'usr-1',
        { firstName: 'สมชาย', lastName: 'ใจดี', nationalId: VALID_THAI_ID },
        mockPrisma
      );

      expect(res.is_verified_seller).toBe(true);
      expect(res.kyc.national_id_masked).toBe('x-xxxx-xxxxx-45-0');
    });

    it('ปฏิเสธเลขบัตรประชาชนที่ผิด Checksum', async () => {
      await expect(
        submitSellerKyc(
          'usr-1',
          { firstName: 'สมชาย', lastName: 'ใจดี', nationalId: '1101700203459' },
          {}
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_NATIONAL_ID' });
    });
  });
});
