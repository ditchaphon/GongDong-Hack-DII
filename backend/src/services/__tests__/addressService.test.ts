import { describe, expect, it, vi } from 'vitest';
import {
  createUserAddress,
  deleteUserAddress,
  getUserAddresses,
  updateUserAddress,
} from '../addressService';

describe('addressService (PDPA v4 No-Phone Addresses)', () => {
  it('ตั้งที่อยู่แรกเป็นค่าเริ่มต้นอัตโนมัติและปิด default เดิมเมื่อเพิ่ม default ใหม่', async () => {
    const tx = {
      userAddress: {
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: 'addr-1',
          fullName: 'นภัทร ใจดี',
          province: 'เชียงใหม่',
          district: 'เมืองเชียงใหม่',
          subdistrict: 'สุเทพ',
          postalCode: '50200',
          detail: '239 ถ.ห้วยแก้ว',
          isDefault: true,
          createdAt: new Date(),
        }),
      },
    };
    const mockPrisma = {
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };

    const res = await createUserAddress(
      'usr-1',
      {
        fullName: 'นภัทร ใจดี',
        province: 'เชียงใหม่',
        district: 'เมืองเชียงใหม่',
        subdistrict: 'สุเทพ',
        postalCode: '50200',
        detail: '239 ถ.ห้วยแก้ว',
      },
      mockPrisma
    );

    expect(res.is_default).toBe(true);
    expect(tx.userAddress.updateMany).toHaveBeenCalled();
  });

  it('ดึงรายการที่อยู่ทั้งหมดเรียงตาม default ล่าสุด', async () => {
    const mockPrisma = {
      userAddress: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'addr-1',
            fullName: 'นภัทร',
            province: 'เชียงใหม่',
            district: 'เมือง',
            subdistrict: 'สุเทพ',
            postalCode: '50200',
            detail: 'หอ 4',
            isDefault: true,
            createdAt: new Date(),
          },
        ]),
      },
    };

    const list = await getUserAddresses('usr-1', mockPrisma);
    expect(list).toHaveLength(1);
    expect(list[0].postal_code).toBe('50200');
  });

  it('ป้องกันการแก้ไขหรือลบที่อยู่ของผู้อื่น', async () => {
    const mockPrisma = {
      userAddress: {
        findUnique: vi.fn().mockResolvedValue({ id: 'addr-1', userId: 'other-user' }),
      },
    };

    await expect(
      updateUserAddress('usr-1', 'addr-1', { detail: 'ใหม่' }, mockPrisma)
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    await expect(deleteUserAddress('usr-1', 'addr-1', mockPrisma)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('รองรับ payload แบบ snake_case และปฏิเสธรหัสไปรษณีย์ที่ไม่ใช่ตัวเลข 5 หลัก', async () => {
    const tx = {
      userAddress: {
        count: vi.fn().mockResolvedValue(1),
        updateMany: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: 'addr-2',
          fullName: 'สมชาย รักอ่าน',
          province: 'กรุงเทพมหานคร',
          district: 'ปทุมวัน',
          subdistrict: 'วังใหม่',
          postalCode: '10330',
          detail: '99 ถ.พญาไท',
          isDefault: false,
          createdAt: new Date(),
        }),
      },
    };
    const mockPrisma = {
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };

    const res = await createUserAddress(
      'usr-1',
      {
        full_name: 'สมชาย รักอ่าน',
        province: 'กรุงเทพมหานคร',
        district: 'ปทุมวัน',
        subdistrict: 'วังใหม่',
        postal_code: '10330',
        detail: '99 ถ.พญาไท',
        is_default: false,
      },
      mockPrisma
    );

    expect(res.full_name).toBe('สมชาย รักอ่าน');
    expect(res.postal_code).toBe('10330');

    await expect(
      createUserAddress(
        'usr-1',
        {
          fullName: 'สมชาย',
          province: 'เชียงใหม่',
          district: 'เมือง',
          subdistrict: 'สุเทพ',
          postalCode: '5020',
          detail: '1/1',
        },
        mockPrisma
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_POSTAL_CODE' });
  });

  it('จำกัดจำนวนที่อยู่จัดส่งสูงสุด 5 รายการต่อผู้ใช้', async () => {
    const tx = {
      userAddress: {
        count: vi.fn().mockResolvedValue(5),
      },
    };
    const mockPrisma = {
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };

    await expect(
      createUserAddress(
        'usr-1',
        {
          fullName: 'นภัทร ใจดี',
          province: 'เชียงใหม่',
          district: 'เมืองเชียงใหม่',
          subdistrict: 'สุเทพ',
          postalCode: '50200',
          detail: '239 ถ.ห้วยแก้ว',
        },
        mockPrisma
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'MAX_ADDRESSES_REACHED' });
  });
});
