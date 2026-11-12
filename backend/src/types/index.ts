// Shared Type Definitions for GongDong Backend

export type BookGrade = 'LIKE_NEW' | 'GENTLY_READ' | 'WELL_LOVED' | 'WORN_BUT_READABLE';

export type BookListingStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';

export type ShippingMethod = 'PICKUP' | 'DELIVERY';

export type OrderStatus =
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

export type SlipType = 'ORDER_PAYMENT' | 'CREDIT_TOPUP';

export type VerificationStatus =
  | 'PENDING_VERIFY'
  | 'AUTO_VERIFIED'
  | 'PENDING_ADMIN'
  | 'REJECTED';

export interface ConditionAnswers {
  spine: boolean; // สันหนังสือ: รอยพับ รอยย่น งอ
  stains: boolean; // รอยเปื้อน: คราบน้ำ จุดเหลือง
  markings: boolean; // รอยขีดเขียน: ดินสอ ปากกา ไฮไลต์
  covers: boolean; // ปกหน้า-ปกหลัง: ยับ ฉีกขาด ถลอก
  pages: boolean; // หน้ากระดาษ: หลุด ขาด แปะเทปซ่อม
}
