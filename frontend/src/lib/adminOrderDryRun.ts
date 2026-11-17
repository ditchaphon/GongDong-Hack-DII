import { toV4Grade } from '@/lib/catalog';
import type { MeetupPoint } from '@/lib/delivery';
import type { Address, Book, ShopProfile, UserProfile } from '@/types';
import type {
  ChatMessage,
  V4BookSnapshot,
  V4Delivery,
  V4Order,
  V4Schedule,
  V4Shipping,
  ViewRole,
} from '@/types/v4';

export const DRY_RUN_ORDER_PREFIX = 'dryrun-';
const DRY_RUN_STORAGE_KEY = 'gongdong.adminOrderDryRun.v1';

export const DRY_RUN_DEFAULT_POINT: MeetupPoint = {
  id: 'dryrun-mp-1',
  name: 'หน้าหอสมุดกลาง มช.',
  province: 'เชียงใหม่',
  lat: 18.8023,
  lng: 98.9524,
  note: 'จุดนัดรับตัวอย่าง (Dry-run)',
};

export const DRY_RUN_PARCEL_BOX_PHOTO =
  'https://images.unsplash.com/photo-1589998059171-988d887df646?w=600';
export const DRY_RUN_RECEIVE_PHOTO =
  'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600';

export const DRY_RUN_FALLBACK_ADDRESS: Address = {
  id: 'dryrun-addr-1',
  fullName: 'สมชาย นักอ่าน (Dry-run)',
  province: 'เชียงใหม่',
  district: 'เมืองเชียงใหม่',
  subdistrict: 'สุเทพ',
  postalCode: '50200',
  detail: '239 ถนนห้วยแก้ว (ที่อยู่ตัวอย่าง Dry-run)',
  isDefault: true,
};

export const DRY_RUN_FALLBACK_BOOK: Book = {
  id: 'dryrun-book-1',
  title: 'Atomic Habits (ตัวอย่าง Dry-run)',
  author: 'James Clear',
  publisher: 'วีเลิร์น (WeLearn)',
  isbn: '9786161829029',
  isSet: false,
  price: 180,
  originalPrice: 285,
  grade: 'B',
  checklist: {
    coverIntact: true,
    noHighlight: true,
    noWaterDamage: true,
    pagesComplete: true,
    noYellowing: false,
  },
  photos: {
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
    back: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
    spine: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
    nameTag: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600',
  },
  sellerId: 'dryrun-seller-1',
  sellerName: 'ร้านหนังสือตัวอย่าง กองดอง',
  sellerRating: 4.9,
  isPromptPayVerified: true,
  deliveryMethods: ['MEETUP', 'PARCEL'],
  meetupZones: ['หน้าหอสมุดกลาง มช.'],
  createdAt: new Date().toISOString(),
  codEnabled: true,
  status: 'AVAILABLE',
};

export const DRY_RUN_FALLBACK_SHOP: ShopProfile = {
  id: 'dryrun-seller-1',
  shopName: 'ร้านหนังสือตัวอย่าง กองดอง',
  rating: 4.9,
  completedSales: 12,
  payeeVerified: true,
  memberSince: '2569',
  meetupZones: ['หน้าหอสมุดกลาง มช.'],
  supportsParcel: true,
  reviews: [],
  province: 'เชียงใหม่',
  meetupPoints: [DRY_RUN_DEFAULT_POINT],
  availableDays: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'],
  availableSlots: ['16:00 - 19:00'],
  bookedPickupSlots: [],
  shipMode: 'AFTER_ACCEPT',
  shipWithinDays: 2,
};

export interface DryRunStoredState {
  orders: V4Order[];
  messagesByOrder: Record<string, ChatMessage[]>;
  roleByOrder: Record<string, ViewRole>;
}

export function isDryRunOrderId(id?: string | null): boolean {
  return Boolean(id && id.startsWith(DRY_RUN_ORDER_PREFIX));
}

export function generateDryRunOrderId(tag: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${DRY_RUN_ORDER_PREFIX}${tag}-${rand}`;
}

export function generateDryRunHandoverCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function readDryRunStorage(): DryRunStoredState {
  if (typeof window === 'undefined') {
    return { orders: [], messagesByOrder: {}, roleByOrder: {} };
  }
  try {
    const raw = window.sessionStorage.getItem(DRY_RUN_STORAGE_KEY);
    if (!raw) return { orders: [], messagesByOrder: {}, roleByOrder: {} };
    const parsed = JSON.parse(raw) as Partial<DryRunStoredState>;
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      messagesByOrder:
        parsed.messagesByOrder && typeof parsed.messagesByOrder === 'object'
          ? parsed.messagesByOrder
          : {},
      roleByOrder:
        parsed.roleByOrder && typeof parsed.roleByOrder === 'object'
          ? parsed.roleByOrder
          : {},
    };
  } catch {
    return { orders: [], messagesByOrder: {}, roleByOrder: {} };
  }
}

export function writeDryRunStorage(state: DryRunStoredState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(DRY_RUN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function clearDryRunStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(DRY_RUN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface DryRunOrderInputShape {
  delivery: V4Delivery;
  shop: V4Order['shop'];
  shopId?: string;
  books: V4BookSnapshot[];
  shippingFee: number;
  schedule?: V4Schedule;
  shipping?: V4Shipping & { province?: string };
}

export function createDryRunOrderFromInput(
  input: DryRunOrderInputShape,
  user: UserProfile
): V4Order {
  const now = new Date().toISOString();
  const amount = input.books.reduce((sum, b) => sum + b.price, 0);
  const shippingFee = input.delivery === 'PARCEL' ? input.shippingFee : 0;

  return {
    id: generateDryRunOrderId(input.delivery === 'MEETUP' ? 'meetup' : 'parcel'),
    status: 'REQUESTED',
    delivery: input.delivery,
    buyerId: user.id || 'dryrun-buyer-1',
    buyer: {
      nickname: user.nickname || user.displayName || 'ผู้ซื้อ Dry-run',
      avatar: user.pictureUrl,
      rating: 5.0,
      completedOrders: 3,
      noShows: 0,
    },
    shopId: input.shopId || DRY_RUN_FALLBACK_SHOP.id,
    shop: input.shop,
    books: input.books,
    amount,
    shippingFee,
    total: amount + shippingFee,
    createdAtISO: now,
    updatedAtISO: now,
    schedule: input.schedule,
    shipping: input.shipping,
    creditSpent: false,
  };
}

export function createDryRunOrderPreset(
  delivery: V4Delivery,
  user: UserProfile,
  sourceBook?: Book | null
): V4Order {
  const book = sourceBook ?? DRY_RUN_FALLBACK_BOOK;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dateISO = tomorrow.toISOString().slice(0, 10);

  return createDryRunOrderFromInput(
    {
      delivery,
      shopId: book.sellerId || DRY_RUN_FALLBACK_SHOP.id,
      shop: {
        shopName: book.sellerName || DRY_RUN_FALLBACK_SHOP.shopName,
        avatar: book.sellerAvatar,
        rating: book.sellerRating || 4.9,
        completedSales: 12,
        payeeVerified: Boolean(book.isPromptPayVerified ?? true),
      },
      books: [
        {
          id: book.id,
          title: book.title,
          author: book.author,
          cover: book.photos.cover,
          grade: toV4Grade(book.grade),
          price: book.price,
        },
      ],
      shippingFee: delivery === 'PARCEL' ? 50 : 0,
      schedule:
        delivery === 'MEETUP'
          ? {
              dateISO,
              timeLabel: '16:00 - 17:00',
              lat: DRY_RUN_DEFAULT_POINT.lat,
              lng: DRY_RUN_DEFAULT_POINT.lng,
              landmark: DRY_RUN_DEFAULT_POINT.name,
              proposedBy: 'BUYER',
              confirmedByBuyer: true,
            }
          : undefined,
      shipping:
        delivery === 'PARCEL'
          ? {
              province: DRY_RUN_FALLBACK_ADDRESS.province,
              receiverName: DRY_RUN_FALLBACK_ADDRESS.fullName,
              receiverAddress: `${DRY_RUN_FALLBACK_ADDRESS.detail} ${DRY_RUN_FALLBACK_ADDRESS.subdistrict} ${DRY_RUN_FALLBACK_ADDRESS.district} ${DRY_RUN_FALLBACK_ADDRESS.province} ${DRY_RUN_FALLBACK_ADDRESS.postalCode}`,
            }
          : undefined,
    },
    user
  );
}
