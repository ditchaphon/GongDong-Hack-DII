import { describe, expect, it, vi } from 'vitest';
import {
  addMeetupPoint,
  deleteMeetupPoint,
  getPublicShop,
  hashThaiNationalId,
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
        { firstName: 'สมชาย', lastName: 'ใจดี', nationalId: VALID_THAI_ID, pdpaConsent: true },
        mockPrisma
      );

      expect(res.is_verified_seller).toBe(true);
      expect(res.kyc.national_id_masked).toBe('x-xxxx-xxxxx-45-0');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kycNationalIdHash: hashThaiNationalId(VALID_THAI_ID),
            pdpaConsentAt: expect.any(Date),
          }),
        })
      );

      const hashDupPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'usr-other-hash' }),
          update: vi.fn(),
        },
      };
      await expect(
        submitSellerKyc(
          'usr-1',
          { firstName: 'สมหมาย', lastName: 'ต่างนามสกุล', nationalId: VALID_THAI_ID },
          hashDupPrisma
        )
      ).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_KYC_IDENTITY' });
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

    it('ปฏิเสธชื่อที่มีตัวเลขหรือช่องทางติดต่อ และปฏิเสธ KYC ซ้ำกับบัญชีอื่น', async () => {
      await expect(
        submitSellerKyc(
          'usr-1',
          { firstName: 'สมชาย081', lastName: 'ใจดี', nationalId: VALID_THAI_ID },
          {}
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_NAME' });

      const dupPrisma = {
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'usr-other', kycFirstName: 'สมชาย', kycLastName: 'ใจดี' },
          ]),
          update: vi.fn(),
        },
      };

      await expect(
        submitSellerKyc(
          'usr-1',
          { firstName: ' สมชาย ', lastName: 'ใจดี', nationalId: VALID_THAI_ID },
          dupPrisma
        )
      ).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_KYC_IDENTITY' });
      expect(dupPrisma.user.update).not.toHaveBeenCalled();
    });

    it('ปฏิเสธ 403 KYC_BLACKLISTED และตั้ง isBlacklisted = true เมื่อพบประวัติใน Blacklistseller', async () => {
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue({ id: 'usr-1', isBlacklisted: true }),
        },
      };
      const blacklistChecker = vi.fn().mockResolvedValue({
        found: true,
        freqCount: 5,
        totalPrice: 2500,
      });

      await expect(
        submitSellerKyc(
          'usr-1',
          { firstName: 'สมชาย', lastName: 'ใจดี', nationalId: VALID_THAI_ID, pdpaConsent: true },
          mockPrisma,
          { blacklistChecker }
        )
      ).rejects.toMatchObject({ statusCode: 403, code: 'KYC_BLACKLISTED' });

      expect(blacklistChecker).toHaveBeenCalledWith(VALID_THAI_ID);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: {
          isBlacklisted: true,
          isVerifiedSeller: false,
        },
      });
    });

    it('ผ่าน KYC และตั้ง isBlacklisted = false เมื่อ Blacklistseller ไม่พบประวัติ', async () => {
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue({
            isVerifiedSeller: true,
            kycFirstName: 'สมชาย',
            kycLastName: 'ใจดี',
            kycNationalIdMasked: 'x-xxxx-xxxxx-45-0',
            kycVerifiedAt: new Date('2026-11-14T10:00:00Z'),
          }),
        },
      };
      const blacklistChecker = vi.fn().mockResolvedValue({
        found: false,
        freqCount: 0,
        totalPrice: 0,
      });

      const res = await submitSellerKyc(
        'usr-1',
        { firstName: 'สมชาย', lastName: 'ใจดี', nationalId: VALID_THAI_ID, pdpaConsent: true },
        mockPrisma,
        { blacklistChecker }
      );

      expect(res.is_verified_seller).toBe(true);
      expect(blacklistChecker).toHaveBeenCalledWith(VALID_THAI_ID);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isVerifiedSeller: true,
            isBlacklisted: false,
          }),
        })
      );
    });
  });

  describe('Contact-leak & validation guards', () => {
    it('ปฏิเสธ contact leak ในชื่อร้าน, shipWithinDays นอกช่วง, และพิกัดจุดนัดรับผิดช่วง', async () => {
      await expect(
        upsertMyShop(
          'usr-1',
          {
            shopName: 'ร้านไลน์ @shop99',
            province: 'เชียงใหม่',
            availableDays: [],
            availableSlots: [],
            supportsParcel: false,
          },
          {}
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'CONTACT_INFO_NOT_ALLOWED' });

      await expect(
        upsertMyShop(
          'usr-1',
          {
            shopName: 'ร้านหนังสือ',
            province: 'เชียงใหม่',
            availableDays: [],
            availableSlots: [],
            supportsParcel: true,
            shipMode: 'AFTER_ACCEPT',
            shipWithinDays: 30,
          },
          {}
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_SHIP_WITHIN_DAYS' });

      await expect(
        addMeetupPoint(
          'usr-1',
          { name: 'หอสมุด มช.', province: 'เชียงใหม่', lat: 120, lng: 98.95 },
          {}
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_COORDINATES' });
    });

    it('getPublicShop คืน rating = 0 เมื่อยังไม่มีรีวิว และไม่ fallback เป็น 5.0', async () => {
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'usr-1',
            nickname: 'ร้านใหม่',
            avatarUrl: null,
            isVerifiedSeller: false,
            createdAt: new Date('2026-11-01T00:00:00Z'),
            shopProfile: {
              id: 'shop-1',
              shopName: 'ร้านใหม่',
              description: 'ขายหนังสือ',
              avatarUrl: null,
              province: 'เชียงใหม่',
              supportsParcel: false,
              shipMode: 'AFTER_ACCEPT',
              shipWithinDays: 2,
              availableDays: [],
              availableSlots: [],
              meetupPoints: [],
            },
          }),
        },
        order: { count: vi.fn().mockResolvedValue(0) },
        review: { aggregate: vi.fn().mockResolvedValue({ _avg: { rating: null }, _count: { id: 0 } }) },
        bookListing: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const pub = await getPublicShop('usr-1', mockPrisma);
      expect(pub.rating).toBe(0);
      expect(pub.total_reviews).toBe(0);
    });
  });
});
