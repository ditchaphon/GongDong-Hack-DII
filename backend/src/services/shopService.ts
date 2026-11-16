import crypto from 'crypto';
import { env } from '../config/env';
import { prisma as defaultPrisma } from '../config/prisma';
import { getBangkokTodayIso } from '../utils/pickupAvailability';
import { maskSensitiveData } from './dataMaskingService';
import {
  BlacklistCheckResult,
  checkIdCardWithBlacklistSeller,
  isBlacklistSellerConfigured,
} from './blacklistService';
import {
  AppError,
  MeetupPointInput,
  SellerKycInput,
  UpsertShopInput,
} from '../types';

function normalizeWhitespace(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ');
}

function isValidPersonName(raw: string): boolean {
  const clean = normalizeWhitespace(raw);
  if (clean.length < 2 || clean.length > 100) return false;
  if (!/^[\u0E00-\u0E7FA-Za-z\s.'-]+$/.test(clean)) return false;
  if (clean.replace(/[\s.'-]/g, '').length < 2) return false;
  return !maskSensitiveData(clean).hasMaskedData;
}

function sanitizeAvatarUrl(raw: string | null | undefined): string | null {
  const clean = raw?.trim() || '';
  if (!clean) return null;
  if (clean.length > 1000 || !/^(https?:\/\/|\/)/i.test(clean)) {
    throw new AppError('ลิงก์รูปโปรไฟล์ร้านไม่ถูกต้อง', 400, 'INVALID_AVATAR_URL');
  }
  return clean;
}

function sanitizeScheduleValues(values: unknown, label: string): string[] {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) {
    throw new AppError(`รูปแบบข้อมูล ${label} ไม่ถูกต้อง`, 400, 'INVALID_SCHEDULE_FORMAT');
  }
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of values) {
    if (typeof item !== 'string') continue;
    const text = normalizeWhitespace(item);
    if (!text) continue;
    if (text.length > 50 || maskSensitiveData(text).hasMaskedData) {
      throw new AppError(
        `${label} ต้องยาวไม่เกิน 50 ตัวอักษรและห้ามมีข้อมูลติดต่อภายนอก`,
        400,
        'CONTACT_INFO_NOT_ALLOWED'
      );
    }
    if (!seen.has(text)) {
      seen.add(text);
      cleaned.push(text);
    }
    if (cleaned.length >= 20) break;
  }
  return cleaned;
}

/**
 * ตรวจสอบความถูกต้องของเลขบัตรประชาชน 13 หลัก (Mod-11 Checksum)
 */
export function isValidThaiNationalId(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (!/^\d{13}$/.test(digits)) return false;
  if (digits[0] === '0') return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(digits[12]);
}

/**
 * ซ่อนเลขบัตรประชาชนให้เหลือเฉพาะ 3 หลักท้าย (x-xxxx-xxxxx-12-3)
 */
export function maskThaiNationalId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return `x-xxxx-xxxxx-${digits.slice(10, 12)}-${digits.slice(12, 13)}`;
}

/**
 * สร้าง HMAC-SHA256 Hash ของเลขบัตรประชาชน 13 หลักเพื่อตรวจซ้ำข้ามบัญชีโดยไม่เก็บเลขบัตรดิบ
 */
export function hashThaiNationalId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!isValidThaiNationalId(digits)) {
    throw new AppError('เลขบัตรประชาชน 13 หลักไม่ถูกต้อง', 400, 'INVALID_NATIONAL_ID');
  }

  const configuredPepper = env.KYC_HASH_PEPPER?.trim();
  if (!configuredPepper && env.NODE_ENV === 'production') {
    throw new AppError(
      'ระบบยังไม่ได้ตั้งค่าคีย์เข้ารหัสข้อมูลยืนยันตัวตน (Missing KYC_HASH_PEPPER)',
      503,
      'KYC_HASH_NOT_CONFIGURED'
    );
  }

  const secret = configuredPepper || 'gongdong-dev-kyc-pepper';
  return crypto.createHmac('sha256', secret).update(digits).digest('hex');
}

/**
 * ดึงข้อมูลร้านค้าส่วนตัวของผู้ขาย (GET /api/seller/shop)
 */
export async function getMyShop(userId: string, prismaClient?: any) {
  const db = prismaClient || defaultPrisma;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      shopProfile: {
        include: {
          meetupPoints: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
  }

  return {
    shop: user.shopProfile
      ? {
          id: user.shopProfile.id,
          shop_name: user.shopProfile.shopName,
          description: user.shopProfile.description,
          avatar_url: user.shopProfile.avatarUrl,
          province: user.shopProfile.province,
          available_days: user.shopProfile.availableDays,
          available_slots: user.shopProfile.availableSlots,
          supports_parcel: user.shopProfile.supportsParcel,
          ship_mode: user.shopProfile.shipMode,
          ship_within_days: user.shopProfile.shipWithinDays,
          setup_complete: user.shopProfile.setupComplete,
          meetup_points: user.shopProfile.meetupPoints.map((p: any) => ({
            id: p.id,
            name: p.name,
            province: p.province,
            lat: Number(p.lat),
            lng: Number(p.lng),
            note: p.note,
          })),
        }
      : null,
    kyc: user.kycVerifiedAt
      ? {
          first_name: user.kycFirstName,
          last_name: user.kycLastName,
          national_id_masked: user.kycNationalIdMasked,
          verified_at: user.kycVerifiedAt,
        }
      : null,
    is_verified_seller: user.isVerifiedSeller,
    credits: user.credits,
  };
}

/**
 * สร้างหรืออัปเดตโปรไฟล์ร้านค้าและตารางจัดส่ง (PUT /api/seller/shop)
 */
export async function upsertMyShop(
  userId: string,
  input: UpsertShopInput,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;

  const shopName = normalizeWhitespace(input.shopName);
  if (!shopName) {
    throw new AppError('กรุณาระบุชื่อร้านค้า', 400, 'MISSING_SHOP_NAME');
  }
  if (shopName.length < 2 || shopName.length > 120) {
    throw new AppError('ชื่อร้านค้าต้องมี 2–120 ตัวอักษร', 400, 'INVALID_SHOP_NAME');
  }
  if (maskSensitiveData(shopName).hasMaskedData) {
    throw new AppError(
      'ชื่อร้านค้าห้ามมีเบอร์โทรศัพท์ ไลน์ไอดี เลขบัญชี หรือช่องทางติดต่อภายนอก',
      400,
      'CONTACT_INFO_NOT_ALLOWED'
    );
  }

  const description = input.description?.trim() || null;
  if (description) {
    if (description.length > 1000) {
      throw new AppError('คำอธิบายร้านต้องยาวไม่เกิน 1,000 ตัวอักษร', 400, 'INVALID_SHOP_DESCRIPTION');
    }
    if (maskSensitiveData(description).hasMaskedData) {
      throw new AppError(
        'คำอธิบายร้านห้ามมีเบอร์โทรศัพท์ ไลน์ไอดี เลขบัญชี หรือช่องทางติดต่อภายนอก',
        400,
        'CONTACT_INFO_NOT_ALLOWED'
      );
    }
  }

  const avatarUrl = sanitizeAvatarUrl(input.avatarUrl);
  const province = normalizeWhitespace(input.province) || 'เชียงใหม่';
  if (province.length > 100 || maskSensitiveData(province).hasMaskedData) {
    throw new AppError('ชื่อจังหวัดไม่ถูกต้อง', 400, 'INVALID_PROVINCE');
  }

  const shipMode = input.shipMode ?? 'AFTER_ACCEPT';
  if (shipMode !== 'DAILY' && shipMode !== 'AFTER_ACCEPT') {
    throw new AppError('รูปแบบรอบจัดส่งไม่ถูกต้อง (DAILY หรือ AFTER_ACCEPT)', 400, 'INVALID_SHIP_MODE');
  }

  const rawShipDays = input.shipWithinDays !== undefined ? Number(input.shipWithinDays) : 2;
  if (!Number.isInteger(rawShipDays) || rawShipDays < 1 || rawShipDays > 14) {
    throw new AppError('จำนวนวันจัดส่งต้องเป็นจำนวนเต็มระหว่าง 1–14 วัน', 400, 'INVALID_SHIP_WITHIN_DAYS');
  }

  const availableDays = sanitizeScheduleValues(input.availableDays, 'วันที่สะดวกนัดรับ/ส่ง');
  const availableSlots = sanitizeScheduleValues(input.availableSlots, 'ช่วงเวลาที่สะดวก');

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
  }

  const shopData = {
    shopName,
    description,
    avatarUrl,
    province,
    availableDays,
    availableSlots,
    supportsParcel: Boolean(input.supportsParcel),
    shipMode,
    shipWithinDays: rawShipDays,
    setupComplete: true,
  };

  const shop = await db.shopProfile.upsert({
    where: { userId },
    update: shopData,
    create: {
      userId,
      ...shopData,
    },
    include: {
      meetupPoints: { orderBy: { createdAt: 'asc' } },
    },
  });

  return {
    id: shop.id,
    shop_name: shop.shopName,
    description: shop.description,
    avatar_url: shop.avatarUrl,
    province: shop.province,
    available_days: shop.availableDays,
    available_slots: shop.availableSlots,
    supports_parcel: shop.supportsParcel,
    ship_mode: shop.shipMode,
    ship_within_days: shop.shipWithinDays,
    setup_complete: shop.setupComplete,
    meetup_points: shop.meetupPoints.map((p: any) => ({
      id: p.id,
      name: p.name,
      province: p.province,
      lat: Number(p.lat),
      lng: Number(p.lng),
      note: p.note,
    })),
  };
}

/**
 * เพิ่มจุดนัดรับของร้านค้า (POST /api/seller/meetup-points)
 */
export async function addMeetupPoint(
  userId: string,
  input: MeetupPointInput,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;

  const name = normalizeWhitespace(input.name);
  const province = normalizeWhitespace(input.province);
  const note = input.note?.trim() || null;

  if (!name || !province || input.lat === undefined || input.lng === undefined) {
    throw new AppError('กรุณาระบุชื่อสถานที่ จังหวัด และพิกัดจุดนัดรับให้ครบถ้วน', 400, 'MISSING_REQUIRED_FIELDS');
  }

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new AppError('พิกัดละติจูด/ลองจิจูดไม่ถูกต้อง', 400, 'INVALID_COORDINATES');
  }

  if (name.length > 120 || province.length > 100 || (note && note.length > 300)) {
    throw new AppError('ชื่อจุดนัดรับ จังหวัด หรือหมายเหตุยาวเกินกำหนด', 400, 'INVALID_MEETUP_POINT');
  }

  if (
    maskSensitiveData(name).hasMaskedData ||
    maskSensitiveData(province).hasMaskedData ||
    (note && maskSensitiveData(note).hasMaskedData)
  ) {
    throw new AppError(
      'จุดนัดรับห้ามมีเบอร์โทรศัพท์ ไลน์ไอดี เลขบัญชี หรือช่องทางติดต่อภายนอก',
      400,
      'CONTACT_INFO_NOT_ALLOWED'
    );
  }

  let shop = await db.shopProfile.findUnique({ where: { userId } });
  if (!shop) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
    }
    try {
      shop = await db.shopProfile.create({
        data: {
          userId,
          shopName: user.nickname || 'ร้านค้าใหม่',
          province,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        shop = await db.shopProfile.findUnique({ where: { userId } });
      } else {
        throw error;
      }
    }
  }

  const point = await db.shopMeetupPoint.create({
    data: {
      shopProfileId: shop.id,
      name,
      province,
      lat,
      lng,
      note,
    },
  });

  return {
    id: point.id,
    name: point.name,
    province: point.province,
    lat: Number(point.lat),
    lng: Number(point.lng),
    note: point.note,
  };
}

/**
 * ลบจุดนัดรับของร้านค้า (DELETE /api/seller/meetup-points/:pointId)
 */
export async function deleteMeetupPoint(
  userId: string,
  pointId: string,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;

  const point = await db.shopMeetupPoint.findUnique({
    where: { id: pointId },
    include: { shopProfile: true },
  });

  if (!point) {
    throw new AppError('ไม่พบจุดนัดรับที่ระบุ', 404, 'MEETUP_POINT_NOT_FOUND');
  }

  if (point.shopProfile.userId !== userId) {
    throw new AppError('คุณไม่มีสิทธิ์ลบจุดนัดรับนี้', 403, 'FORBIDDEN');
  }

  await db.shopMeetupPoint.delete({ where: { id: pointId } });
  return { deleted: true, id: pointId };
}

export interface SubmitSellerKycOptions {
  blacklistChecker?: (nationalId: string) => Promise<BlacklistCheckResult>;
}

/**
 * ยืนยันตัวตนผู้ขายด้วยบัตรประชาชนและชื่อ-นามสกุลจริง (POST /api/seller/kyc)
 * เก็บเฉพาะเลขบัตรประชาชนแบบ Masked เพื่อความปลอดภัยตาม PDPA
 */
export async function submitSellerKyc(
  userId: string,
  input: SellerKycInput,
  prismaClient?: any,
  options: SubmitSellerKycOptions = {}
) {
  const db = prismaClient || defaultPrisma;

  const firstName = normalizeWhitespace(input.firstName);
  const lastName = normalizeWhitespace(input.lastName);

  if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
    throw new AppError(
      'กรุณาระบุชื่อจริงและนามสกุลให้ถูกต้อง (ตัวอักษรไทย/อังกฤษเท่านั้น ห้ามมีตัวเลขหรือช่องทางติดต่อ)',
      400,
      'INVALID_NAME'
    );
  }

  if (!input.nationalId || !isValidThaiNationalId(input.nationalId)) {
    throw new AppError('เลขบัตรประชาชน 13 หลักไม่ถูกต้อง', 400, 'INVALID_NATIONAL_ID');
  }

  const maskedId = maskThaiNationalId(input.nationalId);
  const nationalIdHash = hashThaiNationalId(input.nationalId);

  if (typeof db.user?.findUnique === 'function') {
    const hashOwner = await db.user.findUnique({
      where: { kycNationalIdHash: nationalIdHash },
      select: { id: true },
    });
    if (hashOwner && hashOwner.id !== userId) {
      throw new AppError(
        'เลขบัตรประชาชนนี้ถูกใช้ยืนยันตัวตนกับบัญชีอื่นแล้ว',
        409,
        'DUPLICATE_KYC_IDENTITY'
      );
    }
  }

  if (typeof db.user?.findMany === 'function') {
    const candidates = await db.user.findMany({
      where: {
        id: { not: userId },
        kycNationalIdMasked: maskedId,
        kycVerifiedAt: { not: null },
      },
      select: {
        id: true,
        kycFirstName: true,
        kycLastName: true,
      },
    });

    const normalizedFirst = firstName.toLowerCase();
    const normalizedLast = lastName.toLowerCase();
    const hasDuplicateIdentity = (candidates || []).some(
      (candidate: { kycFirstName?: string | null; kycLastName?: string | null }) =>
        normalizeWhitespace(candidate.kycFirstName).toLowerCase() === normalizedFirst &&
        normalizeWhitespace(candidate.kycLastName).toLowerCase() === normalizedLast
    );

    if (hasDuplicateIdentity) {
      throw new AppError(
        'ชื่อ-นามสกุลและเลขบัตรประชาชนนี้ถูกใช้ยืนยันตัวตนกับบัญชีอื่นแล้ว',
        409,
        'DUPLICATE_KYC_IDENTITY'
      );
    }
  }

  const digits = input.nationalId.replace(/\D/g, '');
  const shouldCheckBlacklist =
    Boolean(options.blacklistChecker) || isBlacklistSellerConfigured();
  if (env.NODE_ENV === 'production' && !shouldCheckBlacklist) {
    throw new AppError(
      'ระบบตรวจสอบประวัติผู้ขาย (Blacklistseller) ยังไม่ได้เปิดใช้งานใน Production (Missing BLACKLISTSELLER_API_KEY)',
      503,
      'BLACKLIST_API_NOT_CONFIGURED'
    );
  }

  if (shouldCheckBlacklist) {
    const checker =
      options.blacklistChecker ?? ((id: string) => checkIdCardWithBlacklistSeller(id));
    const blacklistResult = await checker(digits);
    if (blacklistResult.found) {
      if (typeof db.user?.update === 'function') {
        await db.user.update({
          where: { id: userId },
          data: {
            isBlacklisted: true,
            isVerifiedSeller: false,
          },
        });
      }
      throw new AppError(
        'ไม่ผ่านการตรวจสอบประวัติผู้ขาย (พบประวัติในฐานข้อมูล Blacklistseller)',
        403,
        'KYC_BLACKLISTED',
        {
          freq_count: blacklistResult.freqCount,
          total_price: blacklistResult.totalPrice,
        }
      );
    }
  }

  const now = new Date();
  let updated: any;
  try {
    updated = await db.user.update({
      where: { id: userId },
      data: {
        kycFirstName: firstName,
        kycLastName: lastName,
        kycNationalIdMasked: maskedId,
        kycNationalIdHash: nationalIdHash,
        kycVerifiedAt: now,
        verifiedName: `${firstName} ${lastName}`,
        isVerifiedSeller: true,
        isBlacklisted: false,
        ...(input.pdpaConsent === true ? { pdpaConsentAt: now } : {}),
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError(
        'เลขบัตรประชาชนนี้ถูกใช้ยืนยันตัวตนกับบัญชีอื่นแล้ว',
        409,
        'DUPLICATE_KYC_IDENTITY'
      );
    }
    throw error;
  }

  return {
    is_verified_seller: updated.isVerifiedSeller,
    kyc: {
      first_name: updated.kycFirstName,
      last_name: updated.kycLastName,
      national_id_masked: updated.kycNationalIdMasked,
      verified_at: updated.kycVerifiedAt,
    },
  };
}

/**
 * ดูหน้าร้านค้าสาธารณะ (GET /api/shops/:id) — รองรับทั้ง shopProfile.id และ user.id
 * ซ่อนข้อมูล KYC ส่วนตัว (เลขบัตร/ชื่อจริง/เบอร์โทร) ตามกฎ PDPA v4
 */
export async function getPublicShop(idOrUserId: string, prismaClient?: any) {
  const db = prismaClient || defaultPrisma;

  let user = await db.user.findUnique({
    where: { id: idOrUserId },
    include: {
      shopProfile: {
        include: { meetupPoints: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });

  if (!user) {
    const shopById = await db.shopProfile.findUnique({
      where: { id: idOrUserId },
      include: {
        user: true,
        meetupPoints: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (shopById) {
      user = { ...shopById.user, shopProfile: shopById };
    }
  }

  if (!user) {
    throw new AppError('ไม่พบร้านค้าที่ระบุ', 404, 'SHOP_NOT_FOUND');
  }

  const todayIso = getBangkokTodayIso();
  const requestCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [completedSales, reviewAgg, listings, activePickupOrders] = await Promise.all([
    db.order.count({
      where: { sellerId: user.id, status: 'COMPLETED' },
    }),
    db.review.aggregate({
      where: { revieweeId: user.id },
      _avg: { rating: true },
      _count: { id: true },
    }),
    db.bookListing.findMany({
      where: { sellerId: user.id, status: 'AVAILABLE' },
      orderBy: { createdAt: 'desc' },
      include: {
        bookCatalog: true,
        images: { orderBy: [{ isCover: 'desc' }, { displayOrder: 'asc' }], take: 1 },
      },
    }),
    typeof db.order?.findMany === 'function'
      ? db.order.findMany({
          where: {
            sellerId: user.id,
            shippingMethod: 'PICKUP',
            scheduleDateIso: { gte: todayIso },
            scheduleTimeLabel: { not: null },
            OR: [
              { status: { in: ['ACCEPTED', 'SCHEDULED'] } },
              { status: 'REQUESTED', createdAt: { gt: requestCutoff } },
            ],
          },
          select: {
            scheduleDateIso: true,
            scheduleTimeLabel: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const bookedPickupSlots = Array.isArray(activePickupOrders)
    ? activePickupOrders
        .filter((o: any) => o?.scheduleDateIso && o?.scheduleTimeLabel)
        .map((o: any) => ({
          date_iso: String(o.scheduleDateIso),
          time_label: String(o.scheduleTimeLabel),
        }))
    : [];

  const shop = user.shopProfile;
  const totalReviews = reviewAgg._count?.id ?? 0;

  return {
    id: shop?.id ?? user.id,
    seller_id: user.id,
    shop_name: shop?.shopName || user.nickname || 'ร้านค้ากองดอง',
    description: shop?.description ?? null,
    avatar_url: shop?.avatarUrl || (!shop ? user.avatarUrl : null) || null,
    province: shop?.province || 'เชียงใหม่',
    payee_verified: user.isVerifiedSeller,
    rating:
      totalReviews > 0 && reviewAgg._avg?.rating
        ? Math.round(reviewAgg._avg.rating * 10) / 10
        : 0,
    total_reviews: totalReviews,
    completed_sales: completedSales,
    member_since: user.createdAt,
    supports_parcel: shop?.supportsParcel ?? false,
    ship_mode: shop?.shipMode ?? 'AFTER_ACCEPT',
    ship_within_days: shop?.shipWithinDays ?? 2,
    available_days: shop?.availableDays ?? [],
    available_slots: shop?.availableSlots ?? [],
    booked_pickup_slots: bookedPickupSlots,
    meetup_points: (shop?.meetupPoints ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      province: p.province,
      lat: Number(p.lat),
      lng: Number(p.lng),
      note: p.note,
    })),
    listings: listings.map((item: any) => ({
      id: item.id,
      title: item.bookCatalog.title,
      author: item.bookCatalog.author,
      price: Number(item.price),
      grade: item.grade,
      is_set: item.isSet,
      cover_image_url: item.images[0]?.imageUrl || item.bookCatalog.coverUrl || '',
    })),
  };
}
