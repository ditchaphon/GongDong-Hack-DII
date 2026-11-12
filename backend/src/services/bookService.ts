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
  UserBookListingItem,
} from '../types';

const MANDATORY_IMAGE_TYPES: BookImageType[] = [
  'FRONT_COVER',
  'BACK_COVER',
  'SPINE',
  'EDGE',
];

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

  const where: any = {
    status: 'AVAILABLE',
  };

  if (filter.category) {
    where.category = filter.category;
  }

  if (filter.grade) {
    where.grade = filter.grade;
  }

  if (filter.shipping === 'PICKUP') {
    where.allowPickup = true;
  } else if (filter.shipping === 'DELIVERY') {
    where.allowDelivery = true;
  }

  if (filter.q && filter.q.trim()) {
    const search = filter.q.trim();
    where.OR = [
      { bookCatalog: { title: { contains: search, mode: 'insensitive' } } },
      { bookCatalog: { author: { contains: search, mode: 'insensitive' } } },
      { isbn: { contains: search, mode: 'insensitive' } },
      { pickupLocationName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [listings, total] = await Promise.all([
    db.bookListing.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        bookCatalog: true,
        seller: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            isVerifiedSeller: true,
          },
        },
        images: {
          orderBy: [{ isCover: 'desc' }, { displayOrder: 'asc' }],
          take: 1,
        },
      },
    }),
    db.bookListing.count({ where }),
  ]);

  const books: BookListingItem[] = listings.map((item: any) => ({
    id: item.id,
    title: item.bookCatalog.title,
    author: item.bookCatalog.author,
    category: item.category,
    coverImageUrl: item.images[0]?.imageUrl || item.bookCatalog.coverUrl || '',
    price: Number(item.price),
    originalPrice: item.bookCatalog.originalPrice !== null ? Number(item.bookCatalog.originalPrice) : null,
    grade: item.grade as BookGrade,
    allowPickup: item.allowPickup,
    pickupLocationName: item.pickupLocationName,
    allowDelivery: item.allowDelivery,
    seller: {
      id: item.seller.id,
      nickname: item.seller.nickname || 'ร้านค้ากองดอง',
      avatarUrl: item.seller.avatarUrl,
      isVerifiedSeller: item.seller.isVerifiedSeller,
    },
  }));

  return { books, total };
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

  return {
    id: item.id,
    isbn: item.isbn,
    title: item.bookCatalog.title,
    author: item.bookCatalog.author,
    publisher: item.bookCatalog.publisher,
    category: item.category,
    originalPrice: item.bookCatalog.originalPrice !== null ? Number(item.bookCatalog.originalPrice) : null,
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
    allowPickup: item.allowPickup,
    pickupLat: item.pickupLat !== null ? Number(item.pickupLat) : null,
    pickupLng: item.pickupLng !== null ? Number(item.pickupLng) : null,
    pickupLocationName: item.pickupLocationName,
    allowDelivery: item.allowDelivery,
    status: item.status,
    seller: {
      id: item.seller.id,
      nickname: item.seller.nickname || 'ร้านค้ากองดอง',
      avatarUrl: item.seller.avatarUrl,
      isVerifiedSeller: item.seller.isVerifiedSeller,
    },
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
  const missingTypes = MANDATORY_IMAGE_TYPES.filter(
    (type) => !imageTypesPresent.has(type)
  );

  if (missingTypes.length > 0) {
    throw new AppError(
      `กรุณาถ่ายรูปให้ครบทั้ง 4 มุมบังคับ (ขาด: ${missingTypes.join(', ')})`,
      400,
      'INVALID_IMAGE_TYPES'
    );
  }

  // 2. ตรวจสอบราคาขาย
  if (input.price < 0 || isNaN(input.price)) {
    throw new AppError('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ', 400, 'INVALID_PRICE');
  }

  // 3. ตรวจสอบผลตรวจสภาพและคำนวณเกรดจริงบน Server (ห้ามเชื่อ Client)
  if (!input.conditionAnswers) {
    throw new AppError('กรุณาระบุผลตรวจสภาพหนังสือ 5 จุด', 400, 'INVALID_CONDITION');
  }

  const originalPriceForGrading =
    input.originalPrice !== undefined && input.originalPrice !== null
      ? Number(input.originalPrice)
      : Number(input.price);

  const gradingResult = calculateBookGrade(
    input.conditionAnswers,
    originalPriceForGrading
  );

  const verifiedGrade = gradingResult.grade;
  const cleanIsbn = sanitizeIsbn(input.isbn);

  // 4. บันทึกข้อมูลลงฐานข้อมูลแบบ Transaction
  return await db.$transaction(async (tx: any) => {
    // 4.1 ตรวจสอบและ Upsert แคตตาล็อกกลาง book_catalog
    await tx.bookCatalog.upsert({
      where: { isbn: cleanIsbn },
      update: {
        title: input.title,
        author: input.author || null,
        publisher: input.publisher || null,
        category: input.category || 'ทั่วไป / ไลฟ์สไตล์',
        coverUrl: input.coverUrl || null,
        originalPrice: input.originalPrice ?? null,
      },
      create: {
        isbn: cleanIsbn,
        title: input.title,
        author: input.author || null,
        publisher: input.publisher || null,
        category: input.category || 'ทั่วไป / ไลฟ์สไตล์',
        coverUrl: input.coverUrl || null,
        originalPrice: input.originalPrice ?? null,
      },
    });

    // 4.2 สร้างรายการลงขาย book_listing
    const listing = await tx.bookListing.create({
      data: {
        isbn: cleanIsbn,
        sellerId,
        price: input.price,
        conditionAnswers: input.conditionAnswers as any,
        grade: verifiedGrade,
        category: input.category || 'ทั่วไป / ไลฟ์สไตล์',
        allowPickup: input.allowPickup ?? true,
        pickupLat: input.pickupLat ?? null,
        pickupLng: input.pickupLng ?? null,
        pickupLocationName: input.pickupLocationName ?? null,
        allowDelivery: input.allowDelivery ?? true,
        status: 'AVAILABLE',
      },
    });

    // 4.3 สร้างรายการรูปภาพ book_listing_images (1:N)
    await tx.bookListingImage.createMany({
      data: input.images.map((img) => ({
        bookListingId: listing.id,
        imageUrl: img.imageUrl,
        imageType: img.imageType,
        displayOrder: img.displayOrder,
        isCover: img.isCover ?? (img.imageType === 'FRONT_COVER'),
      })),
    });

    return {
      id: listing.id,
      title: input.title,
      category: listing.category,
      grade: verifiedGrade,
      price: Number(listing.price),
      recommendedPrice: gradingResult.recommendedPrice,
      status: listing.status,
      createdAt: listing.createdAt,
    };
  });
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
 * อนุญาตให้ลบได้เฉพาะเจ้าของ และสถานะต้องยังเป็น AVAILABLE
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

  if (listing.status !== 'AVAILABLE') {
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
