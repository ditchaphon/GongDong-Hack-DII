/**
 * GongDong v4 domain model.
 *
 * These types are the v4 rulebook's order/credit model. They live next to the
 * legacy `@/types` model while screens are migrated in Phase 2–4.
 *
 * Rules encoded here:
 * - no phone / LINE ID / bank account / slip real name on any shared object
 * - buyer identity is nickname + avatar
 * - seller identity is shop name + avatar (never a LINE profile)
 */

export type V4Grade =
  | 'LIKE_NEW'
  | 'GENTLY_READ'
  | 'WELL_LOVED'
  | 'WORN_BUT_READABLE';

export type V4Delivery = 'MEETUP' | 'PARCEL';

export type V4OrderStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'PAID'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPUTED';

export type ViewRole = 'BUYER' | 'SELLER';

export type SlipCheckState =
  | 'NONE'
  | 'CHECKING'
  | 'PASSED'
  | 'FAILED'
  | 'ADMIN_REVIEW';

export type CreditReason =
  | 'SIGNUP_BONUS'
  | 'ACCEPT_ORDER'
  | 'NO_SHOW_REFUND'
  | 'TOPUP';

/** Public identity — safe to show to the other side. */
export interface PublicIdentity {
  nickname: string;
  avatar?: string;
  rating: number;
  completedOrders: number;
  /** Seller view only: how many meetups this buyer missed. */
  noShows?: number;
}

export interface ShopIdentity {
  shopName: string;
  avatar?: string;
  rating: number;
  completedSales: number;
  /** Verified payee name from a real bank slip; boolean only, never the name. */
  payeeVerified: boolean;
  /** Unverified shops can do meetup + cash only. */
  shopAgeDays?: number;
}

export interface V4BookSnapshot {
  id: string;
  title: string;
  author?: string;
  cover: string;
  grade: V4Grade;
  price: number;
}

export interface V4Schedule {
  /** ISO date of the meetup day. */
  dateISO: string;
  timeLabel: string;
  lat: number;
  lng: number;
  landmark: string;
  proposedBy: ViewRole;
  confirmedByBuyer: boolean;
}

export interface V4Shipping {
  carrier?: string;
  trackingNumber?: string;
  boxPhoto?: string;
  /** Delivery fields: seller may read these only in PAID / SHIPPED. */
  receiverName?: string;
  receiverPhone?: string;
}

export interface V4Order {
  id: string;
  status: V4OrderStatus;
  delivery: V4Delivery;
  buyer: PublicIdentity;
  shop: ShopIdentity;
  books: V4BookSnapshot[];
  amount: number;
  shippingFee: number;
  total: number;
  createdAtISO: string;
  /** Last status change; all v4 timers count from here. */
  updatedAtISO: string;
  schedule?: V4Schedule;
  shipping?: V4Shipping;
  slipCheck: SlipCheckState;
  slipUploadedAtISO?: string;
  /**
   * Buyer-side secret. Never pass this to a seller view.
   * In production it is stored server-side and shown only to the buyer.
   */
  handoverCode?: string;
  handoverCodeVerifiedAtISO?: string;
  dispute?: {
    reason: string;
    openedBy: ViewRole;
    openedAtISO: string;
  };
  cancelReason?: string;
  /** 1 credit was spent on this order (refundable only via no-show flow). */
  creditSpent: boolean;
  review?: {
    rating: number;
    isGradeMatched: boolean;
    tags: string[];
    comment: string;
    reviewedAtISO: string;
  };
}

export interface CreditEntry {
  id: string;
  atISO: string;
  reason: CreditReason;
  /** Negative for spend, positive for gain. */
  delta: number;
  balanceAfter: number;
  orderId?: string;
  note?: string;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  note: string;
  isPopular?: boolean;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  from: ViewRole;
  text: string;
  sentAtISO: string;
  /** System messages are centred and never masked. */
  kind?: 'TEXT' | 'SYSTEM' | 'SCHEDULE_CARD';
}
