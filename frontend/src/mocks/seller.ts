import { CreditPackage, SellerListing, SellerOrder } from '@/types';
import { MOCK_BOOKS, MOCK_ADDRESSES } from './books';

export const MOCK_SELLER_LISTINGS: SellerListing[] = [
  {
    ...MOCK_BOOKS[0],
    id: 'listing-01',
    status: 'ACTIVE',
    views: 148,
    savedCount: 12,
  },
  {
    ...MOCK_BOOKS[2],
    id: 'listing-02',
    status: 'ACTIVE',
    views: 96,
    savedCount: 7,
  },
  {
    ...MOCK_BOOKS[1],
    id: 'listing-03',
    status: 'WAITING_PAYMENT',
    views: 214,
    savedCount: 18,
  },
  {
    ...MOCK_BOOKS[3],
    id: 'listing-04',
    status: 'CLOSED',
    views: 302,
    savedCount: 21,
  },
];

export const MOCK_SELLER_ORDERS: SellerOrder[] = [
  {
    id: 'ORD-20001',
    buyerId: 'usr_tham',
    buyerName: 'ธาม นักอ่าน',
    buyerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    buyerNote: 'ขอโอนพร้อมเพย์หน้างานนะครับ',
    sellerId: 'seller-01',
    books: [MOCK_BOOKS[0], MOCK_BOOKS[2]],
    totalAmount: 365,
    shippingFee: 0,
    deliveryMethod: 'MEETUP',
    meetupDetails: {
      zone: 'หน้าหอสมุดกลาง มช.',
      scheduledAt: 'วันศุกร์ 13 พ.ย. 16:30 น.',
      note: 'ใส่เสื้อสีน้ำเงิน ถือถุงผ้าลายแมว',
    },
    status: 'PENDING_ACCEPT',
    createdAt: '12 พ.ย. 2569, 10:15',
  },
  {
    id: 'ORD-20002',
    buyerId: 'usr_bio',
    buyerName: 'บีโอ สายช้อป',
    buyerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    sellerId: 'seller-01',
    books: [MOCK_BOOKS[1]],
    totalAmount: 1930,
    shippingFee: 80,
    deliveryMethod: 'PARCEL',
    shippingAddress: MOCK_ADDRESSES[0],
    status: 'PENDING_ACCEPT',
    createdAt: '12 พ.ย. 2569, 09:40',
  },
  {
    id: 'ORD-20003',
    buyerId: 'usr_iq',
    buyerName: 'ไอคิว มือใหม่',
    buyerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    sellerId: 'seller-01',
    books: [MOCK_BOOKS[3]],
    totalAmount: 130,
    shippingFee: 0,
    deliveryMethod: 'MEETUP',
    meetupDetails: {
      zone: 'ประตูหน้า มช.',
      scheduledAt: 'วันเสาร์ 14 พ.ย. 10:00 - 11:30 น.',
    },
    status: 'WAITING_PAYMENT',
    createdAt: '11 พ.ย. 2569, 18:02',
    acceptedAt: '11 พ.ย. 2569, 18:20',
  },
  {
    id: 'ORD-20004',
    buyerId: 'usr_bank',
    buyerName: 'แบงก์ นักล่าหนังสือ',
    buyerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
    sellerId: 'seller-01',
    books: [MOCK_BOOKS[2]],
    totalAmount: 215,
    shippingFee: 40,
    deliveryMethod: 'PARCEL',
    shippingAddress: MOCK_ADDRESSES[1],
    status: 'PAYMENT_SUBMITTED',
    createdAt: '10 พ.ย. 2569, 13:12',
    acceptedAt: '10 พ.ย. 2569, 13:30',
  },
  {
    id: 'ORD-20005',
    buyerId: 'usr_mintra',
    buyerName: 'มินตรา สะสม',
    buyerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    sellerId: 'seller-01',
    books: [MOCK_BOOKS[1]],
    totalAmount: 1930,
    shippingFee: 80,
    deliveryMethod: 'PARCEL',
    shippingAddress: MOCK_ADDRESSES[0],
    trackingNumber: 'TH0987654321CM',
    status: 'COMPLETED',
    createdAt: '6 พ.ย. 2569, 11:00',
    acceptedAt: '6 พ.ย. 2569, 11:12',
  },
];

export const MOCK_CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 3,
    price: 20,
    note: 'ลองขาย 3 ออเดอร์',
  },
  {
    id: 'bookworm',
    name: 'Bookworm',
    credits: 10,
    price: 50,
    note: 'คุ้มที่สุด · ฿5 ต่อออเดอร์',
    isPopular: true,
  },
  {
    id: 'merchant',
    name: 'Merchant',
    credits: 25,
    price: 100,
    note: 'สำหรับร้านที่ขายเยอะ',
  },
];

export const SELLER_MEETUP_ZONES = [
  'หน้าหอสมุดกลาง มช.',
  'ประตูหน้า มช.',
  'หอพักนักศึกษา ชาย/หญิง',
  'คณะวิศวกรรมศาสตร์',
  'คณะมนุษยศาสตร์',
];

export const REPORT_REASONS = [
  'ผู้ซื้อไม่มาตามนัด',
  'ผู้ซื้อไม่ชำระเงิน',
  'หนังสือเสียหายระหว่างส่ง',
  'ผู้ซื้อไม่ตอบข้อความ',
  'อื่น ๆ',
];

export const GRADE_CRITERIA = [
  {
    grade: 'A',
    title: 'เหมือนใหม่',
    percent: 75,
    detail: 'ไม่มีตำหนิเลยทั้ง 5 จุด',
  },
  {
    grade: 'B',
    title: 'สภาพดีมาก',
    percent: 60,
    detail: 'มีตำหนิ 1 จุด และเป็นเพียงรอยใช้งานเล็กน้อย',
  },
  {
    grade: 'C',
    title: 'อ่านทั่วไป',
    percent: 45,
    detail: 'มีรอยเปื้อนหรือรอยเขียน 1 จุด หรือมีตำหนิ 2 จุด',
  },
  {
    grade: 'D',
    title: 'เน้นอ่าน',
    percent: 30,
    detail: 'มีตำหนิ 3 จุดขึ้นไป หรือหน้ากระดาษหลุด/ซ่อมเทป',
  },
];
