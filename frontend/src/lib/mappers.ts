import type {
  Address,
  Book,
  ListingStatus,
  Review,
  SellerListing,
  ShopProfile,
} from '@/types';
import type { ShopSettings } from '@/hooks/useSeller';
import type {
  ChatMessage,
  CreditEntry,
  CreditReason,
  V4Order,
  V4OrderStatus,
  V4Schedule,
  ViewRole,
} from '@/types/v4';
import type { MeetupPoint, ShipMode } from '@/lib/delivery';
import { conditionAnswersToChecklist, toUiBookGrade, toV4Grade } from '@/lib/catalog';

const FALLBACK_BOOK_COVER =
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600';

export interface BackendBookFeedItem {
  id: string;
  title: string;
  author: string | null;
  category?: string;
  categories?: string[];
  isSet?: boolean;
  totalVolumes?: number | null;
  coverImageUrl: string;
  price: number;
  originalPrice: number | null;
  grade: string;
  allowPickup?: boolean;
  pickupLocationName?: string | null;
  allowDelivery?: boolean;
  codEnabled?: boolean;
  seller: {
    id: string;
    nickname: string | null;
    shopName: string | null;
    avatarUrl: string | null;
    isVerifiedSeller: boolean;
  };
}

export interface BackendBookDetail extends BackendBookFeedItem {
  isbn?: string;
  publisher?: string | null;
  missingVolumes?: number[];
  description?: string | null;
  defects?: Array<{ id?: string; note?: string; label?: string; photo?: string }>;
  conditionAnswers?: Record<string, boolean> | null;
  images?: Array<{
    id?: string;
    imageUrl: string;
    imageType: string;
    displayOrder?: number;
    isCover?: boolean;
  }>;
  pickupLat?: number | null;
  pickupLng?: number | null;
  status?: string;
}

export interface BackendUserBookItem {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  categories?: string[];
  isSet?: boolean;
  totalVolumes?: number | null;
  price: number;
  grade: string;
  coverImageUrl: string;
  allowPickup?: boolean;
  allowDelivery?: boolean;
  codEnabled?: boolean;
  status: string;
  createdAt: string;
}

export interface BackendMeetupPoint {
  id: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
  note?: string | null;
}

export interface BackendMyShopResponse {
  shop: {
    id: string;
    shop_name: string;
    description: string | null;
    avatar_url: string | null;
    province: string;
    available_days: string[];
    available_slots: string[];
    supports_parcel: boolean;
    ship_mode: string;
    ship_within_days: number;
    setup_complete: boolean;
    meetup_points: BackendMeetupPoint[];
  } | null;
  kyc: {
    first_name: string | null;
    last_name: string | null;
    national_id_masked: string | null;
    verified_at: string;
  } | null;
  is_verified_seller: boolean;
  credits: number;
}

export interface BackendPublicShopResponse {
  id: string;
  seller_id: string;
  shop_name: string;
  description: string | null;
  avatar_url: string | null;
  province: string;
  payee_verified: boolean;
  rating: number;
  total_reviews: number;
  completed_sales: number;
  member_since: string;
  supports_parcel: boolean;
  ship_mode: string;
  ship_within_days: number;
  available_days: string[];
  available_slots: string[];
  booked_pickup_slots?: Array<{ date_iso: string; time_label: string }>;
  meetup_points: BackendMeetupPoint[];
  listings: Array<{
    id: string;
    title: string;
    author: string | null;
    price: number;
    grade: string;
    is_set: boolean;
    cover_image_url: string;
  }>;
}

export interface BackendReviewsResponse {
  summary: {
    average_rating: number;
    total_reviews: number;
    condition_accuracy_rate: number | null;
  };
  reviews: Array<{
    id: string;
    order_id: string;
    reviewer: {
      id: string;
      nickname: string | null;
      avatar_url: string | null;
    };
    rating: number;
    is_condition_accurate: boolean | null;
    tags: string[];
    comment: string | null;
    created_at: string;
  }>;
}

export interface BackendAddress {
  id: string;
  full_name: string;
  province: string;
  district: string;
  subdistrict: string;
  postal_code: string;
  detail: string;
  is_default: boolean;
}

export interface BackendOrderDetail {
  id: string;
  status: string;
  shipping_method: 'PICKUP' | 'DELIVERY';
  payment_method?: 'COD' | 'TRANSFER';
  shipping_fee: number;
  total_price: number;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_location_name: string | null;
  scheduled_at: string | null;
  schedule_date_iso: string | null;
  schedule_time_label: string | null;
  schedule_proposed_by: string | null;
  schedule_confirmed_by_buyer: boolean;
  handover_code: string | null;
  received_photo_url: string | null;
  received_at: string | null;
  cancel_reason: string | null;
  dispute: {
    reason: string;
    opened_by: string | null;
    opened_at: string;
  } | null;
  missed_meeting_reported_at?: string | null;
  review?: {
    rating: number;
    is_condition_accurate: boolean | null;
    tags: string[];
    comment: string | null;
    created_at: string;
  } | null;
  items: Array<{
    book_id: string;
    title: string;
    price: number;
    cover_image_url: string;
    grade?: string;
  }>;
  buyer: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    phone_number: string | null;
    no_show_count: number;
  };
  seller: {
    id: string;
    nickname: string;
    shop_name: string | null;
    avatar_url: string | null;
    verified_name: string | null;
    is_verified_seller: boolean;
  };
  delivery_details: {
    recipient_name: string;
    recipient_phone: string | null;
    province: string | null;
    delivery_address: string;
    courier_name: string | null;
    tracking_number: string | null;
    parcel_image_url: string | null;
    shipped_at: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface BackendOrderMessage {
  id: string;
  orderId: string;
  senderId: string | null;
  senderRole: string;
  kind: string;
  text: string;
  isMasked: boolean;
  createdAt: string;
}

export interface BackendNotification {
  id: string;
  userId: string;
  role: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AppNotificationItem {
  id: string;
  type: 'order' | 'system' | 'credit';
  title: string;
  message: string;
  createdAt: string;
  linkUrl: string;
  isRead: boolean;
}

export interface BackendCreditLedgerRow {
  id: string;
  amount: number;
  balance_after: number | null;
  type: string;
  order_id: string | null;
  note: string | null;
  created_at: string;
}

export function mapMeetupPoint(p: BackendMeetupPoint): MeetupPoint {
  return {
    id: p.id,
    name: p.name,
    province: p.province,
    lat: Number(p.lat),
    lng: Number(p.lng),
    note: p.note ?? undefined,
  };
}

export function mapBackendBookToBook(item: BackendBookFeedItem): Book {
  const deliveryMethods: Book['deliveryMethods'] = [];
  if (item.allowPickup !== false) deliveryMethods.push('MEETUP');
  if (item.allowDelivery) deliveryMethods.push('PARCEL');
  if (deliveryMethods.length === 0) deliveryMethods.push('MEETUP');

  const cover = item.coverImageUrl || FALLBACK_BOOK_COVER;
  const sellerDisplay = item.seller.shopName || item.seller.nickname || 'ร้านค้ากองดอง';

  return {
    id: item.id,
    title: item.title,
    author: item.author || 'ไม่ระบุผู้แต่ง',
    categories: item.categories?.length ? item.categories : item.category ? [item.category] : [],
    isSet: Boolean(item.isSet),
    totalVolumes: item.totalVolumes ?? undefined,
    price: Number(item.price),
    originalPrice: item.originalPrice ?? undefined,
    grade: toUiBookGrade(item.grade),
    checklist: conditionAnswersToChecklist(null),
    photos: {
      cover,
      back: cover,
      spine: cover,
      nameTag: cover,
    },
    sellerId: item.seller.id,
    sellerName: sellerDisplay,
    sellerRating: 5.0,
    sellerAvatar: item.seller.avatarUrl || undefined,
    isPromptPayVerified: Boolean(item.seller.isVerifiedSeller),
    deliveryMethods,
    meetupZones: item.pickupLocationName ? [item.pickupLocationName] : [],
    createdAt: '',
    shopPayeeVerified: Boolean(item.seller.isVerifiedSeller),
    codEnabled: item.codEnabled !== false,
  };
}

export function mapBackendBookDetailToBook(detail: BackendBookDetail): Book {
  const base = mapBackendBookToBook(detail);
  const images = detail.images ?? [];
  const byType = (type: string) =>
    images.find((img) => img.imageType === type)?.imageUrl;

  const cover =
    byType('FRONT_COVER') ||
    images.find((img) => img.isCover)?.imageUrl ||
    detail.coverImageUrl ||
    FALLBACK_BOOK_COVER;
  const back = byType('BACK_COVER') || cover;
  const spine = byType('SPINE') || cover;
  const inner = byType('INNER') || byType('EDGE') || cover;
  const defectUrls = images
    .filter((img) => img.imageType === 'DEFECT')
    .map((img) => img.imageUrl);

  const mappedDefects = (detail.defects ?? [])
    .filter((d) => Boolean(d.photo || d.note || d.label))
    .map((d, idx) => ({
      label: d.label || d.note || `จุดตำหนิ #${idx + 1}`,
      photo: d.photo || defectUrls[idx] || cover,
    }));

  if (defectUrls.length > mappedDefects.length) {
    for (let idx = mappedDefects.length; idx < defectUrls.length; idx++) {
      mappedDefects.push({
        label: `จุดตำหนิ #${idx + 1}`,
        photo: defectUrls[idx],
      });
    }
  }

  return {
    ...base,
    isbn: detail.isbn,
    publisher: detail.publisher || undefined,
    description: detail.description || undefined,
    checklist: conditionAnswersToChecklist(detail.conditionAnswers),
    photos: {
      cover,
      back,
      spine,
      nameTag: inner,
      defects: defectUrls.length ? defectUrls : mappedDefects.map((d) => d.photo),
    },
    defects: mappedDefects,
    status: detail.status,
    codEnabled: detail.codEnabled !== false,
  };
}

export function mapBackendStatusToListingStatus(status: string): ListingStatus {
  switch (status) {
    case 'HIDDEN':
      return 'HIDDEN';
    case 'RESERVED':
      return 'WAITING_PAYMENT';
    case 'SOLD':
      return 'CLOSED';
    case 'AVAILABLE':
    default:
      return 'ACTIVE';
  }
}

export function mapBackendUserBookToSellerListing(
  item: BackendUserBookItem,
  shop: ShopSettings | null,
  user: { id: string; displayName: string; pictureUrl?: string; isVerifiedSeller: boolean }
): SellerListing {
  const cover = item.coverImageUrl || FALLBACK_BOOK_COVER;
  const deliveryMethods: ('MEETUP' | 'PARCEL')[] = [];
  if (item.allowPickup ?? true) deliveryMethods.push('MEETUP');
  if (item.allowDelivery) deliveryMethods.push('PARCEL');
  if (deliveryMethods.length === 0) deliveryMethods.push('MEETUP');

  return {
    id: item.id,
    title: item.title,
    author: '',
    description: item.description ?? undefined,
    categories: item.categories?.length ? item.categories : item.category ? [item.category] : [],
    isSet: Boolean(item.isSet),
    totalVolumes: item.totalVolumes ?? undefined,
    price: Number(item.price),
    grade: toUiBookGrade(item.grade),
    checklist: conditionAnswersToChecklist(null),
    photos: {
      cover,
      back: cover,
      spine: cover,
      nameTag: cover,
    },
    sellerId: user.id,
    sellerName: shop?.shopName || 'ร้านค้ากองดอง',
    sellerRating: 0,
    sellerAvatar: shop?.avatar,
    isPromptPayVerified: shop?.payeeVerified ?? user.isVerifiedSeller,
    deliveryMethods,
    meetupZones: shop?.meetupPoints.map((p) => p.name) ?? [],
    createdAt: new Date(item.createdAt).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
    }),
    status: mapBackendStatusToListingStatus(item.status),
    views: 0,
    savedCount: 0,
  };
}

export function mapBackendShopToShopSettings(
  res: BackendMyShopResponse
): ShopSettings | null {
  if (!res.shop) return null;
  return {
    shopName: res.shop.shop_name,
    description: res.shop.description ?? '',
    avatar: res.shop.avatar_url ?? undefined,
    province: res.shop.province,
    meetupPoints: (res.shop.meetup_points ?? []).map(mapMeetupPoint),
    availableDays: res.shop.available_days ?? [],
    availableSlots: res.shop.available_slots ?? [],
    supportsParcel: Boolean(res.shop.supports_parcel),
    shipMode: (res.shop.ship_mode === 'DAILY' ? 'DAILY' : 'AFTER_ACCEPT') as ShipMode,
    shipWithinDays: res.shop.ship_within_days ?? 2,
    payeeVerified: Boolean(res.is_verified_seller),
    kyc: res.kyc
      ? {
          firstName: res.kyc.first_name ?? '',
          lastName: res.kyc.last_name ?? '',
          nationalIdMasked: res.kyc.national_id_masked ?? '',
          verifiedAt: res.kyc.verified_at,
        }
      : undefined,
    setupComplete: Boolean(res.shop.setup_complete),
  };
}

export function mapPublicShopToShopProfile(
  shop: BackendPublicShopResponse,
  reviewsRes?: BackendReviewsResponse | null
): ShopProfile {
  const mappedReviews: Review[] = (reviewsRes?.reviews ?? []).map((r) => ({
    id: r.id,
    author: r.reviewer.nickname || 'ผู้ซื้อกองดอง',
    avatar: r.reviewer.avatar_url || undefined,
    rating: r.rating,
    comment: r.comment || '',
    gradeMatched: r.is_condition_accurate ?? true,
    createdAt: new Date(r.created_at).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  }));

  const yearBE = new Date(shop.member_since).getFullYear() + 543;

  return {
    id: shop.seller_id || shop.id,
    shopName: shop.shop_name,
    avatar: shop.avatar_url || undefined,
    rating: reviewsRes?.summary?.total_reviews
      ? reviewsRes.summary.average_rating
      : shop.rating,
    completedSales: shop.completed_sales,
    payeeVerified: Boolean(shop.payee_verified),
    memberSince: isNaN(yearBE) ? '2569' : String(yearBE),
    meetupZones: (shop.meetup_points ?? []).map((p) => p.name),
    supportsParcel: Boolean(shop.supports_parcel),
    reviews: mappedReviews,
    province: shop.province,
    meetupPoints: (shop.meetup_points ?? []).map(mapMeetupPoint),
    availableDays: shop.available_days ?? [],
    availableSlots: shop.available_slots ?? [],
    bookedPickupSlots: (shop.booked_pickup_slots ?? []).map((slot) => ({
      dateISO: slot.date_iso,
      timeLabel: slot.time_label,
    })),
    shipMode: (shop.ship_mode === 'DAILY' ? 'DAILY' : 'AFTER_ACCEPT') as ShipMode,
    shipWithinDays: shop.ship_within_days ?? 2,
  };
}

export function mapPublicShopListingsToBooks(
  shop: BackendPublicShopResponse
): Book[] {
  return (shop.listings ?? []).map((item) =>
    mapBackendBookToBook({
      id: item.id,
      title: item.title,
      author: item.author,
      coverImageUrl: item.cover_image_url,
      price: item.price,
      originalPrice: null,
      grade: item.grade,
      isSet: item.is_set,
      allowPickup: (shop.meetup_points?.length ?? 0) > 0,
      allowDelivery: shop.supports_parcel,
      pickupLocationName: shop.meetup_points?.[0]?.name ?? null,
      seller: {
        id: shop.seller_id,
        nickname: shop.shop_name,
        shopName: shop.shop_name,
        avatarUrl: shop.avatar_url,
        isVerifiedSeller: shop.payee_verified,
      },
    })
  );
}

export function mapBackendAddressToAddress(addr: BackendAddress): Address {
  return {
    id: addr.id,
    fullName: addr.full_name,
    province: addr.province,
    district: addr.district,
    subdistrict: addr.subdistrict,
    postalCode: addr.postal_code,
    detail: addr.detail,
    isDefault: Boolean(addr.is_default),
  };
}

export function mapBackendOrderDetailToV4Order(
  detail: BackendOrderDetail
): V4Order {
  const delivery = detail.shipping_method === 'PICKUP' ? 'MEETUP' : 'PARCEL';
  const total = Number(detail.total_price);
  const shippingFee = Number(detail.shipping_fee);
  const amount = Math.max(0, total - shippingFee);

  const hasSchedule =
    delivery === 'MEETUP' &&
    (detail.schedule_date_iso || detail.scheduled_at || detail.pickup_location_name);

  const fallbackDateISO = detail.scheduled_at
    ? new Date(detail.scheduled_at).toISOString().slice(0, 10)
    : new Date(detail.created_at).toISOString().slice(0, 10);

  const schedule: V4Schedule | undefined = hasSchedule
    ? {
        dateISO: detail.schedule_date_iso || fallbackDateISO,
        timeLabel: detail.schedule_time_label || 'ตามเวลาที่นัดหมาย',
        lat: detail.pickup_lat ?? 18.8023,
        lng: detail.pickup_lng ?? 98.9524,
        landmark: detail.pickup_location_name || 'จุดนัดรับ',
        proposedBy: (detail.schedule_proposed_by === 'SELLER' ? 'SELLER' : 'BUYER') as ViewRole,
        confirmedByBuyer: Boolean(detail.schedule_confirmed_by_buyer),
      }
    : undefined;

  return {
    id: detail.id,
    status: detail.status as V4OrderStatus,
    delivery,
    buyerId: detail.buyer.id,
    buyer: {
      nickname: detail.buyer.nickname,
      avatar: detail.buyer.avatar_url ?? undefined,
      rating: 5,
      completedOrders: 0,
      noShows: detail.buyer.no_show_count ?? 0,
    },
    shopId: detail.seller.id,
    shop: {
      shopName: detail.seller.shop_name || detail.seller.nickname,
      avatar: detail.seller.avatar_url ?? undefined,
      rating: 5,
      completedSales: 0,
      payeeVerified: Boolean(detail.seller.is_verified_seller),
    },
    books: (detail.items ?? []).map((item) => ({
      id: item.book_id,
      title: item.title,
      cover: item.cover_image_url || FALLBACK_BOOK_COVER,
      grade: toV4Grade(item.grade || 'LIKE_NEW'),
      price: Number(item.price),
    })),
    amount,
    shippingFee,
    total,
    createdAtISO: detail.created_at,
    updatedAtISO: detail.updated_at,
    schedule,
    shipping: detail.delivery_details
      ? {
          carrier: detail.delivery_details.courier_name ?? undefined,
          trackingNumber: detail.delivery_details.tracking_number ?? undefined,
          boxPhoto: detail.delivery_details.parcel_image_url ?? undefined,
          receiverName: detail.delivery_details.recipient_name,
          receiverPhone: detail.delivery_details.recipient_phone ?? undefined,
          receiverAddress: detail.delivery_details.delivery_address,
        }
      : undefined,
    handoverCode: detail.handover_code ?? undefined,
    dispute: detail.dispute
      ? {
          reason: detail.dispute.reason,
          openedBy: (detail.dispute.opened_by === 'SELLER' ? 'SELLER' : 'BUYER') as ViewRole,
          openedAtISO: detail.dispute.opened_at,
        }
      : undefined,
    missedMeetingReportedAtISO: detail.missed_meeting_reported_at ?? undefined,
    cancelReason: detail.cancel_reason ?? undefined,
    review: detail.review
      ? {
          rating: detail.review.rating,
          isGradeMatched: Boolean(detail.review.is_condition_accurate),
          tags: detail.review.tags ?? [],
          comment: detail.review.comment ?? '',
          reviewedAtISO: detail.review.created_at,
        }
      : undefined,
    receivedPhoto: detail.received_photo_url ?? undefined,
    receivedAtISO: detail.received_at ?? undefined,
    creditSpent: detail.status !== 'REQUESTED' && detail.status !== 'REJECTED',
  };
}

export function mapBackendOrderMessageToChatMessage(
  msg: BackendOrderMessage
): ChatMessage {
  const from =
    msg.senderRole === 'SELLER'
      ? 'SELLER'
      : msg.senderRole === 'BUYER'
      ? 'BUYER'
      : 'SELLER';

  return {
    id: msg.id,
    orderId: msg.orderId,
    from,
    text: msg.text,
    sentAtISO: msg.createdAt,
    kind:
      msg.kind === 'SCHEDULE_CARD'
        ? 'SCHEDULE_CARD'
        : msg.kind === 'SYSTEM' || msg.senderRole === 'SYSTEM'
        ? 'SYSTEM'
        : 'TEXT',
  };
}

export function mapBackendNotificationToItem(
  n: BackendNotification
): AppNotificationItem {
  const typeLower = n.type.toLowerCase();
  const mappedType =
    typeLower === 'order' ||
    typeLower === 'credit'
      ? typeLower
      : 'system';

  return {
    id: n.id,
    type: mappedType,
    title: n.title,
    message: n.message,
    createdAt: new Date(n.createdAt).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    linkUrl: n.linkUrl || '/orders',
    isRead: Boolean(n.isRead),
  };
}

const BACKEND_CREDIT_TYPE_MAP: Record<string, CreditReason> = {
  SIGNUP_BONUS: 'SIGNUP_BONUS',
  ACCEPT_ORDER: 'ACCEPT_ORDER',
  ORDER_ACCEPT: 'ACCEPT_ORDER',
  NO_SHOW_REFUND: 'NO_SHOW_REFUND',
  REFUND_CANCEL: 'REFUND_CANCEL',
  REFUND_DISPUTE: 'NO_SHOW_REFUND',
  TOPUP: 'TOPUP',
};

export function mapBackendCreditLedgerRow(
  row: BackendCreditLedgerRow
): CreditEntry {
  const reason: CreditReason = BACKEND_CREDIT_TYPE_MAP[row.type] ?? 'TOPUP';
  const fallbackBalance =
    row.balance_after !== null && row.balance_after !== undefined
      ? row.balance_after
      : reason === 'SIGNUP_BONUS'
      ? row.amount
      : 0;

  return {
    id: row.id,
    atISO: row.created_at,
    reason,
    delta: row.amount,
    balanceAfter: fallbackBalance,
    orderId: row.order_id ?? undefined,
    note: row.note ?? undefined,
  };
}
