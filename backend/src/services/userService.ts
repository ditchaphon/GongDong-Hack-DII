import { env } from '../config/env';
import { prisma as defaultPrisma } from '../config/prisma';
import { isAdminLineUserId } from '../utils/secretAuth';
import { maskSensitiveData } from './dataMaskingService';
import { generatePromptPayQR } from './promptPayService';
import { extractStoragePathFromUrl } from './uploadService';
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

  if (!selectedPackage && options.amount !== undefined) {
    const numAmount = Number(options.amount);
    if (!Number.isFinite(numAmount)) {
      throw new AppError(
        'ยอดเงินเติมเครดิตไม่ถูกต้อง (รองรับ ฿20 = 3 เครดิต, ฿50 = 10 เครดิต, ฿100 = 25 เครดิต)',
        400,
        'INVALID_TOPUP_AMOUNT'
      );
    }
    const rounded = Math.round(numAmount);
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
    is_admin: isAdminLineUserId(
      user.lineUserId,
      process.env.ADMIN_LINE_USER_IDS ?? env.ADMIN_LINE_USER_IDS
    ),
    pdpa_consent_at: user.pdpaConsentAt ?? null,
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
  pdpa_consent_at?: Date | null;
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
    phoneNumber?: string | null;
    promptpayId?: string | null;
    pdpaConsentAt?: Date;
  } = {};

  if (input.nickname !== undefined) {
    const cleanNickname = input.nickname ? input.nickname.trim() : '';
    if (cleanNickname && maskSensitiveData(cleanNickname).hasMaskedData) {
      throw new AppError(
        'ชื่อเล่นห้ามมีเบอร์โทรศัพท์ ไลน์ไอดี เลขบัญชี หรือช่องทางติดต่อภายนอก',
        400,
        'CONTACT_INFO_NOT_ALLOWED'
      );
    }
    updateData.nickname = cleanNickname || null;
  }

  if (input.avatar_url !== undefined) {
    updateData.avatarUrl = input.avatar_url ? input.avatar_url.trim() : null;
  }

  if (input.phone_number !== undefined) {
    const rawPhone = input.phone_number ? input.phone_number.trim() : '';
    if (!rawPhone) {
      updateData.phoneNumber = null;
    } else {
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
    if (!rawPromptPay) {
      updateData.promptpayId = null;
    } else {
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

  if (input.pdpa_consent === true) {
    updateData.pdpaConsentAt = user.pdpaConsentAt ?? new Date();
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
    ...(updated.pdpaConsentAt !== undefined ? { pdpa_consent_at: updated.pdpaConsentAt } : {}),
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

  const slipImageUrl = input.slip_image_url?.trim() || '';
  if (!slipImageUrl) {
    throw new AppError('กรุณาแนบรูปลิงก์สลิปโอนเงิน (slip_image_url)', 400, 'MISSING_SLIP_IMAGE');
  }
  if (!/^https?:\/\//i.test(slipImageUrl)) {
    throw new AppError('ลิงก์รูปสลิปโอนเงินไม่ถูกต้อง', 400, 'INVALID_SLIP_IMAGE_URL');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
  }

  let transRef = input.transRef?.trim() || '';
  let amount = input.amount;
  let senderName = input.senderName?.trim() || undefined;

  // หากมี custom verifier ให้ทำการ verify
  if (slipVerifier) {
    const verified = await slipVerifier(slipImageUrl, { log: true });
    transRef = verified.transRef;
    amount = verified.amount;
    senderName = verified.senderName;
  } else {
    if (env.NODE_ENV === 'production') {
      throw new AppError(
        'ระบบตรวจสลิปอัตโนมัติยังไม่ได้เปิดใช้งานใน Production (Missing SLIPOK_API_KEY / SLIPOK_BRANCH_ID)',
        503,
        'SLIP_VERIFIER_NOT_CONFIGURED'
      );
    }

    const requestedPackId = (input.pack_id || input.packId || '').trim().toLowerCase();
    if (requestedPackId) {
      const matchedPack = TOPUP_CREDIT_PACKAGES.find((pkg) => pkg.id === requestedPackId);
      if (!matchedPack) {
        throw new AppError(
          'แพ็กเกจเครดิตไม่ถูกต้อง (รองรับ starter, bookworm, merchant)',
          400,
          'INVALID_TOPUP_PACKAGE'
        );
      }
      if (amount !== undefined && Math.round(Number(amount)) !== matchedPack.price) {
        throw new AppError('ยอดเงินในสลิปไม่ตรงกับแพ็กเกจที่เลือก', 400, 'SLIP_AMOUNT_MISMATCH');
      }
      amount = matchedPack.price;
    }

    // โหมดเริ่มต้น (Default / Mock Verifier สำหรับ Test & Localhost Development)
    if (!transRef) {
      transRef = `TOPUP_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }
    if (amount === undefined) {
      amount = 20; // ค่าเริ่มต้นแพ็กเกจ ฿20
    }
  }

  // 1. คำนวณเครดิตตามแพ็กเกจก่อนเปิด Transaction
  const addedCredits = calculateTopupCredits(amount);
  const storagePath =
    input.storage_path?.trim() || extractStoragePathFromUrl('slips', slipImageUrl);
  const resolvedVerifiedName =
    user.verifiedName || senderName || user.displayName || 'ผู้ใช้กองดอง';

  // 2. ตรวจสอบสลิปซ้ำ (Anti-Replay) + บันทึกข้อมูลแบบ Atomic ใน Transaction
  const runInTx =
    typeof db.$transaction === 'function'
      ? (fn: (tx: any) => Promise<TopupSlipResult>) => db.$transaction(fn)
      : (fn: (tx: any) => Promise<TopupSlipResult>) => fn(db);

  return await runInTx(async (tx: any) => {
    const slipReader = tx?.paymentSlip?.findFirst
      ? tx.paymentSlip
      : db.paymentSlip;

    if (typeof slipReader?.findFirst === 'function') {
      const duplicate = await slipReader.findFirst({
        where: {
          OR: [{ transRef }, { slipImageUrl }],
        },
      });
      if (duplicate) {
        throw new AppError('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)', 400, 'DUPLICATE_SLIP');
      }
    } else if (typeof slipReader?.findUnique === 'function') {
      const duplicate = await slipReader.findUnique({
        where: { transRef },
      });
      if (duplicate) {
        throw new AppError('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)', 400, 'DUPLICATE_SLIP');
      }
    }

    // 2.1 บันทึกสลิปลง payment_slips
    try {
      await tx.paymentSlip.create({
        data: {
          userId,
          slipType: 'CREDIT_TOPUP',
          slipImageUrl,
          ...(storagePath ? { storagePath } : {}),
          transRef,
          amount,
          receiverName: 'กองดอง (GongDong)',
          verificationStatus: 'AUTO_VERIFIED',
          verifiedAt: new Date(),
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new AppError('สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (Duplicate Slip)', 400, 'DUPLICATE_SLIP');
      }
      throw error;
    }

    // 2.2 อัปเดตเครดิตและปลดล็อก is_verified_seller (ห้ามทับ verifiedName หากมีจาก KYC แล้ว)
    const userUpdateData: {
      credits: { increment: number };
      isVerifiedSeller: boolean;
      verifiedName?: string;
    } = {
      credits: { increment: addedCredits },
      isVerifiedSeller: true,
    };
    if (!user.verifiedName) {
      userUpdateData.verifiedName = resolvedVerifiedName;
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: userUpdateData,
    });

    // 2.3 บันทึกประวัติธุรกรรมเครดิต (Credit Ledger)
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
      verified_name: updatedUser.verifiedName || resolvedVerifiedName,
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
  const numericLimit = Number.isFinite(limit) ? Math.trunc(limit) : 50;
  const numericOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  const safeLimit = Math.min(Math.max(numericLimit, 1), 100);
  const safeOffset = Math.max(numericOffset, 0);

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
