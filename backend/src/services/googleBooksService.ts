import { AppError, BookCatalogData } from '../types';
import { prisma as defaultPrisma } from '../config/prisma';

export interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  categories?: string[];
  imageLinks?: {
    smallThumbnail?: string;
    thumbnail?: string;
  };
}

export interface GoogleBooksApiResponse {
  totalItems: number;
  items?: Array<{
    id: string;
    volumeInfo: GoogleBooksVolumeInfo;
    saleInfo?: {
      listPrice?: {
        amount?: number;
        currencyCode?: string;
      };
    };
  }>;
}

export interface GoogleBooksServiceOptions {
  prismaClient?: any;
  fetcher?: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
}

/**
 * ล้างและตรวจรูปแบบ ISBN (รองรับ ISBN-10 และ ISBN-13)
 */
export function sanitizeIsbn(rawIsbn: string): string {
  const clean = rawIsbn.replace(/[-\s]/g, '').trim().toUpperCase();
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(clean)) {
    throw new AppError(
      `รหัส ISBN ไม่ถูกต้อง: "${rawIsbn}" (ต้องเป็นตัวเลข 10 หรือ 13 หลัก)`,
      400,
      'INVALID_ISBN'
    );
  }
  return clean;
}

/**
 * Service ดึงข้อมูลหนังสือจาก ISBN ตามรูปแบบ Cache-Aside:
 * 1. ตรวจสอบในตาราง book_catalog ก่อน หากพบให้คืนข้อมูลทันที (Cache Hit)
 * 2. หากไม่พบในฐานข้อมูล (Cache Miss) จะยิงไป Google Books API (ระบุ maxResults=1 เพื่อประหยัด Token)
 * 3. บันทึกผลลัพธ์ลงตาราง book_catalog และส่งคืนผลลัพธ์
 */
export async function getBookByIsbn(
  rawIsbn: string,
  options?: GoogleBooksServiceOptions
): Promise<BookCatalogData | null> {
  const cleanIsbn = sanitizeIsbn(rawIsbn);
  const db = options?.prismaClient || defaultPrisma;
  const customFetch = options?.fetcher || fetch;

  // 1. ตรวจสอบแคชในฐานข้อมูลก่อน (Cache Hit)
  const cachedBook = await db.bookCatalog.findUnique({
    where: { isbn: cleanIsbn },
  });

  if (cachedBook) {
    return {
      isbn: cachedBook.isbn,
      title: cachedBook.title,
      author: cachedBook.author,
      publisher: cachedBook.publisher,
      category: cachedBook.category,
      coverUrl: cachedBook.coverUrl,
      originalPrice: cachedBook.originalPrice !== null ? Number(cachedBook.originalPrice) : null,
    };
  }

  // 2. หากไม่พบ ให้เรียก Google Books API ด้วย &maxResults=1
  const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1`;
  const response = await customFetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Google Books API ตอบกลับด้วยสถานะ HTTP ${response.status}`);
  }

  const data: GoogleBooksApiResponse = await response.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const volume = data.items[0];
  const info = volume.volumeInfo || {};
  const sale = volume.saleInfo || {};

  // จัดการ URL รูปภาพ ให้เป็น HTTPS เพื่อความปลอดภัย
  let rawCoverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
  if (rawCoverUrl && rawCoverUrl.startsWith('http://')) {
    rawCoverUrl = rawCoverUrl.replace('http://', 'https://');
  }

  const bookData: BookCatalogData = {
    isbn: cleanIsbn,
    title: info.title || 'ไม่มีชื่อเรื่อง',
    author: info.authors && info.authors.length > 0 ? info.authors.join(', ') : null,
    publisher: info.publisher || null,
    category: info.categories && info.categories.length > 0 ? info.categories[0] : null,
    coverUrl: rawCoverUrl,
    originalPrice: sale.listPrice?.amount ? Number(sale.listPrice.amount) : null,
  };

  // 3. แคชบันทึกลงตาราง book_catalog
  await db.bookCatalog.upsert({
    where: { isbn: cleanIsbn },
    update: {
      title: bookData.title,
      author: bookData.author,
      publisher: bookData.publisher,
      category: bookData.category,
      coverUrl: bookData.coverUrl,
      originalPrice: bookData.originalPrice,
    },
    create: {
      isbn: cleanIsbn,
      title: bookData.title,
      author: bookData.author,
      publisher: bookData.publisher,
      category: bookData.category,
      coverUrl: bookData.coverUrl,
      originalPrice: bookData.originalPrice,
    },
  });

  return bookData;
}
