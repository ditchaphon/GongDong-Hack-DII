import type { MeetupPoint, ShipMode } from '@/lib/delivery';

export type BookGrade = 'A' | 'B' | 'C' | 'D';

export interface ConditionChecklist {
  coverIntact: boolean;         // สันปกและปกไม่ฉีกขาด
  noHighlight: boolean;         // ไม่มีรอยขีดเขียน/ไฮไลต์
  noWaterDamage: boolean;       // ไม่มีคราบน้ำ/บวม
  pagesComplete: boolean;       // หน้าครบ ไม่หลุด
  noYellowing: boolean;         // ขอบกระดาษไม่เหลืองคล้ำ
}

export type DeliveryMethod = 'PARCEL' | 'MEETUP';

export interface Book {
  id: string;
  title: string;
  author: string;
  publisher?: string;
  isbn?: string;
  description?: string;
  categories?: string[];
  isSet: boolean;
  totalVolumes?: number;
  missingVolumes?: number[];
  price: number;
  originalPrice?: number;
  grade: BookGrade;
  checklist: ConditionChecklist;
  photos: {
    cover: string;
    back: string;
    spine: string;
    nameTag: string; // Paper name tag (mandatory)
    defects?: string[];
  };
  sellerId: string;
  sellerName: string;
  sellerRating: number;
  sellerAvatar?: string;
  isPromptPayVerified: boolean;
  deliveryMethods: DeliveryMethod[];
  parcelShippingFee?: number;
  meetupZones?: string[];
  createdAt: string;
  /** v4 discovery fields (optional so existing mock data keeps working). */
  course?: string;
  defects?: { label: string; photo: string }[];
  shopPayeeVerified?: boolean;
  codEnabled?: boolean;
  status?: string;
}

export type OrderStatus =
  | 'PENDING_ACCEPT'        // Buyer sent request, waiting for seller to accept (-1 credit)
  | 'WAITING_PAYMENT'       // Seller accepted, waiting for buyer slip or meetup
  | 'PAYMENT_SUBMITTED'     // Buyer uploaded slip (parcel)
  | 'PREPARING_SHIPPING'    // Seller preparing parcel (48hr SLA)
  | 'SHIPPED'               // Tracking number added
  | 'MEETUP_CONFIRMED'      // Meetup time/place set
  | 'COMPLETED'             // Finished and rated
  | 'CANCELLED'             // Cancelled by buyer or seller
  | 'REPORTED';             // Dispute opened

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  books: Book[];
  totalAmount: number;
  shippingFee: number;
  deliveryMethod: DeliveryMethod;
  meetupDetails?: {
    zone: string;
    scheduledAt: string;
    note?: string;
  };
  shippingAddress?: Address;
  trackingNumber?: string;
  status: OrderStatus;
  createdAt: string;
  expiresAt?: string;
}

// Delivery-only receiver data. v4 forbids storing or showing a contact phone
// on shared objects, so the receiver is identified by name + address only.
export interface Address {
  id: string;
  fullName: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
  detail: string;
  isDefault: boolean;
}

export type ListingStatus = 'ACTIVE' | 'WAITING_PAYMENT' | 'HIDDEN' | 'CLOSED';

export interface Review {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  comment: string;
  gradeMatched: boolean;
  createdAt: string;
}

export interface BookedPickupSlot {
  dateISO: string;
  timeLabel: string;
}

/** Public shop profile — shop name only, never the owner's real name or contact. */
export interface ShopProfile {
  id: string;
  shopName: string;
  avatar?: string;
  rating: number;
  completedSales: number;
  payeeVerified: boolean;
  memberSince: string;
  meetupZones: string[];
  supportsParcel: boolean;
  reviews: Review[];
  /** Where parcels ship from; used for the calculated shipping fee. */
  province: string;
  /** Seller-defined meet-up points (any province). */
  meetupPoints: MeetupPoint[];
  availableDays: string[];
  availableSlots: string[];
  bookedPickupSlots?: BookedPickupSlot[];
  shipMode: ShipMode;
  shipWithinDays: number;
}

export interface SellerListing extends Book {
  status: ListingStatus;
  views: number;
  savedCount: number;
}

export interface SellerOrder extends Order {
  buyerName: string;
  buyerAvatar?: string;
  buyerNote?: string;
  acceptedAt?: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  note: string;
  isPopular?: boolean;
}

export interface PhotoCheck {
  status: 'GOOD' | 'DEFECT';
  issues?: (keyof ConditionChecklist)[];
  defectPhoto?: string;
  defectNote?: string;
}

export interface ListingDefect {
  id: string;
  note: string;
  photo?: string;
}

export type IsbnLookupSource =
  | 'DATABASE'
  | 'GOOGLE_BOOKS'
  | 'OPEN_LIBRARY'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'ERROR';

export interface ListingDraft {
  mode: 'SINGLE' | 'SET';
  isbn: string;
  isbnLookupSource?: IsbnLookupSource;
  isbnLookupMessage?: string;
  title: string;
  author: string;
  publisher: string;
  description: string;
  categories: string[];
  originalPrice: number;
  totalVolumes: number;
  missingVolumes: number[];
  photos: {
    cover: string;
    back: string;
    spine: string;
    /** Legacy; listings no longer require a name-tag photo. */
    nameTag: string;
    /** Inner pages photo (camera only). */
    inner?: string;
    defects: string[];
  };
  checklist: ConditionChecklist;
  /** Seller's per-photo inspection: good, or which checklist items fail. */
  photoChecks?: Record<string, PhotoCheck>;
  defects: ListingDefect[];
  price: number;
  deliveryMethods: DeliveryMethod[];
  parcelShippingFee: number;
  codEnabled: boolean;
}

export interface SellerReport {
  orderId: string;
  reason: string;
  detail: string;
  photos: string[];
}

export interface UserProfile {
  id: string;
  lineUserId: string;
  displayName: string;
  nickname?: string;
  pictureUrl?: string;
  isSeller: boolean;
  credits: number;
  isVerifiedSeller: boolean;
  isAdmin?: boolean;
  pdpaConsentAt?: string | null;
  promptPayName?: string;
  phone?: string;
}

