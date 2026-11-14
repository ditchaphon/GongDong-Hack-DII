import { prisma as defaultPrisma } from '../config/prisma';
import { calculateBookGrade } from './gradingService';
import { sanitizeIsbn } from './googleBooksService';
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

function mapBookFeedItem(item: any): BookListingItem {
  const categories =
    Array.isArray(item.categories) && item.categories.length > 0
      ? item.categories
      : item.category
      ? [item.category]
      : [];

  return {
    id: item.id,
    title: item.bookCatalog.title,
    author: item.bookCatalog.author,
    category: item.category,
    categories,
    isSet: Boolean(item.isSet),
    totalVolumes: item.totalVolumes ?? null,
    coverImageUrl: item.images[0]?.imageUrl || item.bookCatalog.coverUrl || '',
    price: Number(item.price),
    originalPrice:
      item.bookCatalog.originalPrice !== null
        ? Number(item.bookCatalog.originalPrice)
        : null,
    grade: item.grade as BookGrade,
    allowPickup: Boolean(item.allowPickup),
    pickupLocationName: item.pickupLocationName ?? null,
    allowDelivery: Boolean(item.allowDelivery),
    codEnabled: item.codEnabled ?? true,
    seller: mapSellerSummary(item.seller),
  };
}

const FEED_BOOK_INCLUDE = {
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
    orderBy: [{ isCover: 'desc' as const }, { displayOrder: 'asc' as const }],
    take: 1,
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

  const [listings, total] = await Promise.all([
    db.bookListing.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: FEED_BOOK_INCLUDE,
    }),
    db.bookListing.count({ where }),
  ]);

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
    include: FEED_BOOK_INCLUDE,
  });

  return { books: listings.map(mapBookFeedItem) };
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

  if (!item) {
    throw new AppError('ไม่พบหนังสือที่ระบุ', 404, 'BOOK_NOT_FOUND');
  }

  const categories =
    Array.isArray(item.categories) && item.categories.length > 0
      ? item.categories
      : item.category
      ? [item.category]
      : [];

  return {
    id: item.id,
    isbn: item.isbn,
    title: item.bookCatalog.title,
    author: item.bookCatalog.author,
    publisher: item.bookCatalog.publisher,
    category: item.category,
    categories,
    isSet: Boolean(item.isSet),
    totalVolumes: item.totalVolumes ?? null,
    missingVolumes: Array.isArray(item.missingVolumes) ? item.missingVolumes : [],
    description: item.description ?? null,
    defects: item.defects ?? [],
    photoChecks: item.photoChecks ?? {},
    originalPrice:
      item.bookCatalog.originalPrice !== null
        ? Number(item.bookCatalog.originalPrice)
        : null,
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

  // 1. ตรวจสอบรูปภาพ 4 มุมบังคับ
  if (!input.images || !Array.isArray(input.images)) {
    throw new AppError('กรุณาแนบรูปภาพถ่ายหนังสือ', 400, 'MISSING_IMAGES');
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

  // 2. ตรวจสอบราคาขาย
  if (typeof input.price !== 'number' || input.price < 0) {
    throw new AppError('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ', 400, 'INVALID_PRICE');
  }

  // 3. คำนวณเกรดอัตโนมัติบน Server
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
  const categories =
    Array.isArray(input.categories) && input.categories.length > 0
      ? input.categories
      : input.category
      ? [input.category]
      : ['ทั่วไป / ไลฟ์สไตล์'];
  const primaryCategory = input.category || categories[0];

  // 4. บันทึกข้อมูลลงฐานข้อมูลแบบ Transaction
  return await db.$transaction(async (tx: any) => {
    await tx.bookCatalog.upsert({
      where: { isbn: cleanIsbn },
      update: {
        title: input.title,
        author: input.author || null,
        publisher: input.publisher || null,
        category: primaryCategory,
        coverUrl: input.coverUrl || null,
        originalPrice: input.originalPrice ?? null,
      },
      create: {
        isbn: cleanIsbn,
        title: input.title,
        author: input.author || null,
        publisher: input.publisher || null,
        category: primaryCategory,
        coverUrl: input.coverUrl || null,
        originalPrice: input.originalPrice ?? null,
      },
    });

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
        totalVolumes: input.isSet ? input.totalVolumes ?? null : null,
        missingVolumes:
          input.isSet && Array.isArray(input.missingVolumes)
            ? input.missingVolumes
            : [],
        defects: (input.defects ?? []) as any,
        photoChecks: (input.photoChecks ?? {}) as any,
        allowPickup: input.allowPickup ?? true,
        pickupLat: input.pickupLat ?? null,
        pickupLng: input.pickupLng ?? null,
        pickupLocationName: input.pickupLocationName ?? null,
        allowDelivery: input.allowDelivery ?? true,
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
      title: input.title,
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

  if (input.price !== undefined && (typeof input.price !== 'number' || input.price < 0)) {
    throw new AppError('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ', 400, 'INVALID_PRICE');
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
    },
  });

  const books: UserBookListingItem[] = listings.map((item: any) => ({
    id: item.id,
    title: item.bookCatalog.title,
    category: item.category,
    categories:
      Array.isArray(item.categories) && item.categories.length > 0
        ? item.categories
        : [item.category],
    isSet: Boolean(item.isSet),
    price: Number(item.price),
    grade: item.grade as BookGrade,
    coverImageUrl: item.images[0]?.imageUrl || item.bookCatalog.coverUrl || '',
    status: item.status,
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
  prismaClient?: any
): Promise<{ success: boolean; message: string }> {
  const db = prismaClient || defaultPrisma;

  const listing = await db.bookListing.findUnique({
    where: { id },
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

  await db.bookListing.delete({
    where: { id },
  });

  return {
    success: true,
    message: 'ลบรายการหนังสือสำเร็จ',
  };
}
