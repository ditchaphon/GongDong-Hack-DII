import { describe, expect, it, vi } from 'vitest';
import {
  calculateTopupCredits,
  getTopupPaymentQr,
  getUserProfile,
  processTopupSlip,
  updateUserProfile,
} from '../userService';

describe('userService', () => {
  describe('calculateTopupCredits', () => {
    it('ควรคำนวณเครดิตสำหรับแพ็กเกจ ฿20 เป็น 3 เครดิต', () => {
      expect(calculateTopupCredits(20)).toBe(3);
    });

    it('ควรคำนวณเครดิตสำหรับแพ็กเกจ ฿50 เป็น 10 เครดิต', () => {
      expect(calculateTopupCredits(50)).toBe(10);
    });

    it('ควรคำนวณเครดิตสำหรับแพ็กเกจ ฿100 เป็น 25 เครดิต', () => {
      expect(calculateTopupCredits(100)).toBe(25);
    });

    it('ควรโยน Error INVALID_TOPUP_AMOUNT เมื่อยอดเงินไม่ตรงกับแพ็กเกจ', () => {
      expect(() => calculateTopupCredits(30)).toThrowError(/ไม่ตรงกับแพ็กเกจมาตรฐาน/);
      expect(() => calculateTopupCredits(200)).toThrowError(/ไม่ตรงกับแพ็กเกจมาตรฐาน/);
      expect(() => calculateTopupCredits(15)).toThrowError(/ไม่ตรงกับแพ็กเกจมาตรฐาน/);
    });
  });

  describe('getUserProfile', () => {
    it('ควรดึงข้อมูลโปรไฟล์ของผู้ใช้สำเร็จ', async () => {
      const mockUser = {
        id: 'usr-1',
        lineUserId: 'line-1',
        displayName: 'Bookworm',
        pictureUrl: 'https://example.com/pic.jpg',
        nickname: 'หนอนหนังสือ',
        avatarUrl: 'https://example.com/avatar.webp',
        phoneNumber: '0812345678',
        verifiedName: 'สมชาย รักอ่าน',
        promptpayId: '0812345678',
        isVerifiedSeller: true,
        credits: 5,
        createdAt: new Date('2026-11-11T20:00:00Z'),
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
      };

      const result = await getUserProfile('usr-1', mockPrisma);

      expect(result.id).toBe('usr-1');
      expect(result.line_user_id).toBe('line-1');
      expect(result.nickname).toBe('หนอนหนังสือ');
      expect(result.credits).toBe(5);
      expect(result.is_verified_seller).toBe(true);
      expect(result.is_admin).toBe(false);

      const prevAdminIds = process.env.ADMIN_LINE_USER_IDS;
      process.env.ADMIN_LINE_USER_IDS = 'U_OTHER, line-1';
      try {
        const adminResult = await getUserProfile('usr-1', mockPrisma);
        expect(adminResult.is_admin).toBe(true);
      } finally {
        if (prevAdminIds === undefined) delete process.env.ADMIN_LINE_USER_IDS;
        else process.env.ADMIN_LINE_USER_IDS = prevAdminIds;
      }
    });

    it('ควรโยน Error 404 USER_NOT_FOUND หากไม่พบผู้ใช้', async () => {
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      await expect(getUserProfile('usr-not-found', mockPrisma)).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('updateUserProfile', () => {
    it('ควรอัปเดตข้อมูลส่วนตัวสำเร็จ', async () => {
      const existingUser = {
        id: 'usr-1',
        phoneNumber: '0811111111',
      };

      const updatedUser = {
        id: 'usr-1',
        nickname: 'นนท์กองดอง',
        avatarUrl: 'https://example.com/avatar_2.webp',
        phoneNumber: '0899999999',
        promptpayId: '0899999999',
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(existingUser),
          update: vi.fn().mockResolvedValue(updatedUser),
        },
      };

      const result = await updateUserProfile(
        'usr-1',
        {
          nickname: 'นนท์กองดอง',
          avatar_url: 'https://example.com/avatar_2.webp',
          phone_number: '089-999-9999',
          promptpay_id: '089-999-9999',
        },
        mockPrisma
      );

      expect(result.nickname).toBe('นนท์กองดอง');
      expect(result.phone_number).toBe('0899999999');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: {
          nickname: 'นนท์กองดอง',
          avatarUrl: 'https://example.com/avatar_2.webp',
          phoneNumber: '0899999999',
          promptpayId: '0899999999',
        },
      });
    });

    it('ควรยอมรับพร้อมเพย์ที่เป็นเลขบัตรประชาชน 13 หลัก', async () => {
      const existingUser = { id: 'usr-1' };
      const updatedUser = {
        id: 'usr-1',
        promptpayId: '1234567890123',
        nickname: null,
        avatarUrl: null,
        phoneNumber: null,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(existingUser),
          update: vi.fn().mockResolvedValue(updatedUser),
        },
      };

      const result = await updateUserProfile(
        'usr-1',
        { promptpay_id: '1-2345-67890-12-3' },
        mockPrisma
      );

      expect(result.promptpay_id).toBe('1234567890123');
    });

    it('ควรโยน Error INVALID_PHONE_NUMBER เมื่อเบอร์โทรศัพท์ผิดรูปแบบ', async () => {
      const existingUser = { id: 'usr-1' };
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(existingUser) },
      };

      await expect(
        updateUserProfile('usr-1', { phone_number: '12345' }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_PHONE_NUMBER',
      });
    });

    it('ควรโยน Error INVALID_PROMPTPAY_ID เมื่อพร้อมเพย์ผิดรูปแบบ', async () => {
      const existingUser = { id: 'usr-1' };
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(existingUser) },
      };

      await expect(
        updateUserProfile('usr-1', { promptpay_id: '999' }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_PROMPTPAY_ID',
      });
    });

    it('ควรป้องกันข้อมูลติดต่อใน nickname และสามารถล้าง phone_number / promptpay_id ด้วย null ได้', async () => {
      const existingUser = { id: 'usr-1', phoneNumber: '0811111111', promptpayId: '0811111111' };
      const updateMock = vi.fn().mockResolvedValue({
        id: 'usr-1',
        nickname: 'คนรักหนังสือ',
        avatarUrl: null,
        phoneNumber: null,
        promptpayId: null,
      });
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(existingUser),
          update: updateMock,
        },
      };

      await expect(
        updateUserProfile('usr-1', { nickname: 'แอดไลน์ @myshop99' }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CONTACT_INFO_NOT_ALLOWED',
      });

      const cleared = await updateUserProfile(
        'usr-1',
        { phone_number: null, promptpay_id: '' },
        mockPrisma
      );

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: {
          phoneNumber: null,
          promptpayId: null,
        },
      });
      expect(cleared.phone_number).toBeNull();
      expect(cleared.promptpay_id).toBeNull();
    });

    it('ควรบันทึก pdpaConsentAt ลงฐานข้อมูลเมื่อส่ง pdpa_consent: true และไม่ทับหากเคยยินยอมแล้ว', async () => {
      const updateMock = vi.fn().mockResolvedValue({
        id: 'usr-1',
        nickname: 'คนอ่าน',
        avatarUrl: null,
        phoneNumber: null,
        promptpayId: null,
        pdpaConsentAt: new Date('2026-11-14T12:00:00Z'),
      });
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'usr-1', pdpaConsentAt: null }),
          update: updateMock,
        },
      };

      const res = await updateUserProfile('usr-1', { pdpa_consent: true }, mockPrisma);
      expect(res.pdpa_consent_at).toEqual(new Date('2026-11-14T12:00:00Z'));
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: {
          pdpaConsentAt: expect.any(Date),
        },
      });
    });
  });

  describe('processTopupSlip (Frictionless KYC Level 2)', () => {
    it('ควรตรวจสอบและเติมเครดิต ฿20 พร้อมปลดล็อก is_verified_seller = true', async () => {
      const mockUser = {
        id: 'usr-1',
        displayName: 'นนท์',
        credits: 1,
        isVerifiedSeller: false,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
        paymentSlip: {
          findUnique: vi.fn().mockResolvedValue(null), // ไม่ซ้ำ
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx = {
            paymentSlip: { create: vi.fn().mockResolvedValue({ id: 'slip-1' }) },
            creditTransaction: { create: vi.fn().mockResolvedValue({ id: 'ctx-1' }) },
            user: {
              update: vi.fn().mockResolvedValue({
                id: 'usr-1',
                credits: 4,
                verifiedName: 'นาย นนทภัทร สุขสม',
                isVerifiedSeller: true,
              }),
            },
          };
          return callback(tx);
        }),
      };

      const result = await processTopupSlip(
        'usr-1',
        {
          slip_image_url: 'https://example.com/slip.webp',
          amount: 20,
          senderName: 'นาย นนทภัทร สุขสม',
          transRef: 'REF_TOPUP_123',
        },
        mockPrisma
      );

      expect(result.added_credits).toBe(3);
      expect(result.total_credits).toBe(4);
      expect(result.verified_name).toBe('นาย นนทภัทร สุขสม');
      expect(result.is_verified_seller).toBe(true);
    });

    it('ควรโยน Error DUPLICATE_SLIP เมื่อสลิปเคยถูกใช้งานแล้ว', async () => {
      const mockUser = { id: 'usr-1' };
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(mockUser) },
        paymentSlip: {
          findUnique: vi.fn().mockResolvedValue({ id: 'old-slip' }),
        },
      };

      await expect(
        processTopupSlip(
          'usr-1',
          {
            slip_image_url: 'https://example.com/slip.webp',
            transRef: 'USED_REF_999',
            amount: 20,
          },
          mockPrisma
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'DUPLICATE_SLIP',
      });
    });

    it('ควรโยน Error INVALID_TOPUP_AMOUNT เมื่อยอดเงินไม่ตรงกับแพ็กเกจ', async () => {
      const mockUser = { id: 'usr-1' };
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(mockUser) },
        paymentSlip: { findUnique: vi.fn().mockResolvedValue(null) },
      };

      await expect(
        processTopupSlip(
          'usr-1',
          {
            slip_image_url: 'https://example.com/slip.webp',
            transRef: 'REF_999',
            amount: 45, // ยอดที่ไม่ตรงแพ็กเกจ
          },
          mockPrisma
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_TOPUP_AMOUNT',
      });
    });

    it('ควรใช้งาน Custom SlipVerifier เมื่อส่งเข้ามา', async () => {
      const mockUser = { id: 'usr-1', displayName: 'เตชินท์' };
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(mockUser) },
        paymentSlip: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx = {
            paymentSlip: { create: vi.fn().mockResolvedValue({ id: 'slip-1' }) },
            creditTransaction: { create: vi.fn().mockResolvedValue({ id: 'ctx-1' }) },
            user: {
              update: vi.fn().mockResolvedValue({
                id: 'usr-1',
                credits: 11,
                verifiedName: 'นาย เตชินท์ เกียรติคุณ',
                isVerifiedSeller: true,
              }),
            },
          };
          return callback(tx);
        }),
      };

      const mockVerifier = vi.fn().mockResolvedValue({
        transRef: 'SLIPOK_TOPUP_50',
        amount: 50,
        senderName: 'นาย เตชินท์ เกียรติคุณ',
      });

      const result = await processTopupSlip(
        'usr-1',
        { slip_image_url: 'https://example.com/slip50.webp' },
        mockPrisma,
        mockVerifier
      );

      expect(mockVerifier).toHaveBeenCalledWith('https://example.com/slip50.webp', { log: true });
      expect(result.added_credits).toBe(10); // ฿50 = 10 credits
      expect(result.total_credits).toBe(11);
      expect(result.verified_name).toBe('นาย เตชินท์ เกียรติคุณ');
      expect(result.is_verified_seller).toBe(true);
    });

    it('ไม่เขียนทับ verifiedName ที่มีอยู่แล้วจาก KYC และกันสลิปซ้ำด้วย slipImageUrl', async () => {
      const userUpdateMock = vi.fn().mockResolvedValue({
        id: 'usr-1',
        credits: 13,
        verifiedName: 'สมชาย ใจดี',
        isVerifiedSeller: true,
      });

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'usr-1',
            displayName: 'LINE Name',
            verifiedName: 'สมชาย ใจดี',
            credits: 3,
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx = {
            paymentSlip: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({ id: 'slip-2' }),
            },
            creditTransaction: { create: vi.fn().mockResolvedValue({ id: 'ctx-2' }) },
            user: { update: userUpdateMock },
          };
          return callback(tx);
        }),
      };

      const res = await processTopupSlip(
        'usr-1',
        {
          slip_image_url: 'https://example.com/slip-pack.webp',
          pack_id: 'bookworm',
        },
        mockPrisma
      );

      expect(res.added_credits).toBe(10);
      expect(res.verified_name).toBe('สมชาย ใจดี');
      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: {
          credits: { increment: 10 },
          isVerifiedSeller: true,
        },
      });

      const dupImagePrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'usr-1', displayName: 'A', verifiedName: null }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          return callback({
            paymentSlip: { findFirst: vi.fn().mockResolvedValue({ id: 'existing' }) },
          });
        }),
      };

      await expect(
        processTopupSlip(
          'usr-1',
          { slip_image_url: 'https://example.com/slip-pack.webp', pack_id: 'starter' },
          dupImagePrisma
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'DUPLICATE_SLIP' });
    });
  });

  describe('getTopupPaymentQr', () => {
    it('ควรสร้าง PromptPay QR สำหรับแพ็กเกจ bookworm (฿50 / 10 เครดิต) สำเร็จ', async () => {
      const qr = await getTopupPaymentQr({ packId: 'bookworm' });

      expect(qr.packId).toBe('bookworm');
      expect(qr.credits).toBe(10);
      expect(qr.amount).toBe(50);
      expect(qr.recipientLabel).toBeTruthy();
      expect(qr.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(qr.payload).toContain('000201');
    });

    it('ควรรองรับการระบุยอดเงิน amount ตรงกับแพ็กเกจ ฿100', async () => {
      const qr = await getTopupPaymentQr({ amount: 100 });
      expect(qr.packId).toBe('merchant');
      expect(qr.credits).toBe(25);
      expect(qr.amount).toBe(100);
    });

    it('ควรโยน Error เมื่อระบุ pack_id ไม่ถูกต้องหรือไม่ได้ระบุแพ็กเกจ', async () => {
      await expect(getTopupPaymentQr({ packId: 'unknown' })).rejects.toThrowError(/แพ็กเกจเครดิตไม่ถูกต้อง/);
      await expect(getTopupPaymentQr({})).rejects.toThrowError(/กรุณาระบุ pack_id/);
    });
  });
});
