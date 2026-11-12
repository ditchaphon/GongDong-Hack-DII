// =============================================================================
// GongDong (กองดอง) - Core Services Type Definitions
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
  discountPercent: number; // สัดส่วนราคาเทียบราคาปก (0.75, 0.60, 0.45, 0.30)
  recommendedPrice: number; // ราคาแนะนำหลังคำนวณและปัดเศษทศนิยม 2 ตำแหน่ง
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
 * ผลลัพธ์จากการสร้าง PromptPay QR Code
 */
export interface PromptPayQRResult {
  qrDataUrl: string; // Base64 Data URL (data:image/png;base64,...)
  payload: string; // Raw EMVCo payload string
}

/**
 * ประเภทข้อมูลส่วนตัวที่ถูกตรวจจับใน Data Masking
 */
export type SensitiveDataType = 'PHONE' | 'BANK_ACCOUNT' | 'LINE_ID';

/**
 * ผลลัพธ์จากการตรวจจับและเซ็นเซอร์ข้อมูลส่วนตัวในข้อความ
 */
export interface MaskingResult {
  maskedText: string; // ข้อความที่เซ็นเซอร์ข้อมูลส่วนตัวเป็น ••• แล้ว
  hasMaskedData: boolean; // มีข้อมูลติดต่อต้องห้ามปนมาหรือไม่
  detectedTypes: SensitiveDataType[]; // ประเภทของข้อมูลที่ตรวจพบ
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

/**
 * ผลลัพธ์จากการตอบรับคำสั่งซื้อ (acceptOrder)
 */
export interface AcceptOrderResult {
  orderId: string;
  status: 'ACCEPTED';
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
}

/**
 * ผลลัพธ์จากการบันทึกนัดหมายรับหนังสือ
 */
export interface SchedulePickupResult {
  orderId: string;
  status: 'SCHEDULED';
  scheduledAt: Date;
  handoverCode: string;
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
 * ชนิดของรูปถ่ายหนังสือ
 */
export type BookImageType =
  | 'FRONT_COVER'
  | 'BACK_COVER'
  | 'SPINE'
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

/**
 * ข้อมูล Input สำหรับสร้างรายการลงขายหนังสือ (POST /api/books)
 */
export interface CreateBookListingInput {
  isbn: string;
  title: string;
  author?: string | null;
  publisher?: string | null;
  category?: string;
  coverUrl?: string | null;
  originalPrice?: number | null;
  price: number;
  conditionAnswers: ConditionAnswers;
  allowPickup?: boolean;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupLocationName?: string | null;
  allowDelivery?: boolean;
  images: BookImageInput[];
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
  coverImageUrl: string;
  price: number;
  originalPrice: number | null;
  grade: BookGrade;
  allowPickup: boolean;
  pickupLocationName: string | null;
  allowDelivery: boolean;
  seller: {
    id: string;
    nickname: string | null;
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
  status: string;
  seller: {
    id: string;
    nickname: string | null;
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
  category: string;
  price: number;
  grade: BookGrade;
  coverImageUrl: string;
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
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupLocationName?: string;
}

/**
 * ผลลัพธ์จากการสร้างคำสั่งซื้อ
 */
export interface CreateOrderResult {
  orderId: string;
  totalPrice: number;
  shippingFee: number;
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
  shippingFee: number;
  totalPrice: number;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupLocationName: string | null;
  scheduledAt: Date | null;
  handoverCode?: string | null;
  items: Array<{
    bookId: string;
    title: string;
    price: number;
    coverImageUrl: string;
  }>;
  buyer: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
    phoneNumber?: string | null;
  };
  seller: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
    promptpayId: string | null;
    verifiedName: string | null;
    isVerifiedSeller: boolean;
  };
  deliveryDetails: {
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    courierName: string | null;
    trackingNumber: string | null;
    parcelImageUrl: string | null;
    shippedAt: Date | null;
  } | null;
  createdAt: Date;
}

/**
 * สรุปคำสั่งซื้อสำหรับหน้ารายการ (Buying & Selling Orders)
 */
export interface OrderSummaryItem {
  id: string;
  status: string;
  shippingMethod: string;
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
 * ข้อมูลสำหรับแนบสลิปชำระเงิน (POST /api/orders/:id/payment-slip)
 */
export interface PaymentSlipInput {
  slipImageUrl: string;
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
}

/**
 * ข้อมูลสำหรับแนบสลิปเติมเครดิต (POST /api/users/me/topup-slip)
 */
export interface TopupSlipInput {
  slip_image_url: string;
}

/**
 * ผลลัพธ์จากการเติมเครดิตและทำ Frictionless KYC Level 2 (POST /api/users/me/topup-slip)
 */
export interface TopupSlipResult {
  added_credits: number;
  total_credits: number;
  verified_name: string;
  is_verified_seller: boolean;
}

/**
 * Payload ที่ได้จากการ verify LINE ID token
 */
export interface LineTokenPayload {
  iss?: string;
  sub: string; // LINE user ID
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
  rating: number; // 1 to 5
  is_condition_accurate?: boolean; // บังคับสำหรับผู้ซื้อ
  comment?: string;
}

/**
 * สรุปคะแนนและความน่าเชื่อถือของผู้ขาย (Trust Metrics)
 */
export interface ReviewSummary {
  average_rating: number; // e.g. 4.8
  total_reviews: number;
  condition_accuracy_rate: number | null; // e.g. 96.5 หรือ null ถ้าไม่มีผู้ซื้อรีวิว
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



