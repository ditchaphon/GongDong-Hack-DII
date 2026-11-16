// =============================================================================
// GongDong (กองดอง) - Core Services Type Definitions (v3.0.0)
// =============================================================================

/**
 * ผลตรวจสภาพหนังสือ 5 จุด
 */
export interface ConditionAnswers {
  spine: boolean; // สันหนังสือ: รอยพับ รอยย่น งอ
  stains: boolean; // รอยเปื้อน: คราบน้ำ จุดเหลือง
  markings: boolean; // รอยขีดเขียน: ดินสอ ปากกา ไฮไลต์
  covers: boolean; // ปกหน้า-ปกหลัง: ยับ ฉีกขาด ถลอก
  pages: boolean; // หน้ากระดาษ: หลุด ขาด แปะเทปซ่อม
}

/**
 * ระดับเกรดหนังสือ 4 ระดับ
 */
export type BookGrade =
  | 'LIKE_NEW'
  | 'GENTLY_READ'
  | 'WELL_LOVED'
  | 'WORN_BUT_READABLE';

/**
 * ผลลัพธ์จากการคำนวณเกรดและราคาแนะนำ
 */
export interface GradingResult {
  grade: BookGrade;
  discountPercent: number;
  recommendedPrice: number;
}

/**
 * ข้อมูลแคตตาล็อกหนังสือสากล (ตรงตาม schema book_catalog)
 */
export interface BookCatalogData {
  isbn: string;
  title: string;
  author: string | null;
  publisher: string | null;
  category: string | null;
  coverUrl: string | null;
  originalPrice: number | null;
}

/**
 * แหล่งที่มาของข้อมูลหนังสือจากการค้นหาด้วย ISBN
 */
export type BookCatalogSource = 'DATABASE' | 'GOOGLE_BOOKS' | 'OPEN_LIBRARY';

/**
 * ผลลัพธ์การค้นหา ISBN พร้อมระบุแหล่งที่มาและสถานะ fallback
 */
export interface IsbnLookupResult {
  found: boolean;
  isbn: string;
  source: BookCatalogSource | null;
  book: BookCatalogData | null;
  warningCode?: 'GOOGLE_BOOKS_RATE_LIMITED' | 'EXTERNAL_LOOKUP_FAILED';
  warningMessage?: string;
}

/**
 * ผลลัพธ์จากการสร้าง PromptPay QR Code
 */
export interface PromptPayQRResult {
  qrDataUrl: string;
  payload: string;
}

/**
 * ประเภทข้อมูลส่วนตัวที่ถูกตรวจจับใน Data Masking
 */
export type SensitiveDataType =
  | 'PHONE'
  | 'BANK_ACCOUNT'
  | 'LINE_ID'
  | 'EMAIL'
  | 'SOCIAL'
  | 'OFF_APP';

/**
 * ผลลัพธ์จากการตรวจจับและเซ็นเซอร์ข้อมูลส่วนตัวในข้อความ
 */
export interface MaskingResult {
  maskedText: string;
  hasMaskedData: boolean;
  detectedTypes: SensitiveDataType[];
}

/**
 * Custom Application Error รองรับ StatusCode และ Error Code ตาม API spec
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_SERVER_ERROR',
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type PaymentMethod = 'COD' | 'TRANSFER';
export type ViewRole = 'BUYER' | 'SELLER';

/**
 * ผลลัพธ์จากการตอบรับคำสั่งซื้อ (acceptOrder)
 */
export interface AcceptOrderResult {
  orderId: string;
  status: 'ACCEPTED' | 'SCHEDULED';
  remainingCredits: number;
  lockedBookIds: string[];
  rejectedOrderIds: string[];
}

/**
 * ข้อมูลสำหรับบันทึกนัดหมายรับหนังสือ (schedulePickupOrder)
 */
export interface SchedulePickupInput {
  scheduledAt: Date | string;
  pickupLat: number;
  pickupLng: number;
  pickupLocationName?: string;
  scheduleDateIso?: string;
  scheduleTimeLabel?: string;
  scheduleProposedBy?: ViewRole;
  scheduleConfirmedByBuyer?: boolean;
}

/**
 * ผลลัพธ์จากการบันทึกนัดหมายรับหนังสือ
 */
export interface SchedulePickupResult {
  orderId: string;
  status: 'SCHEDULED';
  scheduledAt: Date;
  handoverCode: string | null;
}

/**
 * ผลลัพธ์จากการตรวจสอบรหัสส่งมอบ 6 หลัก (verifyHandoverCode)
 */
export interface VerifyHandoverResult {
  orderId: string;
  status: 'COMPLETED';
  soldBookIds: string[];
}

/**
 * ชนิดของรูปถ่ายหนังสือ (รองรับทั้ง INNER v4 และ EDGE เดิม)
 */
export type BookImageType =
  | 'FRONT_COVER'
  | 'BACK_COVER'
  | 'SPINE'
  | 'INNER'
  | 'EDGE'
  | 'DEFECT';

/**
 * รูปแบบข้อมูลรูปภาพที่ส่งเข้ามาตอนลงขาย
 */
export interface BookImageInput {
  imageUrl: string;
  imageType: BookImageType;
  displayOrder: number;
  isCover?: boolean;
}

export interface BookDefectInput {
  id?: string;
  note: string;
  photo?: string;
}

/**
 * ข้อมูล Input สำหรับสร้างรายการลงขายหนังสือ (POST /api/books)
 */
export interface CreateBookListingInput {
  isbn: string;
  title: string;
  author?: string | null;
  publisher?: string | null;
  category?: string;
  categories?: string[];
  description?: string | null;
  isSet?: boolean;
  totalVolumes?: number | null;
  missingVolumes?: number[];
  defects?: BookDefectInput[];
  photoChecks?: Record<string, unknown>;
  coverUrl?: string | null;
  originalPrice?: number | null;
  price: number;
  conditionAnswers: ConditionAnswers;
  allowPickup?: boolean;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupLocationName?: string | null;
  allowDelivery?: boolean;
  codEnabled?: boolean;
  images: BookImageInput[];
}

/**
 * ข้อมูล Input สำหรับแก้ไขประกาศหนังสือ (PATCH /api/books/:id)
 */
export interface UpdateBookListingInput {
  price?: number;
  description?: string | null;
  categories?: string[];
  allowPickup?: boolean;
  allowDelivery?: boolean;
  codEnabled?: boolean;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupLocationName?: string | null;
  status?: 'AVAILABLE' | 'HIDDEN';
}

/**
 * ตัวกรองสำหรับการค้นหาและดึงฟีดหนังสือ (GET /api/books)
 */
export interface BookListingFilter {
  q?: string;
  category?: string;
  grade?: BookGrade;
  shipping?: 'PICKUP' | 'DELIVERY';
  limit?: number;
  offset?: number;
}

/**
 * รายการหนังสือสรุปสำหรับการแสดงผลเป็นการ์ดบน Feed
 */
export interface BookListingItem {
  id: string;
  title: string;
  author: string | null;
  category: string;
  categories: string[];
  isSet: boolean;
  totalVolumes: number | null;
  coverImageUrl: string;
  price: number;
  originalPrice: number | null;
  grade: BookGrade;
  allowPickup: boolean;
  pickupLocationName: string | null;
  allowDelivery: boolean;
  codEnabled: boolean;
  seller: {
    id: string;
    nickname: string | null;
    shopName: string | null;
    avatarUrl: string | null;
    isVerifiedSeller: boolean;
  };
}

/**
 * ข้อมูลรายละเอียดหนังสือเต็มรูปแบบสำหรับหน้า B2
 */
export interface BookListingDetail {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  publisher: string | null;
  category: string;
  categories: string[];
  isSet: boolean;
  totalVolumes: number | null;
  missingVolumes: number[];
  description: string | null;
  defects: unknown;
  photoChecks: unknown;
  originalPrice: number | null;
  price: number;
  grade: BookGrade;
  conditionAnswers: ConditionAnswers;
  images: Array<{
    id: string;
    imageUrl: string;
    imageType: string;
    displayOrder: number;
    isCover: boolean;
  }>;
  allowPickup: boolean;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupLocationName: string | null;
  allowDelivery: boolean;
  codEnabled: boolean;
  status: string;
  seller: {
    id: string;
    nickname: string | null;
    shopName: string | null;
    avatarUrl: string | null;
    isVerifiedSeller: boolean;
  };
}

/**
 * รายการหนังสือของฉัน (หน้าร้าน S4)
 */
export interface UserBookListingItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  categories: string[];
  isSet: boolean;
  totalVolumes: number | null;
  price: number;
  grade: BookGrade;
  coverImageUrl: string;
  allowPickup: boolean;
  allowDelivery: boolean;
  codEnabled: boolean;
  status: string;
  createdAt: Date;
}

/**
 * ข้อมูลสำหรับสร้างคำสั่งซื้อใหม่ (POST /api/orders)
 */
export interface CreateOrderInput {
  sellerId: string;
  bookIds: string[];
  shippingMethod: 'PICKUP' | 'DELIVERY';
  paymentMethod?: PaymentMethod;
  recipientName?: string;
  recipientPhone?: string | null;
  buyerProvince?: string;
  deliveryAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupLocationName?: string;
  scheduledAt?: Date | string;
  scheduleDateIso?: string;
  scheduleTimeLabel?: string;
  shipWithinDays?: number;
  expectedTotal?: number;
  idempotencyKey?: string;
}

/**
 * ข้อมูลสำหรับสร้างคำสั่งซื้อหลายร้านค้าพร้อมกันแบบ All-or-Nothing (POST /api/orders/batch)
 */
export interface CreateBatchOrdersInput {
  orders: CreateOrderInput[];
  idempotencyKey?: string;
}

/**
 * ผลลัพธ์จากการสร้างคำสั่งซื้อแบบ Batch
 */
export interface CreateBatchOrdersResult {
  orders: CreateOrderResult[];
}

/**
 * ผลลัพธ์จากการสร้างคำสั่งซื้อ
 */
export interface CreateOrderResult {
  orderId: string;
  totalPrice: number;
  shippingFee: number;
  paymentMethod: PaymentMethod;
  status: 'REQUESTED';
  createdAt: Date;
}

/**
 * ข้อมูลรายละเอียดคำสั่งซื้อ (GET /api/orders/:id)
 */
export interface OrderDetail {
  id: string;
  status: string;
  shippingMethod: string;
  paymentMethod: PaymentMethod;
  shippingFee: number;
  totalPrice: number;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupLocationName: string | null;
  scheduledAt: Date | null;
  scheduleDateIso: string | null;
  scheduleTimeLabel: string | null;
  scheduleProposedBy: string | null;
  scheduleConfirmedByBuyer: boolean;
  handoverCode?: string | null;
  receivedPhotoUrl: string | null;
  receivedAt: Date | null;
  missedMeetingReportedAt?: Date | null;
  cancelReason: string | null;
  dispute: {
    reason: string;
    openedBy: string | null;
    openedAt: Date;
  } | null;
  review?: {
    rating: number;
    isConditionAccurate: boolean | null;
    tags: string[];
    comment: string | null;
    createdAt: Date;
  } | null;
  items: Array<{
    bookId: string;
    title: string;
    price: number;
    coverImageUrl: string;
    grade?: BookGrade;
  }>;
  buyer: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
    phoneNumber?: string | null;
    noShowCount?: number;
  };
  seller: {
    id: string;
    nickname: string | null;
    shopName: string | null;
    avatarUrl: string | null;
    promptpayId: string | null;
    verifiedName: string | null;
    isVerifiedSeller: boolean;
  };
  deliveryDetails: {
    recipientName: string;
    recipientPhone: string | null;
    province: string | null;
    deliveryAddress: string;
    courierName: string | null;
    trackingNumber: string | null;
    parcelImageUrl: string | null;
    shippedAt: Date | null;
  } | null;
  paymentSlipUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * สรุปคำสั่งซื้อสำหรับหน้ารายการ (Buying & Selling Orders)
 */
export interface OrderSummaryItem {
  id: string;
  status: string;
  shippingMethod: string;
  paymentMethod: string;
  totalPrice: number;
  itemsCount: number;
  buyerNickname?: string | null;
  sellerNickname?: string | null;
  createdAt: Date;
}

/**
 * ข้อมูลสำหรับบันทึกจัดส่งพัสดุ (POST /api/orders/:id/ship)
 */
export interface ShipOrderInput {
  courierName: string;
  trackingNumber: string;
  parcelImageUrl?: string;
}

/**
 * ข้อมูลสำหรับผู้ซื้อถ่ายรูปยืนยันรับของและรีวิวพร้อมกัน (POST /api/orders/:id/receive)
 */
export interface ReceiveOrderInput {
  receivedPhotoUrl: string;
  review?: {
    rating: number;
    isConditionAccurate: boolean;
    tags?: string[];
    comment?: string;
  };
}

/**
 * ข้อมูลสำหรับแนบสลิปชำระเงิน (POST /api/orders/:id/payment-slip)
 */
export interface PaymentSlipInput {
  slipImageUrl: string;
  storagePath?: string;
  transRef?: string;
  amount?: number;
  receiverName?: string;
}

/**
 * ข้อมูลโปรไฟล์ผู้ใช้ (GET /api/users/me)
 */
export interface UserProfileResponse {
  id: string;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  nickname: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  verified_name: string | null;
  promptpay_id: string | null;
  is_verified_seller: boolean;
  is_admin?: boolean;
  pdpa_consent_at?: Date | null;
  no_show_count: number;
  credits: number;
  created_at: Date;
}

/**
 * ข้อมูลสำหรับอัปเดตโปรไฟล์ (PATCH /api/users/me)
 */
export interface UpdateUserProfileInput {
  nickname?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  promptpay_id?: string | null;
  pdpa_consent?: boolean;
}

/**
 * ข้อมูลสำหรับแนบสลิปเติมเครดิต (POST /api/users/me/topup-slip)
 */
export interface TopupSlipInput {
  slip_image_url: string;
  storage_path?: string;
  pack_id?: string;
  packId?: string;
}

/**
 * ผลลัพธ์จากการเติมเครดิตและทำ Frictionless KYC Level 2
 */
export interface TopupSlipResult {
  added_credits: number;
  total_credits: number;
  verified_name: string;
  is_verified_seller: boolean;
}

/**
 * ข้อมูลประวัติธุรกรรมเครดิต (GET /api/users/me/credits/history)
 */
export interface CreditLedgerItem {
  id: string;
  amount: number;
  balance_after: number | null;
  type: string;
  order_id: string | null;
  note: string | null;
  created_at: Date;
}

/**
 * Payload ที่ได้จากการ verify LINE ID token
 */
export interface LineTokenPayload {
  iss?: string;
  sub: string;
  aud?: string;
  exp?: number;
  iat?: number;
  name?: string;
  picture?: string;
  email?: string;
}

/**
 * ข้อมูลสำหรับส่งรีวิวคำสั่งซื้อ (POST /api/orders/:id/review)
 */
export interface CreateReviewInput {
  rating: number;
  is_condition_accurate?: boolean;
  tags?: string[];
  comment?: string;
}

/**
 * สรุปคะแนนและความน่าเชื่อถือของผู้ขาย (Trust Metrics)
 */
export interface ReviewSummary {
  average_rating: number;
  total_reviews: number;
  condition_accuracy_rate: number | null;
  rating_breakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

/**
 * ข้อมูลรีวิวรายชิ้น
 */
export interface ReviewItem {
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
  book_titles: string[];
  created_at: Date;
}

/**
 * ผลลัพธ์จากการดึงรายการรีวิวของผู้ใช้ (GET /api/users/:id/reviews)
 */
export interface UserReviewsResult {
  summary: ReviewSummary;
  reviews: ReviewItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

/**
 * Shop Profile & Meetup Points Types
 */
export interface UpsertShopInput {
  shopName: string;
  description?: string | null;
  avatarUrl?: string | null;
  province: string;
  availableDays: string[];
  availableSlots: string[];
  supportsParcel: boolean;
  shipMode?: 'DAILY' | 'AFTER_ACCEPT';
  shipWithinDays?: number;
}

export interface MeetupPointInput {
  name: string;
  province: string;
  lat: number;
  lng: number;
  note?: string | null;
}

export interface SellerKycInput {
  firstName: string;
  lastName: string;
  nationalId: string;
  pdpaConsent?: boolean;
}

/**
 * User Address Types (PDPA v4)
 */
export interface UserAddressInput {
  fullName?: string;
  full_name?: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode?: string;
  postal_code?: string;
  detail: string;
  isDefault?: boolean;
  is_default?: boolean;
}

/**
 * Upload Bucket Types
 */
export type UploadBucket =
  | 'book-listings'
  | 'avatars'
  | 'order-receives'
  | 'slips'
  | 'disputes';
