import { SupabaseClient } from '@supabase/supabase-js';
import { prisma as defaultPrisma } from '../config/prisma';
import { maskSensitiveData } from './dataMaskingService';
import { calculateBookGrade } from './gradingService';
import { sanitizeIsbn } from './googleBooksService';
import { removeUnreferencedStorageUrls } from './uploadService';
import {
  AppError,
  BookGrade,
  BookListingDetail,
  BookListingFilter,
  BookListingItem,
  BookImageType,
  CreateBookListingInput,
  UpdateBookListingInput,
  UserBookListingItem,
} from '../types';

const BASE_MANDATORY_IMAGE_TYPES: BookImageType[] = [
  'FRONT_COVER',
  'BACK_COVER',
  'SPINE',
];

function findMissingMandatoryAngles(presentTypes: Set<BookImageType>): string[] {
  const missing: string[] = BASE_MANDATORY_IMAGE_TYPES.filter(
    (type) => !presentTypes.has(type)
  );
  // รองรับทั้ง INNER (สเปก v4) และ EDGE (สเปกเดิม) สำหรับมุมที่ 4
  if (!presentTypes.has('INNER') && !presentTypes.has('EDGE')) {
    missing.push('INNER/EDGE');
  }
  return missing;
}

function mapSellerSummary(seller: any) {
  return {
    id: seller.id,
    nickname: seller.nickname || 'ร้านค้ากองดอง',
    shopName: seller.shopProfile?.shopName ?? null,
    avatarUrl: seller.avatarUrl ?? null,
    isVerifiedSeller: Boolean(seller.isVerifiedSeller),
  };
}

interface CatalogSnapshot {
  title?: string | null;
  author?: string | null;
  publisher?: string | null;
  originalPrice?: number | null;
}

function extractCatalogSnapshot(photoChecks: any): {
  snapshot: CatalogSnapshot | null;
  cleanPhotoChecks: Record<string, any>;
} {
  if (!photoChecks || typeof photoChecks !== 'object' || Array.isArray(photoChecks)) {
    return { snapshot: null, cleanPhotoChecks: {} };
  }
  const { _catalogSnapshot, ...rest } = photoChecks as Record<string, any>;
  if (_catalogSnapshot && typeof _catalogSnapshot === 'object') {
    return {
      snapshot: _catalogSnapshot as CatalogSnapshot,
      cleanPhotoChecks: rest,
    };
  }
  return { snapshot: null, cleanPhotoChecks: rest };
}

function mapBookFeedItem(item: any): BookListingItem {
  const { snapshot } = extractCatalogSnapshot(item.photoChecks);
  const categories =
    Array.isArray(item.categories) && item.categories.length > 0
      ? item.categories
      : item.category
      ? [item.category]
      : [];

  const resolvedTitle = snapshot?.title?.trim() || item.bookCatalog.title;
  const resolvedAuthor = snapshot?.author?.trim() || item.bookCatalog.author;
  const resolvedOriginalPrice =
    snapshot?.originalPrice !== null &&
    snapshot?.originalPrice !== undefined &&
    Number(snapshot.originalPrice) > 0
      ? Number(snapshot.originalPrice)
      : item.bookCatalog.originalPrice !== null
      ? Number(item.bookCatalog.originalPrice)
      : null;

  return {
    id: item.id,
    title: resolvedTitle,
    author: resolvedAuthor,
    category: item.category,
    categories,
    isSet: Boolean(item.isSet),
    totalVolumes: item.totalVolumes ?? null,
    missingVolumes:
      Boolean(item.isSet) && Array.isArray(item.missingVolumes)
        ? item.missingVolumes
        : [],
    coverImageUrl: item.images[0]?.imageUrl || item.bookCatalog.coverUrl || '',
    price: Number(item.price),
    originalPrice: resolvedOriginalPrice,
    grade: item.grade as BookGrade,
    allowPickup: Boolean(item.allowPickup),
    pickupLocationName: item.pickupLocationName ?? null,
    allowDelivery: Boolean(item.allowDelivery),
    codEnabled: item.codEnabled ?? true,
    seller: mapSellerSummary(item.seller),
  };
}

const FEED_BOOK_SELECT = {
  id: true,
  category: true,
  categories: true,
  isSet: true,
  totalVolumes: true,
  missingVolumes: true,
  price: true,
  grade: true,
  allowPickup: true,
  pickupLocationName: true,
  allowDelivery: true,
  codEnabled: true,
  photoChecks: true,
  bookCatalog: {
    select: {
      title: true,
      author: true,
      coverUrl: true,
      originalPrice: true,
    },
  },
  seller: {
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      isVerifiedSeller: true,
      shopProfile: {
        select: { shopName: true },
      },
    },
  },
  images: {
    orderBy: [{ isCover: 'desc' as const }, { displayOrder: 'asc' as const }],
    take: 1,
    select: {
      imageUrl: true,
    },
  },
};

/**
 * Service ค้นหาและดึงฟีดหนังสือในตลาด (GET /api/books)
 */
export async function getBookListings(
  filter: BookListingFilter,
  prismaClient?: any
): Promise<{ books: BookListingItem[]; total: number }> {
  const db = prismaClient || defaultPrisma;

  const limit = Math.max(1, Math.min(filter.limit || 20, 100));
  const offset = Math.max(0, filter.offset || 0);

  const andConditions: any[] = [{ status: 'AVAILABLE' }];

  if (filter.category) {
    andConditions.push({
      OR: [
        { category: filter.category },
        { categories: { has: filter.category } },
      ],
    });
  }

  if (filter.grade) {
    andConditions.push({ grade: filter.grade });
  }

  if (filter.shipping === 'PICKUP') {
    andConditions.push({ allowPickup: true });
  } else if (filter.shipping === 'DELIVERY') {
    andConditions.push({ allowDelivery: true });
  }

  if (filter.q && filter.q.trim() !== '') {
    const query = filter.q.trim();
    andConditions.push({
      OR: [
        { isbn: { contains: query } },
        { bookCatalog: { title: { contains: query, mode: 'insensitive' } } },
        { bookCatalog: { author: { contains: query, mode: 'insensitive' } } },
      ],
    });
  }

  const where = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

  const listings = await db.bookListing.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: FEED_BOOK_SELECT,
  });

  // Skip COUNT(*) query when the first page already contains all matching listings.
  const total =
    offset === 0 && listings.length < limit
      ? listings.length
      : await db.bookListing.count({ where });

  return {
    books: listings.map(mapBookFeedItem),
    total,
  };
}

/**
 * ดึงรายการหนังสือแนะนำบนหน้าแรก (GET /api/books/recommended)
 */
export async function getRecommendedBooks(
  limit = 8,
  prismaClient?: any
): Promise<{ books: BookListingItem[] }> {
  const db = prismaClient || defaultPrisma;
  const safeLimit = Math.max(1, Math.min(limit, 24));

  const listings = await db.bookListing.findMany({
    where: { status: 'AVAILABLE' },
    take: safeLimit,
    orderBy: [{ seller: { isVerifiedSeller: 'desc' } }, { createdAt: 'desc' }],
    select: FEED_BOOK_SELECT,
  });

  return { books: listings.map(mapBookFeedItem) };
}

async function getSellerListingCapability(
  db: any,
  sellerId: string
): Promise<{ canParcel: boolean }> {
  if (!db?.user?.findUnique) return { canParcel: true };
  const seller = await db.user.findUnique({
    where: { id: sellerId },
    select: {
      isVerifiedSeller: true,
      isBlacklisted: true,
      shopProfile: { select: { supportsParcel: true } },
    },
  });
  if (!seller) {
    throw new AppError('ไม่พบบัญชีผู้ขาย', 404, 'SELLER_NOT_FOUND');
  }
  if (seller.isBlacklisted) {
    throw new AppError(
      'บัญชีของคุณถูกระงับสิทธิ์การขายชั่วคราวเนื่องจากพบประวัติในฐานข้อมูล Blacklistseller',
      403,
      'ACCOUNT_BLACKLISTED'
    );
  }
  return {
    canParcel: Boolean(seller.isVerifiedSeller && seller.shopProfile?.supportsParcel),
  };
}

function assertNoListingContactLeak(value: string | null | undefined, fieldLabel: string): void {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  if (maskSensitiveData(trimmed).hasMaskedData) {
    throw new AppError(
      `${fieldLabel}ห้ามมีเบอร์โทรศัพท์ ไลน์ไอดี เลขบัญชี หรือช่องทางติดต่อภายนอก`,
      400,
      'CONTACT_INFO_NOT_ALLOWED'
    );
  }
}

/**
 * Service ดูรายละเอียดหนังสือรายเล่ม (GET /api/books/:id)
 * ส่งข้อมูลร้านค้าแบบซ่อนเบอร์โทรศัพท์และชื่อ LINE ตามกฎ PDPA
 */
export async function getBookListingDetail(
  id: string,
  prismaClient?: any
): Promise<BookListingDetail> {
  const db = prismaClient || defaultPrisma;

  const item = await db.bookListing.findUnique({
    where: { id },
    include: {
      bookCatalog: true,
      seller: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          isVerifiedSeller: true,
          shopProfile: {
            select: { shopName: true },
          },
        },
      },
      images: {
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!item || item.status === 'HIDDEN') {
    throw new AppError('ไม่พบหนังสือที่ระบุ', 404, 'BOOK_NOT_FOUND');
  }

  const { snapshot, cleanPhotoChecks } = extractCatalogSnapshot(item.photoChecks);
  const categories =
    Array.isArray(item.categories) && item.categories.length > 0
      ? item.categories
      : item.category
      ? [item.category]
      : [];

  const resolvedTitle = snapshot?.title?.trim() || item.bookCatalog.title;
  const resolvedAuthor = snapshot?.author?.trim() || item.bookCatalog.author;
  const resolvedPublisher = snapshot?.publisher?.trim() || item.bookCatalog.publisher;
  const resolvedOriginalPrice =
    snapshot?.originalPrice !== null &&
    snapshot?.originalPrice !== undefined &&
    Number(snapshot.originalPrice) > 0
      ? Number(snapshot.originalPrice)
      : item.bookCatalog.originalPrice !== null
      ? Number(item.bookCatalog.originalPrice)
      : null;

  return {
    id: item.id,
    isbn: item.isbn,
    title: resolvedTitle,
    author: resolvedAuthor,
    publisher: resolvedPublisher,
    category: item.category,
    categories,
    isSet: Boolean(item.isSet),
    totalVolumes: item.totalVolumes ?? null,
    missingVolumes: Array.isArray(item.missingVolumes) ? item.missingVolumes : [],
    description: item.description ?? null,
    defects: item.defects ?? [],
    photoChecks: cleanPhotoChecks,
    originalPrice: resolvedOriginalPrice,
    price: Number(item.price),
    grade: item.grade as BookGrade,
    conditionAnswers: item.conditionAnswers,
    images: item.images.map((img: any) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      imageType: img.imageType,
      displayOrder: img.displayOrder,
      isCover: img.isCover,
    })),
    allowPickup: Boolean(item.allowPickup),
    pickupLat: item.pickupLat !== null ? Number(item.pickupLat) : null,
    pickupLng: item.pickupLng !== null ? Number(item.pickupLng) : null,
    pickupLocationName: item.pickupLocationName ?? null,
    allowDelivery: Boolean(item.allowDelivery),
    codEnabled: item.codEnabled ?? true,
    status: item.status,
    seller: mapSellerSummary(item.seller),
  };
}

/**
 * Service ลงขายหนังสือเล่มใหม่ (POST /api/books)
 * ตรวจรูปถ่ายบังคับ 4 มุม, คำนวณเกรดอัตโนมัติบน Server, และบันทึกลง Database
 */
export async function createBookListing(
  sellerId: string,
  input: CreateBookListingInput,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;

  if (typeof input.title !== 'string' || !input.title.trim()) {
    throw new AppError('กรุณาระบุชื่อหนังสือ', 400, 'INVALID_TITLE');
  }

  assertNoListingContactLeak(input.description, 'รายละเอียดหนังสือ');
  assertNoListingContactLeak(input.pickupLocationName, 'ชื่อจุดนัดรับ');

  // 1. ตรวจสอบรูปภาพ 4 มุมบังคับ
  if (!input.images || !Array.isArray(input.images)) {
    throw new AppError('กรุณาแนบรูปภาพถ่ายหนังสือ', 400, 'MISSING_IMAGES');
  }

  if (
    input.images.some(
      (img) =>
        typeof img?.imageUrl !== 'string' ||
        !/^https?:\/\//i.test(img.imageUrl.trim())
    )
  ) {
    throw new AppError('URL รูปภาพไม่ถูกต้อง', 400, 'INVALID_IMAGE_URL');
  }

  const imageTypesPresent = new Set(input.images.map((img) => img.imageType));
  const missingTypes = findMissingMandatoryAngles(imageTypesPresent);

  if (missingTypes.length > 0) {
    throw new AppError(
      `กรุณาถ่ายรูปให้ครบทั้ง 4 มุมบังคับ (ขาด: ${missingTypes.join(', ')})`,
      400,
      'INVALID_IMAGE_TYPES'
    );
  }

  // 2. ตรวจสอบราคาขายและคำตอบสภาพหนังสือ
  if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price <= 0) {
    throw new AppError('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ (มากกว่า 0 บาท)', 400, 'INVALID_PRICE');
  }

  if (!input.conditionAnswers || typeof input.conditionAnswers !== 'object') {
    throw new AppError('กรุณาระบุข้อมูลสภาพหนังสือ', 400, 'INVALID_CONDITION_ANSWERS');
  }

  let normalizedTotalVolumes: number | null = null;
  let normalizedMissingVolumes: number[] = [];
  if (input.isSet) {
    const total = Number(input.totalVolumes);
    if (!Number.isInteger(total) || total < 2 || total > 99) {
      throw new AppError(
        'การขายยกชุดต้องระบุจำนวนเล่มทั้งหมดตั้งแต่ 2 ถึง 99 เล่ม',
        400,
        'INVALID_SET_VOLUMES'
      );
    }
    const rawMissing = Array.isArray(input.missingVolumes) ? input.missingVolumes : [];
    const uniqueMissing = Array.from(
      new Set(
        rawMissing
          .map((v) => Number(v))
          .filter((v) => Number.isInteger(v) && v >= 1 && v <= total)
      )
    ).sort((a, b) => a - b);
    const actualCount = total - uniqueMissing.length;
    if (actualCount < 2) {
      throw new AppError(
        'การขายยกชุดต้องมีหนังสือที่ขายจริงอย่างน้อย 2 เล่ม',
        400,
        'INVALID_SET_VOLUMES'
      );
    }
    normalizedTotalVolumes = total;
    normalizedMissingVolumes = uniqueMissing;
  }

  // 3. ตรวจสอบสิทธิ์บัญชีดำ สิทธิ์ส่งพัสดุ และช่องทางการส่งมอบ
  const { canParcel } = await getSellerListingCapability(db, sellerId);
  const allowPickup = input.allowPickup ?? true;
  const allowDelivery = input.allowDelivery ?? canParcel;

  if (!allowPickup && !allowDelivery) {
    throw new AppError(
      'กรุณาเลือกช่องทางการส่งมอบอย่างน้อย 1 วิธี (นัดรับ หรือ ส่งพัสดุ)',
      400,
      'DELIVERY_METHOD_REQUIRED'
    );
  }

  if (allowDelivery && !canParcel) {
    throw new AppError(
      'ร้านค้าต้องยืนยันตัวตนและเปิดรับส่งพัสดุในตั้งค่าร้านก่อน จึงจะลงขายแบบส่งพัสดุได้',
      403,
      'PARCEL_NOT_ALLOWED'
    );
  }

  // 4. คำนวณเกรดอัตโนมัติบน Server
  const originalPriceForGrading =
    input.originalPrice && input.originalPrice > 0
      ? input.originalPrice
      : input.price;
  const gradingResult = calculateBookGrade(
    input.conditionAnswers,
    originalPriceForGrading
  );

  const verifiedGrade = gradingResult.grade;
  const cleanIsbn = sanitizeIsbn(input.isbn);
  const cleanTitle = input.title.trim();
  const categories =
    Array.isArray(input.categories) && input.categories.length > 0
      ? input.categories
      : input.category
      ? [input.category]
      : ['ทั่วไป / ไลฟ์สไตล์'];
  const primaryCategory = input.category || categories[0];

  // 5. บันทึกข้อมูลลงฐานข้อมูลแบบ Transaction (เติมเต็มฟิลด์ที่เป็น null ในแคตตาล็อกกลางโดยไม่ทับข้อมูลที่มีอยู่แล้ว)
  return await db.$transaction(async (tx: any) => {
    const frontCoverUrl =
      input.coverUrl ||
      input.images.find((img) => img.isCover || img.imageType === 'FRONT_COVER')
        ?.imageUrl ||
      null;

    const existingCatalog =
      typeof tx.bookCatalog?.findUnique === 'function'
        ? await tx.bookCatalog.findUnique({ where: { isbn: cleanIsbn } })
        : null;

    const catalogUpdate: Record<string, any> = {};
    if (existingCatalog) {
      if (!existingCatalog.title?.trim() && cleanTitle) {
        catalogUpdate.title = cleanTitle;
      }
      if (!existingCatalog.author?.trim() && input.author?.trim()) {
        catalogUpdate.author = input.author.trim();
      }
      if (!existingCatalog.publisher?.trim() && input.publisher?.trim()) {
        catalogUpdate.publisher = input.publisher.trim();
      }
      if (!existingCatalog.category?.trim() && primaryCategory) {
        catalogUpdate.category = primaryCategory;
      }
      if (!existingCatalog.coverUrl?.trim() && frontCoverUrl) {
        catalogUpdate.coverUrl = frontCoverUrl;
      }
      if (
        (existingCatalog.originalPrice === null ||
          existingCatalog.originalPrice === undefined ||
          Number(existingCatalog.originalPrice) <= 0) &&
        input.originalPrice !== null &&
        input.originalPrice !== undefined &&
        Number(input.originalPrice) > 0
      ) {
        catalogUpdate.originalPrice = input.originalPrice;
      }
    }

    const catalog = await tx.bookCatalog.upsert({
      where: { isbn: cleanIsbn },
      update: catalogUpdate,
      create: {
        isbn: cleanIsbn,
        title: cleanTitle,
        author: input.author || null,
        publisher: input.publisher || null,
        category: primaryCategory,
        coverUrl: frontCoverUrl,
        originalPrice: input.originalPrice ?? null,
      },
    });

    const basePhotoChecks =
      input.photoChecks &&
      typeof input.photoChecks === 'object' &&
      !Array.isArray(input.photoChecks)
        ? { ...(input.photoChecks as Record<string, any>) }
        : {};
    const photoChecksWithSnapshot = {
      ...basePhotoChecks,
      _catalogSnapshot: {
        title: cleanTitle,
        author: input.author?.trim() || null,
        publisher: input.publisher?.trim() || null,
        originalPrice:
          input.originalPrice !== null &&
          input.originalPrice !== undefined &&
          Number(input.originalPrice) > 0
            ? Number(input.originalPrice)
            : null,
      },
    };

    const listing = await tx.bookListing.create({
      data: {
        isbn: cleanIsbn,
        sellerId,
        price: input.price,
        conditionAnswers: input.conditionAnswers as any,
        grade: verifiedGrade,
        category: primaryCategory,
        categories,
        description: input.description ?? null,
        isSet: Boolean(input.isSet),
        totalVolumes: input.isSet ? normalizedTotalVolumes : null,
        missingVolumes: input.isSet ? normalizedMissingVolumes : [],
        defects: (input.defects ?? []) as any,
        photoChecks: photoChecksWithSnapshot as any,
        allowPickup,
        pickupLat: input.pickupLat ?? null,
        pickupLng: input.pickupLng ?? null,
        pickupLocationName: input.pickupLocationName ?? null,
        allowDelivery,
        codEnabled: input.codEnabled ?? true,
        status: 'AVAILABLE',
      },
    });

    await tx.bookListingImage.createMany({
      data: input.images.map((img) => ({
        bookListingId: listing.id,
        imageUrl: img.imageUrl,
        imageType: img.imageType,
        displayOrder: img.displayOrder,
        isCover: img.isCover ?? img.imageType === 'FRONT_COVER',
      })),
    });

    return {
      id: listing.id,
      title: catalog?.title || cleanTitle,
      category: listing.category,
      categories: listing.categories ?? categories,
      isSet: Boolean(listing.isSet),
      grade: verifiedGrade,
      price: Number(listing.price),
      recommendedPrice: gradingResult.recommendedPrice,
      status: listing.status,
      createdAt: listing.createdAt,
    };
  });
}

/**
 * Service แก้ไขข้อมูลประกาศหนังสือหรือซ่อนประกาศ (PATCH /api/books/:id)
 */
export async function updateBookListing(
  id: string,
  sellerId: string,
  input: UpdateBookListingInput,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;

  const listing = await db.bookListing.findUnique({ where: { id } });
  if (!listing) {
    throw new AppError('ไม่พบหนังสือที่ระบุ', 404, 'BOOK_NOT_FOUND');
  }

  if (listing.sellerId !== sellerId) {
    throw new AppError('คุณไม่มีสิทธิ์แก้ไขรายการนี้', 403, 'FORBIDDEN');
  }

  if (listing.status === 'RESERVED' || listing.status === 'SOLD') {
    throw new AppError(
      'ไม่สามารถแก้ไขหนังสือที่ติดจองหรือขายแล้วได้',
      400,
      'CANNOT_EDIT_ACTIVE_BOOK'
    );
  }

  if (
    input.price !== undefined &&
    (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price <= 0)
  ) {
    throw new AppError('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ (มากกว่า 0 บาท)', 400, 'INVALID_PRICE');
  }

  if (input.allowPickup !== undefined || input.allowDelivery !== undefined) {
    const nextAllowPickup = input.allowPickup ?? Boolean(listing.allowPickup ?? true);
    const nextAllowDelivery = input.allowDelivery ?? Boolean(listing.allowDelivery ?? false);
    if (!nextAllowPickup && !nextAllowDelivery) {
      throw new AppError(
        'กรุณาเปิดรับการส่งมอบอย่างน้อย 1 ช่องทาง (นัดรับ หรือ ส่งพัสดุ)',
        400,
        'DELIVERY_METHOD_REQUIRED'
      );
    }
  }

  assertNoListingContactLeak(input.description, 'รายละเอียดหนังสือ');
  assertNoListingContactLeak(input.pickupLocationName, 'ชื่อจุดนัดรับ');

  const { canParcel } = await getSellerListingCapability(db, sellerId);
  if (input.allowDelivery === true && !canParcel) {
    throw new AppError(
      'ร้านค้าต้องยืนยันตัวตนและเปิดรับส่งพัสดุในตั้งค่าร้านก่อน จึงจะเปิดส่งพัสดุได้',
      403,
      'PARCEL_NOT_ALLOWED'
    );
  }

  const updateData: any = {};
  if (input.price !== undefined) updateData.price = input.price;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.categories !== undefined) {
    updateData.categories = input.categories;
    if (input.categories.length > 0) {
      updateData.category = input.categories[0];
    }
  }
  if (input.allowPickup !== undefined) updateData.allowPickup = input.allowPickup;
  if (input.allowDelivery !== undefined) updateData.allowDelivery = input.allowDelivery;
  if (input.codEnabled !== undefined) updateData.codEnabled = input.codEnabled;
  if (input.pickupLat !== undefined) updateData.pickupLat = input.pickupLat;
  if (input.pickupLng !== undefined) updateData.pickupLng = input.pickupLng;
  if (input.pickupLocationName !== undefined) {
    updateData.pickupLocationName = input.pickupLocationName;
  }
  if (input.status !== undefined) {
    if (input.status !== 'AVAILABLE' && input.status !== 'HIDDEN') {
      throw new AppError('สถานะต้องเป็น AVAILABLE หรือ HIDDEN เท่านั้น', 400, 'INVALID_STATUS');
    }
    updateData.status = input.status;
  }

  const updated = await db.bookListing.update({
    where: { id },
    data: updateData,
  });

  return {
    id: updated.id,
    price: Number(updated.price),
    description: updated.description ?? null,
    categories: updated.categories ?? [],
    status: updated.status,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Service ดึงรายการหนังสือของผู้ขายสำหรับหน้า S4 ร้านของฉัน
 */
export async function getUserBookListings(
  sellerId: string,
  prismaClient?: any
): Promise<{ books: UserBookListingItem[] }> {
  const db = prismaClient || defaultPrisma;

  const listings = await db.bookListing.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    include: {
      bookCatalog: true,
      images: {
        orderBy: [{ isCover: 'desc' }, { displayOrder: 'asc' }],
        take: 1,
      },
      _count: {
        select: { orderItems: true },
      },
    },
  });

  const books: UserBookListingItem[] = listings.map((item: any) => ({
    id: item.id,
    title: item.bookCatalog.title,
    description: item.description ?? null,
    category: item.category,
    categories:
      Array.isArray(item.categories) && item.categories.length > 0
        ? item.categories
        : [item.category],
    isSet: Boolean(item.isSet),
    totalVolumes: item.totalVolumes ?? null,
    missingVolumes:
      Boolean(item.isSet) && Array.isArray(item.missingVolumes)
        ? item.missingVolumes
        : [],
    price: Number(item.price),
    grade: item.grade as BookGrade,
    coverImageUrl: item.images[0]?.imageUrl || item.bookCatalog.coverUrl || '',
    allowPickup: Boolean(item.allowPickup ?? true),
    allowDelivery: Boolean(item.allowDelivery ?? false),
    codEnabled: Boolean(item.codEnabled ?? true),
    status: item.status,
    hasOrders: Boolean((item._count?.orderItems ?? 0) > 0),
    createdAt: item.createdAt,
  }));

  return { books };
}

/**
 * Service ลบประกาศขายหนังสือ (DELETE /api/books/:id)
 * อนุญาตให้ลบได้เฉพาะเจ้าของ และสถานะต้องเป็น AVAILABLE หรือ HIDDEN
 */
export async function deleteBookListing(
  id: string,
  sellerId: string,
  prismaClient?: any,
  supabaseClientOverride?: SupabaseClient | null
): Promise<{ success: boolean; message: string }> {
  const db = prismaClient || defaultPrisma;

  const listing = await db.bookListing.findUnique({
    where: { id },
    include: {
      images: {
        select: { imageUrl: true },
      },
    },
  });

  if (!listing) {
    throw new AppError('ไม่พบหนังสือที่ระบุ', 404, 'BOOK_NOT_FOUND');
  }

  if (listing.sellerId !== sellerId) {
    throw new AppError('คุณไม่มีสิทธิ์ลบรายการนี้', 403, 'FORBIDDEN');
  }

  if (listing.status !== 'AVAILABLE' && listing.status !== 'HIDDEN') {
    throw new AppError(
      'ไม่สามารถลบหนังสือที่ติดจองหรือขายสำเร็จแล้วได้',
      400,
      'CANNOT_DELETE_ACTIVE_BOOK'
    );
  }

  const existingOrderItems: Array<{ order?: { status?: string } }> = Array.isArray(
    listing.orderItems
  )
    ? listing.orderItems
    : typeof db.orderItem?.findMany === 'function'
    ? await db.orderItem.findMany({
        where: { bookListingId: id },
        select: { order: { select: { status: true } } },
        take: 10,
      })
    : [];

  if (existingOrderItems.length > 0) {
    const activeOrderStatuses = new Set([
      'REQUESTED',
      'ACCEPTED',
      'SCHEDULED',
      'PAID',
      'SHIPPED',
      'COMPLETED',
      'DISPUTED',
    ]);
    const hasActiveOrCompletedOrder = existingOrderItems.some((item) =>
      activeOrderStatuses.has(String(item.order?.status || '').toUpperCase())
    );
    if (hasActiveOrCompletedOrder) {
      throw new AppError(
        'ไม่สามารถลบหนังสือที่มีคำสั่งซื้อแล้วได้',
        400,
        'CANNOT_DELETE_ORDERED_BOOK'
      );
    }
    throw new AppError(
      'หนังสือเล่มนี้เคยมีประวัติคำสั่งซื้อแล้ว จึงไม่สามารถลบถาวรได้ กรุณาใช้ปุ่ม "ซ่อน" แทน',
      400,
      'CANNOT_DELETE_BOOK_WITH_ORDER_HISTORY'
    );
  }

  const candidateUrls: Array<string | null | undefined> = [
    ...(Array.isArray(listing.images) ? listing.images.map((img: any) => img?.imageUrl) : []),
    ...(Array.isArray(listing.defects)
      ? listing.defects.map((defect: any) => defect?.photo)
      : []),
  ];

  await db.bookListing.delete({
    where: { id },
  });

  if (candidateUrls.some(Boolean)) {
    await removeUnreferencedStorageUrls(candidateUrls, {
      expectedBucket: 'book-listings',
      ownerUserId: sellerId,
      prismaClient: db,
      supabaseClientOverride,
    });
  }

  return {
    success: true,
    message: 'ลบรายการหนังสือสำเร็จ',
  };
}

export interface PreviousListingCandidate {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  publisher: string | null;
  category: string | null;
  categories: string[];
  description: string | null;
  original_price: number | null;
  selling_price: number;
  cover_image_url: string | null;
  seller_name: string;
  is_set: boolean;
  total_volumes: number | null;
  created_at: Date;
}

/**
 * ดึงรายการหนังสือที่เคยลงขายด้วย ISBN เดียวกัน (สูงสุด 3-5 รายการ)
 * เพื่อให้ผู้ขายคนถัดไปสามารถเลือกใช้ข้อมูลหนังสือที่เคยลงขายในระบบได้ทันที
 */
export async function getPreviousListingsByIsbn(
  rawIsbn: string,
  limit = 5,
  prismaClient?: any
): Promise<PreviousListingCandidate[]> {
  const db = prismaClient || defaultPrisma;
  const cleanIsbn = sanitizeIsbn(rawIsbn);
  const safeLimit = Math.max(1, Math.min(limit, 5));

  if (!db?.bookListing?.findMany) {
    return [];
  }

  const listings = await db.bookListing.findMany({
    where: {
      isbn: cleanIsbn,
      status: { not: 'HIDDEN' },
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: {
      bookCatalog: true,
      seller: {
        select: {
          id: true,
          nickname: true,
          shopProfile: {
            select: { shopName: true },
          },
        },
      },
      images: {
        orderBy: [{ isCover: 'desc' as const }, { displayOrder: 'asc' as const }],
        take: 1,
      },
    },
  });

  const candidates: PreviousListingCandidate[] = [];
  const seenKeys = new Set<string>();

  for (const item of listings) {
    const { snapshot } = extractCatalogSnapshot(item.photoChecks);
    const title = (snapshot?.title?.trim() || item.bookCatalog?.title || '').trim();
    if (!title) continue;

    const author = snapshot?.author?.trim() || item.bookCatalog?.author || null;
    const publisher = snapshot?.publisher?.trim() || item.bookCatalog?.publisher || null;
    const originalPrice =
      snapshot?.originalPrice !== null &&
      snapshot?.originalPrice !== undefined &&
      Number(snapshot.originalPrice) > 0
        ? Number(snapshot.originalPrice)
        : item.bookCatalog?.originalPrice !== null &&
          item.bookCatalog?.originalPrice !== undefined
        ? Number(item.bookCatalog.originalPrice)
        : null;

    const categories =
      Array.isArray(item.categories) && item.categories.length > 0
        ? item.categories
        : item.category
        ? [item.category]
        : item.bookCatalog?.category
        ? [item.bookCatalog.category]
        : [];

    // Deduplicate identical metadata from the same seller while keeping distinct listings across users/editions
    const dedupeKey = `${item.sellerId}:${title}:${author ?? ''}:${publisher ?? ''}:${originalPrice ?? ''}:${categories.join(',')}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    candidates.push({
      id: item.id,
      isbn: item.isbn,
      title,
      author,
      publisher,
      category: item.category || item.bookCatalog?.category || null,
      categories,
      description: item.description || null,
      original_price: originalPrice,
      selling_price: Number(item.price),
      cover_image_url:
        item.images?.[0]?.imageUrl || item.bookCatalog?.coverUrl || null,
      seller_name:
        item.seller?.shopProfile?.shopName ||
        item.seller?.nickname ||
        'ผู้ขายในระบบ',
      is_set: Boolean(item.isSet),
      total_volumes: item.totalVolumes ?? null,
      created_at: item.createdAt,
    });

    if (candidates.length >= safeLimit) break;
  }

  return candidates;
}

const GRADE_RANK: Record<BookGrade, number> = {
  LIKE_NEW: 4,
  GENTLY_READ: 3,
  WELL_LOVED: 2,
  WORN_BUT_READABLE: 1,
};

export interface IsbnCompareOffer {
  id: string;
  title: string;
  coverImageUrl: string;
  price: number;
  originalPrice: number | null;
  priceDiff: number;
  grade: BookGrade;
  defectCount: number;
  isSet: boolean;
  totalVolumes: number | null;
  missingVolumes: number[];
  allowPickup: boolean;
  pickupLocationName: string | null;
  allowDelivery: boolean;
  codEnabled: boolean;
  isCheapest: boolean;
  isBestGrade: boolean;
  isSameSeller: boolean;
  seller: {
    id: string;
    nickname: string;
    shopName: string | null;
    province: string | null;
    avatarUrl: string | null;
    isVerifiedSeller: boolean;
    rating: number;
    reviewCount: number;
    conditionAccuratePercent: number | null;
  };
}

export interface BookIsbnCompareResult {
  currentBookId: string;
  isbn: string;
  isSyntheticIsbn: boolean;
  currentPrice: number;
  currentGrade: BookGrade;
  isCurrentCheapest: boolean;
  isCurrentBestGrade: boolean;
  cheapestOfferPrice: number | null;
  totalOffers: number;
  offers: IsbnCompareOffer[];
}

function countDefectsFromListing(item: any): number {
  if (Array.isArray(item.defects) && item.defects.length > 0) {
    return item.defects.length;
  }
  const ans = item.conditionAnswers;
  if (ans && typeof ans === 'object' && !Array.isArray(ans)) {
    return Object.values(ans).filter((v) => v === true).length;
  }
  return 0;
}

/**
 * Service เปรียบเทียบหนังสือ ISBN เดียวกันจากร้านอื่น (GET /api/books/:id/compare)
 * - Read-only query จาก BookListing ที่ status = AVAILABLE
 * - ข้าม synthetic ISBN (ขึ้นต้นด้วย 299 ความยาว 13 หลัก)
 */
export async function getBookIsbnComparison(
  bookId: string,
  prismaClient?: any
): Promise<BookIsbnCompareResult> {
  const db = prismaClient || defaultPrisma;

  const current = await db.bookListing.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      isbn: true,
      sellerId: true,
      price: true,
      grade: true,
      isSet: true,
      status: true,
    },
  });

  if (!current || current.status === 'HIDDEN') {
    throw new AppError('ไม่พบหนังสือที่ระบุ', 404, 'BOOK_NOT_FOUND');
  }

  const currentPrice = Number(current.price);
  const currentGrade = current.grade as BookGrade;
  const isSyntheticIsbn = /^299\d{10}$/.test(String(current.isbn || '').trim());

  if (isSyntheticIsbn || !current.isbn) {
    return {
      currentBookId: current.id,
      isbn: current.isbn,
      isSyntheticIsbn: true,
      currentPrice,
      currentGrade,
      isCurrentCheapest: true,
      isCurrentBestGrade: true,
      cheapestOfferPrice: null,
      totalOffers: 0,
      offers: [],
    };
  }

  const siblings = await db.bookListing.findMany({
    where: {
      isbn: current.isbn,
      id: { not: current.id },
      isSet: Boolean(current.isSet),
      status: 'AVAILABLE',
    },
    orderBy: [{ price: 'asc' }, { createdAt: 'desc' }],
    take: 15,
    include: {
      bookCatalog: true,
      images: {
        orderBy: [{ isCover: 'desc' }, { displayOrder: 'asc' }],
        take: 1,
      },
      seller: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          isVerifiedSeller: true,
          shopProfile: {
            select: {
              shopName: true,
              province: true,
            },
          },
          receivedReviews: {
            select: {
              rating: true,
              isConditionAccurate: true,
            },
          },
        },
      },
    },
  });

  const rows = Array.isArray(siblings) ? siblings : [];
  const allPrices = [currentPrice, ...rows.map((r: any) => Number(r.price))];
  const minPrice = Math.min(...allPrices);
  const allGradeRanks = [
    GRADE_RANK[currentGrade] ?? 0,
    ...rows.map((r: any) => GRADE_RANK[r.grade as BookGrade] ?? 0),
  ];
  const maxGradeRank = Math.max(...allGradeRanks);

  const offers: IsbnCompareOffer[] = rows.map((item: any) => {
    const { snapshot } = extractCatalogSnapshot(item.photoChecks);
    const offerPrice = Number(item.price);
    const offerGrade = item.grade as BookGrade;
    const reviews = Array.isArray(item.seller?.receivedReviews)
      ? item.seller.receivedReviews
      : [];
    const reviewCount = reviews.length;
    const rating =
      reviewCount > 0
        ? Math.round(
            (reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) /
              reviewCount) *
              10
          ) / 10
        : 0;
    const accurateEntries = reviews.filter(
      (r: any) => typeof r.isConditionAccurate === 'boolean'
    );
    const conditionAccuratePercent =
      accurateEntries.length > 0
        ? Math.round(
            (accurateEntries.filter((r: any) => r.isConditionAccurate).length /
              accurateEntries.length) *
              100
          )
        : null;

    const resolvedTitle = snapshot?.title?.trim() || item.bookCatalog?.title || 'หนังสือ';
    const resolvedOriginalPrice =
      snapshot?.originalPrice !== null &&
      snapshot?.originalPrice !== undefined &&
      Number(snapshot.originalPrice) > 0
        ? Number(snapshot.originalPrice)
        : item.bookCatalog?.originalPrice !== null &&
          item.bookCatalog?.originalPrice !== undefined
        ? Number(item.bookCatalog.originalPrice)
        : null;

    return {
      id: item.id,
      title: resolvedTitle,
      coverImageUrl: item.images?.[0]?.imageUrl || item.bookCatalog?.coverUrl || '',
      price: offerPrice,
      originalPrice: resolvedOriginalPrice,
      priceDiff: Math.round((offerPrice - currentPrice) * 100) / 100,
      grade: offerGrade,
      defectCount: countDefectsFromListing(item),
      isSet: Boolean(item.isSet),
      totalVolumes: item.totalVolumes ?? null,
      missingVolumes:
        Boolean(item.isSet) && Array.isArray(item.missingVolumes)
          ? item.missingVolumes
          : [],
      allowPickup: Boolean(item.allowPickup),
      pickupLocationName: item.pickupLocationName ?? null,
      allowDelivery: Boolean(item.allowDelivery),
      codEnabled: item.codEnabled ?? true,
      isCheapest: offerPrice === minPrice,
      isBestGrade: (GRADE_RANK[offerGrade] ?? 0) === maxGradeRank,
      isSameSeller: item.sellerId === current.sellerId,
      seller: {
        id: item.seller?.id || item.sellerId,
        nickname: item.seller?.nickname || 'ร้านค้ากองดอง',
        shopName: item.seller?.shopProfile?.shopName ?? null,
        province: item.seller?.shopProfile?.province ?? null,
        avatarUrl: item.seller?.avatarUrl ?? null,
        isVerifiedSeller: Boolean(item.seller?.isVerifiedSeller),
        rating,
        reviewCount,
        conditionAccuratePercent,
      },
    };
  });

  const cheapestOfferPrice =
    offers.length > 0 ? Math.min(...offers.map((o) => o.price)) : null;

  return {
    currentBookId: current.id,
    isbn: current.isbn,
    isSyntheticIsbn: false,
    currentPrice,
    currentGrade,
    isCurrentCheapest: currentPrice === minPrice,
    isCurrentBestGrade: (GRADE_RANK[currentGrade] ?? 0) === maxGradeRank,
    cheapestOfferPrice,
    totalOffers: offers.length,
    offers,
  };
}
