import { prisma as defaultPrisma } from '../config/prisma';
import {
  AppError,
  MeetupPointInput,
  SellerKycInput,
  UpsertShopInput,
} from '../types';

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

  if (!input.shopName || !input.shopName.trim()) {
    throw new AppError('กรุณาระบุชื่อร้านค้า', 400, 'MISSING_SHOP_NAME');
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
  }

  const shop = await db.shopProfile.upsert({
    where: { userId },
    update: {
      shopName: input.shopName.trim(),
      description: input.description?.trim() ?? null,
      avatarUrl: input.avatarUrl ?? null,
      province: input.province || 'เชียงใหม่',
      availableDays: input.availableDays ?? [],
      availableSlots: input.availableSlots ?? [],
      supportsParcel: Boolean(input.supportsParcel),
      shipMode: input.shipMode || 'AFTER_ACCEPT',
      shipWithinDays: input.shipWithinDays ?? 2,
      setupComplete: true,
    },
    create: {
      userId,
      shopName: input.shopName.trim(),
      description: input.description?.trim() ?? null,
      avatarUrl: input.avatarUrl ?? null,
      province: input.province || 'เชียงใหม่',
      availableDays: input.availableDays ?? [],
      availableSlots: input.availableSlots ?? [],
      supportsParcel: Boolean(input.supportsParcel),
      shipMode: input.shipMode || 'AFTER_ACCEPT',
      shipWithinDays: input.shipWithinDays ?? 2,
      setupComplete: true,
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

  if (!input.name || !input.province || input.lat === undefined || input.lng === undefined) {
    throw new AppError('กรุณาระบุชื่อสถานที่ จังหวัด และพิกัดจุดนัดรับให้ครบถ้วน', 400, 'MISSING_REQUIRED_FIELDS');
  }

  let shop = await db.shopProfile.findUnique({ where: { userId } });
  if (!shop) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
    }
    shop = await db.shopProfile.create({
      data: {
        userId,
        shopName: user.nickname || user.displayName,
        province: input.province,
      },
    });
  }

  const point = await db.shopMeetupPoint.create({
    data: {
      shopProfileId: shop.id,
      name: input.name.trim(),
      province: input.province.trim(),
      lat: input.lat,
      lng: input.lng,
      note: input.note?.trim() ?? null,
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

/**
 * ยืนยันตัวตนผู้ขายด้วยบัตรประชาชนและชื่อ-นามสกุลจริง (POST /api/seller/kyc)
 * เก็บเฉพาะเลขบัตรประชาชนแบบ Masked เพื่อความปลอดภัยตาม PDPA
 */
export async function submitSellerKyc(
  userId: string,
  input: SellerKycInput,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;

  const firstName = input.firstName?.trim() ?? '';
  const lastName = input.lastName?.trim() ?? '';

  if (firstName.length < 2 || lastName.length < 2) {
    throw new AppError('กรุณาระบุชื่อจริงและนามสกุลให้ครบถ้วน', 400, 'INVALID_NAME');
  }

  if (!input.nationalId || !isValidThaiNationalId(input.nationalId)) {
    throw new AppError('เลขบัตรประชาชน 13 หลักไม่ถูกต้อง', 400, 'INVALID_NATIONAL_ID');
  }

  const maskedId = maskThaiNationalId(input.nationalId);
  const now = new Date();

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      kycFirstName: firstName,
      kycLastName: lastName,
      kycNationalIdMasked: maskedId,
      kycVerifiedAt: now,
      verifiedName: `${firstName} ${lastName}`,
      isVerifiedSeller: true,
    },
  });

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

  const [completedSales, reviewAgg, listings] = await Promise.all([
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
  ]);

  const shop = user.shopProfile;

  return {
    id: shop?.id ?? user.id,
    seller_id: user.id,
    shop_name: shop?.shopName || user.nickname || 'ร้านค้ากองดอง',
    description: shop?.description ?? null,
    avatar_url: shop?.avatarUrl || user.avatarUrl || null,
    province: shop?.province || 'เชียงใหม่',
    payee_verified: user.isVerifiedSeller,
    rating: reviewAgg._avg?.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 5.0,
    total_reviews: reviewAgg._count?.id ?? 0,
    completed_sales: completedSales,
    member_since: user.createdAt,
    supports_parcel: shop?.supportsParcel ?? false,
    ship_mode: shop?.shipMode ?? 'AFTER_ACCEPT',
    ship_within_days: shop?.shipWithinDays ?? 2,
    available_days: shop?.availableDays ?? [],
    available_slots: shop?.availableSlots ?? [],
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
