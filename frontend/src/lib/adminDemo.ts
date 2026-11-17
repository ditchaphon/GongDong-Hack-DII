import { api } from '@/lib/api';
import { BOOK_CATEGORIES, mapApiCategoryToThaiCategories } from '@/lib/catalog';
import { type MeetupPoint, type ShipMode } from '@/lib/delivery';
import {
  BackendBookDetail,
  mapBackendBookDetailToBook,
} from '@/lib/mappers';
import type {
  Book,
  ConditionChecklist,
  ListingDefect,
  ListingDraft,
} from '@/types';

/** Valid Mod-11 Thai national ID reserved solely for Admin Dry-run Demo preview. */
export const ADMIN_DEMO_THAI_ID = '1100700000001';

const DEFAULT_DEMO_MEETUP_POINT: MeetupPoint = {
  id: 'mp-default',
  name: 'หน้าหอสมุดกลาง มช.',
  province: 'เชียงใหม่',
  lat: 18.8023,
  lng: 98.9524,
};

export interface AdminDemoShopFallback {
  shopName: string;
  description: string;
  province: string;
  meetupPoints: MeetupPoint[];
  availableDays: string[];
  availableSlots: string[];
  supportsParcel: boolean;
  shipMode: ShipMode;
  shipWithinDays: number;
  firstName: string;
  lastName: string;
}

export const ADMIN_DEMO_SHOP_FALLBACK: AdminDemoShopFallback = {
  shopName: 'ร้านหนังสือตัวอย่าง กองดอง',
  description: 'ขายหนังสืออ่านเอง สภาพดี เช็กตำหนิครบทุกจุด นัดรับและจัดส่งไว',
  province: 'เชียงใหม่',
  meetupPoints: [DEFAULT_DEMO_MEETUP_POINT],
  availableDays: ['จ', 'อ', 'พ', 'พฤ', 'ศ'],
  availableSlots: ['16:00 - 19:00'],
  supportsParcel: true,
  shipMode: 'AFTER_ACCEPT',
  shipWithinDays: 2,
  firstName: 'สมชาย',
  lastName: 'รักอ่าน',
};

const CONDITION_CRITERIA_META: Array<{
  key: keyof ConditionChecklist;
  title: string;
  defaultLabel: string;
}> = [
  { key: 'coverIntact', title: 'ปกหน้าและปกหลัง', defaultLabel: 'ปกหน้า/ปกหลังมีรอยพับหรือฉีกขาด' },
  { key: 'noHighlight', title: 'รอยขีดเขียน / ไฮไลต์', defaultLabel: 'มีรอยขีดเขียนหรือไฮไลต์' },
  { key: 'noWaterDamage', title: 'รอยเปื้อน / คราบน้ำ', defaultLabel: 'มีรอยเปื้อนหรือคราบน้ำ' },
  { key: 'pagesComplete', title: 'หน้ากระดาษครบถ้วน', defaultLabel: 'หน้ากระดาษมีรอยขาดหรือหลุดบางหน้า' },
  { key: 'noYellowing', title: 'สันปกและขอบกระดาษ', defaultLabel: 'สันย่นหรือขอบกระดาษมีจุดเหลือง' },
];

const STANDARD_CATEGORY_SET = new Set<string>(BOOK_CATEGORIES);

function normalizeDraftCategories(rawCategories?: string[]): {
  categories: string[];
  customCategory: string;
} {
  if (!rawCategories || rawCategories.length === 0) {
    return { categories: [], customCategory: '' };
  }
  const categories: string[] = [];
  let customCategory = '';

  for (const raw of rawCategories) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (STANDARD_CATEGORY_SET.has(trimmed)) {
      if (!categories.includes(trimmed)) categories.push(trimmed);
      continue;
    }
    const mapped = mapApiCategoryToThaiCategories(trimmed);
    if (mapped.length > 0 && !mapped.includes('อื่น ๆ')) {
      for (const item of mapped) {
        if (!categories.includes(item)) categories.push(item);
      }
      continue;
    }
    if (!categories.includes('อื่น ๆ')) categories.push('อื่น ๆ');
    if (!customCategory) customCategory = trimmed.slice(0, 40);
  }

  return { categories, customCategory };
}

function buildDraftDefects(
  checklist: ConditionChecklist,
  bookDefects: Book['defects'],
  fallbackPhoto: string
): { defects: ListingDefect[]; defectPhotos: string[] } {
  const sourceDefects = bookDefects ?? [];
  const defects: ListingDefect[] = [];
  let defectIdx = 0;

  for (const criterion of CONDITION_CRITERIA_META) {
    if (checklist[criterion.key]) continue;
    const matched = sourceDefects[defectIdx];
    defectIdx += 1;
    const rawNote = matched?.label?.trim();
    const note = rawNote
      ? rawNote.startsWith(`${criterion.title}: `)
        ? rawNote
        : `${criterion.title}: ${rawNote}`
      : criterion.defaultLabel;
    defects.push({
      id: criterion.key,
      note,
      photo: matched?.photo || fallbackPhoto,
    });
  }

  const defectPhotos = defects
    .map((d) => d.photo)
    .filter((url): url is string => Boolean(url));

  return { defects, defectPhotos };
}

/** Map a full Book detail into a prefilled ListingDraft in Dry-run demo mode. */
export function buildAdminDemoDraftFromBook(book: Book): ListingDraft {
  const { categories, customCategory } = normalizeDraftCategories(book.categories);
  const cover = book.photos.cover;
  const inner = book.photos.nameTag || cover;
  const { defects, defectPhotos } = buildDraftDefects(
    book.checklist,
    book.defects,
    cover
  );

  return {
    mode: book.isSet ? 'SET' : 'SINGLE',
    isbn: book.isbn || '',
    isbnLookupSource: book.isbn ? 'DATABASE' : undefined,
    title: book.title,
    author: book.author === 'ไม่ระบุผู้แต่ง' ? '' : book.author,
    publisher: book.publisher || '',
    description: book.description || '',
    categories,
    customCategory,
    originalPrice: book.originalPrice || 0,
    totalVolumes: book.isSet ? Math.max(2, book.totalVolumes || 2) : 1,
    missingVolumes: book.isSet ? book.missingVolumes ?? [] : [],
    photos: {
      cover,
      back: book.photos.back || cover,
      spine: book.photos.spine || cover,
      nameTag: inner,
      inner,
      defects: defectPhotos,
    },
    checklist: { ...book.checklist },
    defects,
    price: book.price,
    deliveryMethods: book.deliveryMethods.length ? [...book.deliveryMethods] : ['MEETUP'],
    parcelShippingFee: book.parcelShippingFee ?? 50,
    codEnabled: book.codEnabled !== false,
    isDemoDryRun: true,
    demoSourceBookId: book.id,
  };
}

/** Fallback sample draft when an admin has no listings yet. */
export function buildAdminDemoFallbackDraft(): ListingDraft {
  return {
    mode: 'SINGLE',
    isbn: '9786161829029',
    isbnLookupSource: 'DATABASE',
    title: 'Atomic Habits (ฉบับตัวอย่างนำเสนอ)',
    author: 'James Clear',
    publisher: 'วีเลิร์น (WeLearn)',
    description: 'อ่านจบ 1 รอบ เก็บในซองใสอย่างดี ไม่มีรอยพับหรือคราบน้ำ',
    categories: ['วิชาการ'],
    customCategory: '',
    originalPrice: 285,
    totalVolumes: 1,
    missingVolumes: [],
    photos: {
      cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
      back: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
      spine: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
      nameTag: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600',
      inner: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600',
      defects: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600'],
    },
    checklist: {
      coverIntact: true,
      noHighlight: true,
      noWaterDamage: true,
      pagesComplete: true,
      noYellowing: false,
    },
    defects: [
      {
        id: 'noYellowing',
        note: 'สันปกและขอบกระดาษ: มีจุดเหลืองจางๆ ตามกาลเวลา 2-3 จุด',
        photo: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
      },
    ],
    price: 170,
    deliveryMethods: ['MEETUP', 'PARCEL'],
    parcelShippingFee: 50,
    codEnabled: true,
    isDemoDryRun: true,
    demoSourceBookId: undefined,
  };
}

/**
 * Load full book detail for Admin Relist Demo, falling back to a local sample draft
 * if no book ID is supplied or the fetch fails.
 */
export async function loadAdminRelistDraft(
  bookId?: string | null,
  fallbackListing?: Book | null
): Promise<ListingDraft> {
  if (bookId) {
    try {
      const detail = await api.get<BackendBookDetail>(
        `/api/books/${encodeURIComponent(bookId)}`
      );
      return buildAdminDemoDraftFromBook(mapBackendBookDetailToBook(detail));
    } catch {
      if (fallbackListing) {
        return buildAdminDemoDraftFromBook(fallbackListing);
      }
    }
  }
  if (fallbackListing) {
    return buildAdminDemoDraftFromBook(fallbackListing);
  }
  return buildAdminDemoFallbackDraft();
}
