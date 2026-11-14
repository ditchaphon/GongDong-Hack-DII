import { prisma as defaultPrisma } from '../config/prisma';
import { AppError, UserAddressInput } from '../types';

const MAX_USER_ADDRESSES = 5;
const POSTAL_CODE_REGEX = /^\d{5}$/;

function normalizeAddressInput(input: Partial<UserAddressInput>) {
  return {
    fullName: input.fullName ?? input.full_name,
    province: input.province,
    district: input.district,
    subdistrict: input.subdistrict,
    postalCode: input.postalCode ?? input.postal_code,
    detail: input.detail,
    isDefault: input.isDefault ?? input.is_default,
  };
}

/**
 * ดึงรายการที่อยู่จัดส่งทั้งหมดของผู้ซื้อ (GET /api/users/me/addresses)
 */
export async function getUserAddresses(userId: string, prismaClient?: any) {
  const db = prismaClient || defaultPrisma;

  const addresses = await db.userAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return addresses.map((a: any) => ({
    id: a.id,
    full_name: a.fullName,
    province: a.province,
    district: a.district,
    subdistrict: a.subdistrict,
    postal_code: a.postalCode,
    detail: a.detail,
    is_default: a.isDefault,
    created_at: a.createdAt,
  }));
}

/**
 * เพิ่มที่อยู่จัดส่งใหม่ (POST /api/users/me/addresses) — ไม่มีเบอร์โทรตาม PDPA v4
 */
export async function createUserAddress(
  userId: string,
  rawInput: UserAddressInput,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;
  const input = normalizeAddressInput(rawInput);

  if (
    !input.fullName?.trim() ||
    !input.province?.trim() ||
    !input.district?.trim() ||
    !input.subdistrict?.trim() ||
    !input.postalCode?.trim() ||
    !input.detail?.trim()
  ) {
    throw new AppError('กรุณากรอกข้อมูลที่อยู่จัดส่งให้ครบถ้วน', 400, 'MISSING_REQUIRED_FIELDS');
  }

  const trimmedPostalCode = input.postalCode.trim();
  if (!POSTAL_CODE_REGEX.test(trimmedPostalCode)) {
    throw new AppError('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก', 400, 'INVALID_POSTAL_CODE');
  }

  return await db.$transaction(async (tx: any) => {
    const existingCount = await tx.userAddress.count({ where: { userId } });
    if (existingCount >= MAX_USER_ADDRESSES) {
      throw new AppError(
        `บันทึกที่อยู่ได้สูงสุด ${MAX_USER_ADDRESSES} รายการ กรุณาลบที่อยู่เดิมก่อนเพิ่มใหม่`,
        400,
        'MAX_ADDRESSES_REACHED'
      );
    }

    const shouldBeDefault = Boolean(input.isDefault) || existingCount === 0;

    if (shouldBeDefault) {
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.userAddress.create({
      data: {
        userId,
        fullName: input.fullName!.trim(),
        province: input.province!.trim(),
        district: input.district!.trim(),
        subdistrict: input.subdistrict!.trim(),
        postalCode: trimmedPostalCode,
        detail: input.detail!.trim(),
        isDefault: shouldBeDefault,
      },
    });

    return {
      id: created.id,
      full_name: created.fullName,
      province: created.province,
      district: created.district,
      subdistrict: created.subdistrict,
      postal_code: created.postalCode,
      detail: created.detail,
      is_default: created.isDefault,
      created_at: created.createdAt,
    };
  });
}

/**
 * แก้ไขที่อยู่จัดส่ง (PATCH /api/users/me/addresses/:id)
 */
export async function updateUserAddress(
  userId: string,
  addressId: string,
  rawInput: Partial<UserAddressInput>,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;
  const input = normalizeAddressInput(rawInput);

  const existing = await db.userAddress.findUnique({ where: { id: addressId } });
  if (!existing) {
    throw new AppError('ไม่พบที่อยู่จัดส่งที่ระบุ', 404, 'ADDRESS_NOT_FOUND');
  }
  if (existing.userId !== userId) {
    throw new AppError('คุณไม่มีสิทธิ์แก้ไขที่อยู่นี้', 403, 'FORBIDDEN');
  }

  if (input.postalCode !== undefined && !POSTAL_CODE_REGEX.test(input.postalCode.trim())) {
    throw new AppError('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก', 400, 'INVALID_POSTAL_CODE');
  }

  return await db.$transaction(async (tx: any) => {
    if (input.isDefault) {
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const updated = await tx.userAddress.update({
      where: { id: addressId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
        ...(input.province !== undefined ? { province: input.province.trim() } : {}),
        ...(input.district !== undefined ? { district: input.district.trim() } : {}),
        ...(input.subdistrict !== undefined ? { subdistrict: input.subdistrict.trim() } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode.trim() } : {}),
        ...(input.detail !== undefined ? { detail: input.detail.trim() } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });

    return {
      id: updated.id,
      full_name: updated.fullName,
      province: updated.province,
      district: updated.district,
      subdistrict: updated.subdistrict,
      postal_code: updated.postalCode,
      detail: updated.detail,
      is_default: updated.isDefault,
    };
  });
}

/**
 * ลบที่อยู่จัดส่ง (DELETE /api/users/me/addresses/:id)
 */
export async function deleteUserAddress(
  userId: string,
  addressId: string,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;

  const existing = await db.userAddress.findUnique({ where: { id: addressId } });
  if (!existing) {
    throw new AppError('ไม่พบที่อยู่จัดส่งที่ระบุ', 404, 'ADDRESS_NOT_FOUND');
  }
  if (existing.userId !== userId) {
    throw new AppError('คุณไม่มีสิทธิ์ลบที่อยู่นี้', 403, 'FORBIDDEN');
  }

  await db.userAddress.delete({ where: { id: addressId } });
  return { deleted: true, id: addressId };
}
