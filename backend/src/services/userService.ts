import { env } from '../config/env';
import { prisma as defaultPrisma } from '../config/prisma';
import { generatePromptPayQR } from './promptPayService';
import {
  AppError,
  CreditLedgerItem,
  TopupSlipInput,
  TopupSlipResult,
  UpdateUserProfileInput,
  UserProfileResponse,
} from '../types';

export const TOPUP_CREDIT_PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 3, price: 20 },
  { id: 'bookworm', name: 'Bookworm', credits: 10, price: 50 },
  { id: 'merchant', name: 'Merchant', credits: 25, price: 100 },
] as const;

/**
 * คำนวณจำนวนเครดิตที่ได้รับจากยอดเงินโอน (เฉพาะ 3 แพ็กเกจมาตรฐาน)
 * - ฿20 = 3 เครดิต
 * - ฿50 = 10 เครดิต
 * - ฿100 = 25 เครดิต
 */
export function calculateTopupCredits(amount: number): number {
  const roundedAmount = Math.round(Number(amount));
  const matched = TOPUP_CREDIT_PACKAGES.find((pkg) => pkg.price === roundedAmount);
  if (matched) return matched.credits;

  throw new AppError(
    'ยอดเงินเติมเครดิตไม่ตรงกับแพ็กเกจมาตรฐาน (รองรับ ฿20 = 3 เครดิต, ฿50 = 10 เครดิต, ฿100 = 25 เครดิต)',
    400,
    'INVALID_TOPUP_AMOUNT'
  );
}

/**
 * สร้าง PromptPay QR สำหรับเติมเครดิตเข้าบัญชีกองดอง (GET /api/users/me/topup-qr)
 */
export async function getTopupPaymentQr(options: {
  packId?: string;
  amount?: number;
}): Promise<{
  packId: string;
  credits: number;
  amount: number;
  recipientLabel: string;
  qrDataUrl: string;
  payload: string;
}> {
  const normalizedPackId = (options.packId || '').trim().toLowerCase();

  let selectedPackage = normalizedPackId
    ? TOPUP_CREDIT_PACKAGES.find((pkg) => pkg.id === normalizedPackId)
    : undefined;

  if (normalizedPackId && !selectedPackage) {
    throw new AppError(
      'แพ็กเกจเครดิตไม่ถูกต้อง (รองรับ starter, bookworm, merchant)',
      400,
      'INVALID_TOPUP_PACKAGE'
    );
  }

  if (!selectedPackage && options.amount !== undefined && !isNaN(Number(options.amount))) {
    const rounded = Math.round(Number(options.amount));
    selectedPackage = TOPUP_CREDIT_PACKAGES.find((pkg) => pkg.price === rounded);
    if (!selectedPackage) {
      throw new AppError(
        'ยอดเงินเติมเครดิตไม่ตรงกับแพ็กเกจมาตรฐาน (รองรับ ฿20 = 3 เครดิต, ฿50 = 10 เครดิต, ฿100 = 25 เครดิต)',
        400,
        'INVALID_TOPUP_AMOUNT'
      );
    }
  }

  if (!selectedPackage) {
    throw new AppError(
      'กรุณาระบุ pack_id (starter/bookworm/merchant) หรือ amount (20/50/100)',
      400,
      'MISSING_TOPUP_PACKAGE'
    );
  }

  const platformPromptPayId = env.PLATFORM_PROMPTPAY_ID?.trim();
  if (!platformPromptPayId && env.NODE_ENV === 'production') {
    throw new AppError(
      'ระบบยังไม่ได้ตั้งค่าบัญชีพร้อมเพย์กลางของแพลตฟอร์ม (Missing PLATFORM_PROMPTPAY_ID)',
      503,
      'PLATFORM_PROMPTPAY_NOT_CONFIGURED'
    );
  }

  const effectivePromptPayId = platformPromptPayId || '0800000000';
  const qr = await generatePromptPayQR(effectivePromptPayId, selectedPackage.price);

  return {
    packId: selectedPackage.id,
    credits: selectedPackage.credits,
    amount: selectedPackage.price,
    recipientLabel: env.PLATFORM_RECIPIENT_NAME,
    qrDataUrl: qr.qrDataUrl,
    payload: qr.payload,
  };
}

/**
 * ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน (GET /api/users/me)
 */
export async function getUserProfile(
  userId: string,
  prismaClient?: any
): Promise<UserProfileResponse> {
  const db = prismaClient || defaultPrisma;

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
  }

  return {
    id: user.id,
    line_user_id: user.lineUserId,
    display_name: user.displayName,
    picture_url: user.pictureUrl,
    nickname: user.nickname,
    avatar_url: user.avatarUrl,
    phone_number: user.phoneNumber,
    verified_name: user.verifiedName,
    promptpay_id: user.promptpayId,
    is_verified_seller: user.isVerifiedSeller,
    no_show_count: user.noShowCount ?? 0,
    credits: user.credits,
    created_at: user.createdAt,
  };
}

/**
 * บันทึกหรือแก้ไขข้อมูลส่วนตัว (PATCH /api/users/me)
 */
export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput,
  prismaClient?: any
): Promise<{
  nickname: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  promptpay_id: string | null;
}> {
  const db = prismaClient || defaultPrisma;

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
  }

  const updateData: {
    nickname?: string | null;
    avatarUrl?: string | null;
    phoneNumber?: string;
    promptpayId?: string;
  } = {};

  if (input.nickname !== undefined) {
    updateData.nickname = input.nickname ? input.nickname.trim() : null;
  }

  if (input.avatar_url !== undefined) {
    updateData.avatarUrl = input.avatar_url ? input.avatar_url.trim() : null;
  }

  if (input.phone_number !== undefined) {
    const rawPhone = input.phone_number ? input.phone_number.trim() : '';
    if (rawPhone) {
      const cleanPhone = rawPhone.replace(/[-\s]/g, '');
      if (!/^0\d{8,9}$/.test(cleanPhone)) {
        throw new AppError(
          'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็น 9-10 หลักขึ้นต้นด้วย 0)',
          400,
          'INVALID_PHONE_NUMBER'
        );
      }
      updateData.phoneNumber = cleanPhone;
    }
  }

  if (input.promptpay_id !== undefined) {
    const rawPromptPay = input.promptpay_id ? input.promptpay_id.trim() : '';
    if (rawPromptPay) {
      const cleanPromptPay = rawPromptPay.replace(/[-\s]/g, '');
      if (!/^\d{10}$|^\d{13}$/.test(cleanPromptPay)) {
        throw new AppError(
          'รูปแบบพร้อมเพย์ไม่ถูกต้อง (ต้องเป็นเบอร์โทรศัพท์ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก)',
          400,
          'INVALID_PROMPTPAY_ID'
        );
      }
      updateData.promptpayId = cleanPromptPay;
    }
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: updateData,
  });

  return {
    nickname: updated.nickname,
    avatar_url: updated.avatarUrl,
    phone_number: updated.phoneNumber,
    promptpay_id: updated.promptpayId,
  };
}

export type TopupSlipVerifier = (
  slipImageUrl: string,
  options?: { log?: boolean }
) => Promise<{
  transRef: string;
  amount: number;
  senderName: string;
}>;

/**
 * ผู้ขายแนบสลิปเติมเครดิตเพื่อทำ Frictionless KYC Level 2 (POST /api/users/me/topup-slip)
 * - บันทึกสลิปลง payment_slips (slip_type: CREDIT_TOPUP)
 * - ดึงชื่อผู้โอนบันทึกเป็น users.verified_name
 * - ปรับ users.is_verified_seller = true
 * - เพิ่มเครดิตตามแพ็กเกจ (฿20=3, ฿50=10, ฿100=25) บันทึกลง credit_transactions
 */
export async function processTopupSlip(
  userId: string,
  input: TopupSlipInput & {
    transRef?: string;
    amount?: number;
    senderName?: string;
  },
  prismaClient?: any,
  slipVerifier?: TopupSlipVerifier
): Promise<TopupSlipResult> {
  const db = prismaClient || defaultPrisma;

  if (!input.slip_image_url) {
    throw new AppError('กรุณาแนบรูปลิงก์สลิปโอนเงิน (slip_image_url)', 400, 'MISSING_SLIP_IMAGE');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
  }

  let transRef = input.transRef;
  let amount = input.amount;
  let senderName = input.senderName;

  // หากมี custom verifier ให้ทำการ verify
  if (slipVerifier) {
    const verified = await slipVerifier(input.slip_image_url, { log: true });
    transRef = verified.transRef;
    amount = verified.amount;
    senderName = verified.senderName;
  } else {
    // โหมดเริ่มต้น (Default / Mock Verifier สำหรับ Test & Development)
    if (!transRef) {
      transRef = `TOPUP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    if (amount === undefined) {
      amount = 20; // ค่าเริ่มต้นแพ็กเกจ ฿20
    }
    if (!senderName) {
      senderName = user.displayName || 'ผู้ใช้กองดอง';
    }
  }

  // 1. ตรวจสอบสลิปซ้ำ (Anti-Replay)
  const existingSlip = await db.paymentSlip.findUnique({
    where: { transRef },
  });

  if (existingSlip) {
    throw new AppError('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)', 400, 'DUPLICATE_SLIP');
  }

  // 2. คำนวณเครดิตตามแพ็กเกจ
  const addedCredits = calculateTopupCredits(amount);

  // 3. ปฏิบัติการใน ACID Transaction
  return await db.$transaction(async (tx: any) => {
    // 3.1 บันทึกสลิปลง payment_slips
    await tx.paymentSlip.create({
      data: {
        userId,
        slipType: 'CREDIT_TOPUP',
        slipImageUrl: input.slip_image_url,
        transRef,
        amount,
        receiverName: 'กองดอง (GongDong)',
        verificationStatus: 'AUTO_VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // 3.2 บันทึกประวัติลง credit_transactions
    // 3.2 อัปเดตเครดิต บันทึกชื่อยืนยัน และปรับ is_verified_seller = true
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        credits: { increment: addedCredits },
        verifiedName: senderName,
        isVerifiedSeller: true,
      },
    });

    // 3.3 บันทึกประวัติธุรกรรมเครดิต (Credit Ledger)
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: addedCredits,
        balanceAfter: updatedUser.credits,
        type: 'TOPUP',
        note: `เติมเครดิต ${addedCredits} เครดิต (฿${Math.round(amount)})`,
      },
    });

    return {
      added_credits: addedCredits,
      total_credits: updatedUser.credits,
      verified_name: updatedUser.verifiedName || senderName,
      is_verified_seller: updatedUser.isVerifiedSeller,
    };
  });
}

/**
 * ดึงประวัติธุรกรรมเครดิตของผู้ใช้ (GET /api/users/me/credits/history)
 */
export async function getCreditLedger(
  userId: string,
  limit = 50,
  offset = 0,
  prismaClient?: any
): Promise<{ items: CreditLedgerItem[]; total: number }> {
  const db = prismaClient || defaultPrisma;
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);

  const [rows, total] = await Promise.all([
    db.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      skip: safeOffset,
    }),
    db.creditTransaction.count({
      where: { userId },
    }),
  ]);

  return {
    items: rows.map((row: any) => ({
      id: row.id,
      amount: row.amount,
      balance_after: row.balanceAfter ?? null,
      type: row.type,
      order_id: row.orderId ?? null,
      note: row.note ?? null,
      created_at: row.createdAt,
    })),
    total,
  };
}
