import { AppError, BookCatalogData, IsbnLookupResult } from '../types';
import { prisma as defaultPrisma } from '../config/prisma';
import { env } from '../config/env';

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
  googleBooksApiKey?: string;
  timeoutMs?: number;
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

const DEFAULT_LOOKUP_TIMEOUT_MS = 8000;

interface OpenLibraryBookEntry {
  title?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  subjects?: Array<{ name?: string }>;
  cover?: {
    small?: string;
    medium?: string;
    large?: string;
  };
}

interface GoogleBooksVolumeItem {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
  saleInfo?: {
    listPrice?: {
      amount?: number;
    };
  };
}

const MAX_CATEGORY_LENGTH = 100;

function normalizeHttpsUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//i, 'https://');
}

function joinCategories(values?: Array<string | undefined>): string | null {
  if (!values || values.length === 0) return null;
  const unique = Array.from(
    new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)))
  );
  if (unique.length === 0) return null;

  let combined = '';
  for (const item of unique) {
    const candidate = combined ? `${combined}, ${item}` : item;
    if (candidate.length <= MAX_CATEGORY_LENGTH) {
      combined = candidate;
    } else if (!combined) {
      combined = item.slice(0, MAX_CATEGORY_LENGTH);
      break;
    } else {
      break;
    }
  }
  return combined || null;
}

async function fetchExternalJson(
  url: string,
  options?: GoogleBooksServiceOptions
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  if (options?.fetcher) {
    return options.fetcher(url);
  }
  const timeoutMs = options?.timeoutMs ?? DEFAULT_LOOKUP_TIMEOUT_MS;
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

async function cacheBookCatalog(db: any, bookData: BookCatalogData): Promise<void> {
  const payload = {
    title: bookData.title,
    author: bookData.author,
    publisher: bookData.publisher,
    category: bookData.category,
    coverUrl: bookData.coverUrl,
    originalPrice: bookData.originalPrice,
  };
  await db.bookCatalog.upsert({
    where: { isbn: bookData.isbn },
    update: payload,
    create: {
      isbn: bookData.isbn,
      ...payload,
    },
  });
}

async function fetchFromGoogleBooks(
  cleanIsbn: string,
  options?: GoogleBooksServiceOptions
): Promise<{
  book: BookCatalogData | null;
  warningCode?: IsbnLookupResult['warningCode'];
  warningMessage?: string;
}> {
  const apiKey = options?.googleBooksApiKey ?? env.GOOGLE_BOOKS_API_KEY;
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
  const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1${keyParam}`;

  try {
    const response = await fetchExternalJson(apiUrl, options);
    if (!response.ok) {
      if (response.status === 429) {
        return {
          book: null,
          warningCode: 'GOOGLE_BOOKS_RATE_LIMITED',
          warningMessage: 'Google Books API ถูกจำกัดการใช้งานชั่วคราว (HTTP 429)',
        };
      }
      return {
        book: null,
        warningCode: 'EXTERNAL_LOOKUP_FAILED',
        warningMessage: `Google Books API ตอบกลับด้วยสถานะ HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { items?: GoogleBooksVolumeItem[] };
    const first = data?.items?.[0];
    if (!first?.volumeInfo) {
      return { book: null };
    }

    const info = first.volumeInfo;
    const sale = first.saleInfo || {};
    const cover = normalizeHttpsUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null);

    return {
      book: {
        isbn: cleanIsbn,
        title: info.title || 'ไม่มีชื่อเรื่อง',
        author: info.authors && info.authors.length > 0 ? info.authors.join(', ') : null,
        publisher: info.publisher || null,
        category: joinCategories(info.categories),
        coverUrl: cover,
        originalPrice: sale.listPrice?.amount ? Number(sale.listPrice.amount) : null,
      },
    };
  } catch (err) {
    return {
      book: null,
      warningCode: 'EXTERNAL_LOOKUP_FAILED',
      warningMessage:
        err instanceof Error ? `เชื่อมต่อ Google Books API ไม่สำเร็จ: ${err.message}` : 'เชื่อมต่อ Google Books API ไม่สำเร็จ',
    };
  }
}

async function fetchFromOpenLibrary(
  cleanIsbn: string,
  options?: GoogleBooksServiceOptions
): Promise<BookCatalogData | null> {
  const apiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
  try {
    const response = await fetchExternalJson(apiUrl, options);
    if (!response.ok) return null;

    const payload = (await response.json()) as Record<string, OpenLibraryBookEntry>;
    const entry = payload?.[`ISBN:${cleanIsbn}`];
    if (!entry?.title) return null;

    const authors = (entry.authors || [])
      .map((a) => a.name?.trim())
      .filter((name): name is string => Boolean(name));
    const publisher = entry.publishers?.[0]?.name?.trim() || null;
    const category = joinCategories((entry.subjects || []).slice(0, 3).map((s) => s.name));
    const coverUrl = normalizeHttpsUrl(entry.cover?.large || entry.cover?.medium || entry.cover?.small || null);

    return {
      isbn: cleanIsbn,
      title: entry.title.trim(),
      author: authors.length > 0 ? authors.join(', ') : null,
      publisher,
      category,
      coverUrl,
      originalPrice: null,
    };
  } catch {
    return null;
  }
}

/**
 * ค้นหาข้อมูลหนังสือจาก ISBN แบบ Cache-Aside พร้อมระบุแหล่งที่มาและ Fallback ไปยัง Open Library เมื่อ Google Books ติด 429/ล้มเหลว
 */
export async function lookupBookByIsbn(
  rawIsbn: string,
  options?: GoogleBooksServiceOptions
): Promise<IsbnLookupResult> {
  const cleanIsbn = sanitizeIsbn(rawIsbn);
  const db = options?.prismaClient || defaultPrisma;

  // 1. ตรวจสอบแคชในฐานข้อมูลก่อน (Cache Hit)
  const cachedBook = await db.bookCatalog.findUnique({
    where: { isbn: cleanIsbn },
  });

  if (cachedBook) {
    return {
      found: true,
      isbn: cleanIsbn,
      source: 'DATABASE',
      book: {
        isbn: cachedBook.isbn,
        title: cachedBook.title,
        author: cachedBook.author,
        publisher: cachedBook.publisher,
        category: cachedBook.category,
        coverUrl: cachedBook.coverUrl,
        originalPrice: cachedBook.originalPrice !== null ? Number(cachedBook.originalPrice) : null,
      },
    };
  }

  // 2. ลองค้นหาจาก Google Books API
  const googleResult = await fetchFromGoogleBooks(cleanIsbn, options);
  if (googleResult.book) {
    await cacheBookCatalog(db, googleResult.book);
    return {
      found: true,
      isbn: cleanIsbn,
      source: 'GOOGLE_BOOKS',
      book: googleResult.book,
    };
  }

  // 3. Fallback ไปยัง Open Library API เมื่อไม่พบใน Google Books หรือโดน 429/timeout
  const openLibraryBook = await fetchFromOpenLibrary(cleanIsbn, options);
  if (openLibraryBook) {
    await cacheBookCatalog(db, openLibraryBook);
    return {
      found: true,
      isbn: cleanIsbn,
      source: 'OPEN_LIBRARY',
      book: openLibraryBook,
      ...(googleResult.warningCode ? { warningCode: googleResult.warningCode } : {}),
      ...(googleResult.warningMessage ? { warningMessage: googleResult.warningMessage } : {}),
    };
  }

  // 4. ไม่พบจากทุกแหล่ง (ไม่โยน 500 กลับไปให้ผู้ขายกรอกเองได้)
  return {
    found: false,
    isbn: cleanIsbn,
    source: null,
    book: null,
    ...(googleResult.warningCode ? { warningCode: googleResult.warningCode } : {}),
    ...(googleResult.warningMessage ? { warningMessage: googleResult.warningMessage } : {}),
  };
}
