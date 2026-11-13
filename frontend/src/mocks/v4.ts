import { Book } from '@/types';
import {
  ChatMessage,
  CreditEntry,
  PublicIdentity,
  ShopIdentity,
  V4BookSnapshot,
  V4Grade,
  V4Order,
} from '@/types/v4';
import { MOCK_BOOKS } from './books';

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3600 * 1000).toISOString();

const daysAhead = (days: number): string => {
  const date = new Date(Date.now() + days * 24 * 3600 * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const snapshot = (book: Book, grade: V4Grade = 'GENTLY_READ'): V4BookSnapshot => ({
  id: book.id,
  title: book.title,
  author: book.author,
  cover: book.photos.cover,
  grade,
  price: book.price,
});

export const MOCK_BUYER: PublicIdentity = {
  nickname: 'สกายอ่านหนังสือ',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
  rating: 4.8,
  completedOrders: 12,
  noShows: 0,
};

export const MOCK_BUYER_2: PublicIdentity = {
  nickname: 'ธามสายมินต์',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
  rating: 4.9,
  completedOrders: 5,
  noShows: 1,
};

export const MOCK_SHOP: ShopIdentity = {
  shopName: 'ป้าหนอนหนังสือ',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
  rating: 4.9,
  completedSales: 34,
  payeeVerified: true,
  shopAgeDays: 120,
};

export const MOCK_SHOP_NEW: ShopIdentity = {
  shopName: 'ร้านหนังสือมือสองใหม่',
  rating: 4.6,
  completedSales: 0,
  payeeVerified: false,
  shopAgeDays: 2,
};

const SHOP_OTAKU: ShopIdentity = {
  shopName: 'OtaKu Bookshelf',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
  rating: 4.8,
  completedSales: 88,
  payeeVerified: true,
  shopAgeDays: 400,
};

const SHOP_CUTE: ShopIdentity = {
  shopName: 'หนังสือน่ารัก เชียงใหม่',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
  rating: 4.7,
  completedSales: 4,
  payeeVerified: false,
  shopAgeDays: 20,
};

const MEET_LIBRARY = {
  lat: 18.8023,
  lng: 98.9524,
  landmark: 'หน้าหอสมุดกลาง มช. ใต้ต้นไม้ใหญ่',
};

const MEET_GATE = {
  lat: 18.8004,
  lng: 98.9505,
  landmark: 'ประตูหน้า มช. ข้างป้ายมหาวิทยาลัย',
};

const BOX = 'https://images.unsplash.com/photo-1607166452427-7e4477079cb9?w=600';

/**
 * Buyer orders belong to MOCK_BUYER; everything else is a sale of MOCK_SHOP.
 * Meet-up:  REQUESTED → SCHEDULED (QR) → COMPLETED (review)
 * Parcel:   REQUESTED → ACCEPTED (pay) → PAID (ship by) → SHIPPED (tracking) → COMPLETED (photo + review)
 */
export const MOCK_V4_ORDERS: V4Order[] = [
  // ---------- Buying ----------
  {
    id: 'ORD-V4-1001',
    status: 'REQUESTED',
    delivery: 'MEETUP',
    buyer: MOCK_BUYER,
    shop: MOCK_SHOP,
    shopId: 'seller-01',
    books: [snapshot(MOCK_BOOKS[0], 'LIKE_NEW')],
    amount: 190,
    shippingFee: 0,
    total: 190,
    createdAtISO: hoursAgo(2),
    updatedAtISO: hoursAgo(2),
    schedule: {
      dateISO: daysAhead(1),
      timeLabel: 'เย็น 16–20 น.',
      ...MEET_LIBRARY,
      proposedBy: 'BUYER',
      confirmedByBuyer: true,
    },
    creditSpent: false,
  },
  {
    id: 'ORD-V4-1003',
    status: 'ACCEPTED',
    delivery: 'PARCEL',
    buyer: MOCK_BUYER,
    shop: SHOP_OTAKU,
    shopId: 'seller-02',
    books: [snapshot(MOCK_BOOKS[2], 'LIKE_NEW')],
    amount: 175,
    shippingFee: 50,
    total: 225,
    createdAtISO: hoursAgo(5),
    updatedAtISO: hoursAgo(4),
    shipWithinDays: 2,
    creditSpent: true,
    shipping: {
      receiverName: 'สกาย',
      receiverAddress: '239 ถ.ห้วยแก้ว ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
    },
  },
  {
    id: 'ORD-V4-1005',
    status: 'SCHEDULED',
    delivery: 'MEETUP',
    buyer: MOCK_BUYER,
    shop: MOCK_SHOP,
    shopId: 'seller-01',
    books: [snapshot(MOCK_BOOKS[0], 'LIKE_NEW')],
    amount: 190,
    shippingFee: 0,
    total: 190,
    createdAtISO: hoursAgo(26),
    updatedAtISO: hoursAgo(3),
    schedule: {
      dateISO: daysAhead(0),
      timeLabel: 'เย็น 16–20 น.',
      ...MEET_GATE,
      proposedBy: 'BUYER',
      confirmedByBuyer: true,
    },
    handoverCode: '482913',
    creditSpent: true,
  },
  {
    id: 'ORD-V4-1011',
    status: 'PAID',
    delivery: 'PARCEL',
    buyer: MOCK_BUYER,
    shop: SHOP_OTAKU,
    shopId: 'seller-02',
    books: [snapshot(MOCK_BOOKS[1], 'GENTLY_READ')],
    amount: 1850,
    shippingFee: 50,
    total: 1900,
    createdAtISO: hoursAgo(80),
    updatedAtISO: hoursAgo(18),
    shipWithinDays: 2,
    creditSpent: true,
    shipping: {
      carrier: 'Flash Express',
      trackingNumber: 'TH0987654321CM',
      boxPhoto: BOX,
      receiverName: 'สกาย',
      receiverAddress: '239 ถ.ห้วยแก้ว ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
    },
  },
  {
    id: 'ORD-V4-1008',
    status: 'COMPLETED',
    delivery: 'MEETUP',
    buyer: MOCK_BUYER,
    shop: SHOP_CUTE,
    shopId: 'seller-03',
    books: [snapshot(MOCK_BOOKS[3], 'WELL_LOVED')],
    amount: 130,
    shippingFee: 0,
    total: 130,
    createdAtISO: hoursAgo(200),
    updatedAtISO: hoursAgo(150),
    schedule: {
      dateISO: daysAhead(-6),
      timeLabel: 'เย็น 16–20 น.',
      ...MEET_LIBRARY,
      proposedBy: 'BUYER',
      confirmedByBuyer: true,
    },
    handoverCodeVerifiedAtISO: hoursAgo(150),
    creditSpent: true,
  },
  {
    id: 'ORD-V4-1010',
    status: 'EXPIRED',
    delivery: 'MEETUP',
    buyer: MOCK_BUYER,
    shop: SHOP_OTAKU,
    shopId: 'seller-02',
    books: [snapshot(MOCK_BOOKS[1], 'LIKE_NEW')],
    amount: 1850,
    shippingFee: 0,
    total: 1850,
    createdAtISO: hoursAgo(50),
    updatedAtISO: hoursAgo(26),
    creditSpent: false,
  },

  // ---------- Selling (my shop) ----------
  {
    id: 'ORD-V4-2001',
    status: 'REQUESTED',
    delivery: 'MEETUP',
    buyer: MOCK_BUYER_2,
    shop: MOCK_SHOP,
    books: [snapshot(MOCK_BOOKS[2], 'LIKE_NEW')],
    amount: 175,
    shippingFee: 0,
    total: 175,
    createdAtISO: hoursAgo(1),
    updatedAtISO: hoursAgo(1),
    schedule: {
      dateISO: daysAhead(2),
      timeLabel: 'บ่าย 12–16 น.',
      ...MEET_LIBRARY,
      proposedBy: 'BUYER',
      confirmedByBuyer: true,
    },
    creditSpent: false,
  },
  {
    id: 'ORD-V4-1002',
    status: 'REQUESTED',
    delivery: 'PARCEL',
    buyer: MOCK_BUYER_2,
    shop: MOCK_SHOP,
    books: [snapshot(MOCK_BOOKS[1], 'GENTLY_READ')],
    amount: 1850,
    shippingFee: 50,
    total: 1900,
    createdAtISO: hoursAgo(20),
    updatedAtISO: hoursAgo(20),
    shipWithinDays: 1,
    creditSpent: false,
    shipping: {
      receiverName: 'ธาม',
      receiverAddress: '88/12 ซ.ลาดพร้าว 101 แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ 10240',
    },
  },
  {
    id: 'ORD-V4-1004',
    status: 'ACCEPTED',
    delivery: 'PARCEL',
    buyer: MOCK_BUYER_2,
    shop: MOCK_SHOP,
    books: [snapshot(MOCK_BOOKS[3], 'WELL_LOVED')],
    amount: 130,
    shippingFee: 35,
    total: 165,
    createdAtISO: hoursAgo(3),
    updatedAtISO: hoursAgo(2),
    shipWithinDays: 1,
    creditSpent: true,
    shipping: {
      receiverName: 'ธาม',
      receiverAddress: '12 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
    },
  },
  {
    id: 'ORD-V4-1006',
    status: 'PAID',
    delivery: 'PARCEL',
    buyer: MOCK_BUYER_2,
    shop: MOCK_SHOP,
    books: [snapshot(MOCK_BOOKS[2], 'GENTLY_READ')],
    amount: 175,
    shippingFee: 35,
    total: 210,
    createdAtISO: hoursAgo(30),
    updatedAtISO: hoursAgo(2),
    shipWithinDays: 1,
    // Rounded to the hour so server and client render the same text.
    shipByISO: new Date(Math.ceil(Date.now() / 3600000) * 3600000 + 21 * 3600000).toISOString(),
    creditSpent: true,
    shipping: {
      receiverName: 'ธาม',
      receiverAddress: '12 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
    },
  },
  {
    id: 'ORD-V4-2002',
    status: 'SCHEDULED',
    delivery: 'MEETUP',
    buyer: MOCK_BUYER_2,
    shop: MOCK_SHOP,
    books: [snapshot(MOCK_BOOKS[0], 'LIKE_NEW')],
    amount: 190,
    shippingFee: 0,
    total: 190,
    createdAtISO: hoursAgo(20),
    updatedAtISO: hoursAgo(6),
    schedule: {
      dateISO: daysAhead(0),
      timeLabel: 'เย็น 16–20 น.',
      ...MEET_GATE,
      proposedBy: 'BUYER',
      confirmedByBuyer: true,
    },
    handoverCode: '730215',
    creditSpent: true,
  },
  {
    id: 'ORD-V4-1007',
    status: 'PAID',
    delivery: 'PARCEL',
    buyer: MOCK_BUYER_2,
    shop: MOCK_SHOP,
    books: [snapshot(MOCK_BOOKS[1], 'GENTLY_READ')],
    amount: 1850,
    shippingFee: 50,
    total: 1900,
    createdAtISO: hoursAgo(72),
    updatedAtISO: hoursAgo(20),
    creditSpent: true,
    shipping: {
      carrier: 'Flash Express',
      trackingNumber: 'TH0987654321CM',
      boxPhoto: BOX,
      receiverName: 'ธาม',
      receiverAddress: '88/12 ซ.ลาดพร้าว 101 แขวงคลองจั่น เขตบางกะปิ กรุงเทพฯ 10240',
    },
  },
  {
    id: 'ORD-V4-2003',
    status: 'COMPLETED',
    delivery: 'PARCEL',
    buyer: MOCK_BUYER_2,
    shop: MOCK_SHOP,
    books: [snapshot(MOCK_BOOKS[3], 'WELL_LOVED')],
    amount: 130,
    shippingFee: 35,
    total: 165,
    createdAtISO: hoursAgo(220),
    updatedAtISO: hoursAgo(120),
    creditSpent: true,
    shipping: {
      carrier: 'Kerry Express',
      trackingNumber: 'KEX12345678',
      receiverName: 'ธาม',
    },
    receivedPhoto: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
    receivedAtISO: hoursAgo(120),
    payoutReleasedAtISO: hoursAgo(120),
    review: {
      rating: 5,
      isGradeMatched: true,
      tags: ['แพ็กดี', 'ส่งไว'],
      comment: 'หนังสือตรงตามรูป แพ็กแน่นหนามากค่ะ',
      reviewedAtISO: hoursAgo(120),
    },
  },
  {
    id: 'ORD-V4-1009',
    status: 'DISPUTED',
    delivery: 'MEETUP',
    buyer: MOCK_BUYER_2,
    shop: MOCK_SHOP,
    books: [snapshot(MOCK_BOOKS[2], 'GENTLY_READ')],
    amount: 175,
    shippingFee: 0,
    total: 175,
    createdAtISO: hoursAgo(60),
    updatedAtISO: hoursAgo(10),
    creditSpent: true,
    dispute: {
      reason: 'ผู้ซื้อไม่มาตามนัด',
      openedBy: 'SELLER',
      openedAtISO: hoursAgo(10),
    },
  },
];

export const MOCK_V4_ORDER = MOCK_V4_ORDERS[2];

export const MOCK_V4_CHAT: ChatMessage[] = [
  {
    id: 'msg-1',
    orderId: 'ORD-V4-1005',
    from: 'SELLER',
    text: 'สวัสดีค่ะ นัดรับวันพรุ่งนี้ 16:30 ที่หน้าหอสมุดกลางได้ไหมคะ',
    sentAtISO: hoursAgo(4),
  },
  {
    id: 'msg-2',
    orderId: 'ORD-V4-1005',
    from: 'BUYER',
    text: 'ได้ครับ ขอเบอร์ติดต่อด้วยได้ไหม 089-123-4567',
    sentAtISO: hoursAgo(3.8),
  },
  {
    id: 'msg-3',
    orderId: 'ORD-V4-1005',
    from: 'SELLER',
    text: 'ติดต่อในแชทนี้ได้เลยค่ะ ส่งไลน์ส่วนตัวไม่ได้นะคะ',
    sentAtISO: hoursAgo(3.7),
  },
  {
    id: 'msg-4',
    orderId: 'ORD-V4-1005',
    from: 'SELLER',
    text: 'จุดนัด: หน้าหอสมุดกลาง มช. ใต้ต้นไม้ใหญ่',
    sentAtISO: hoursAgo(3.6),
    kind: 'SCHEDULE_CARD',
  },
];

export const MOCK_V4_LEDGER: CreditEntry[] = [
  {
    id: 'credit-3',
    atISO: hoursAgo(26),
    reason: 'ACCEPT_ORDER',
    delta: -1,
    balanceAfter: 1,
    orderId: 'ORD-V4-1005',
  },
  {
    id: 'credit-2',
    atISO: hoursAgo(30),
    reason: 'TOPUP',
    delta: 3,
    balanceAfter: 2,
    note: 'แพ็กเกจ Starter',
  },
  {
    id: 'credit-1',
    atISO: hoursAgo(80),
    reason: 'SIGNUP_BONUS',
    delta: 1,
    balanceAfter: 1,
  },
];
