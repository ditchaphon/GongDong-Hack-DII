import { Book, Order, Address } from '@/types';

export const MOCK_BOOKS: Book[] = [
  {
    id: 'book-01',
    title: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
    author: 'James Clear',
    publisher: 'บิงโก',
    isbn: '9786160838257',
    isSet: false,
    price: 190,
    originalPrice: 295,
    grade: 'A',
    checklist: {
      coverIntact: true,
      noHighlight: true,
      noWaterDamage: true,
      pagesComplete: true,
      noYellowing: true,
    },
    photos: {
      cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
      back: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
      spine: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
      nameTag: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600',
    },
    sellerId: 'seller-01',
    sellerName: 'ร้านป้าหนอนหนังสือ',
    sellerRating: 4.9,
    sellerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    isPromptPayVerified: true,
    deliveryMethods: ['MEETUP', 'PARCEL'],
    parcelShippingFee: 40,
    meetupZones: ['หน้าหอสมุดกลาง มช.', 'ประตูหน้า มช.', 'หอพักนักศึกษา'],
    createdAt: '2026-11-01',
  },
  {
    id: 'book-02',
    title: 'ดาบพิฆาตอสูร Demon Slayer เล่ม 1-23 (จบ)',
    author: 'Koyoharu Gotouge',
    publisher: 'Siam Inter Comics',
    isbn: '9786165751234',
    isSet: true,
    totalVolumes: 23,
    price: 1850,
    originalPrice: 2300,
    grade: 'B',
    checklist: {
      coverIntact: true,
      noHighlight: true,
      noWaterDamage: true,
      pagesComplete: true,
      noYellowing: false,
    },
    photos: {
      cover: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=600',
      back: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=600',
      spine: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600',
      nameTag: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600',
    },
    sellerId: 'seller-02',
    sellerName: 'OtaKu Bookshelf',
    sellerRating: 4.8,
    sellerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    isPromptPayVerified: true,
    deliveryMethods: ['PARCEL'],
    parcelShippingFee: 80,
    createdAt: '2026-11-05',
  },
  {
    id: 'book-03',
    title: 'The Psychology of Money จิตวิทยาว่าด้วยเงิน',
    author: 'Morgan Housel',
    publisher: 'Live Rich',
    isbn: '9786169352822',
    isSet: false,
    price: 175,
    originalPrice: 290,
    grade: 'A',
    checklist: {
      coverIntact: true,
      noHighlight: true,
      noWaterDamage: true,
      pagesComplete: true,
      noYellowing: true,
    },
    photos: {
      cover: 'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?w=600',
      back: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
      spine: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
      nameTag: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600',
    },
    sellerId: 'seller-01',
    sellerName: 'ร้านป้าหนอนหนังสือ',
    sellerRating: 4.9,
    sellerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    isPromptPayVerified: true,
    deliveryMethods: ['MEETUP', 'PARCEL'],
    parcelShippingFee: 40,
    meetupZones: ['หน้าหอสมุดกลาง มช.', 'ประตูหน้า มช.'],
    createdAt: '2026-11-08',
  },
  {
    id: 'book-04',
    title: 'โต๊ะโตะจัง เด็กหญิงข้างหน้าต่าง',
    author: 'Tetsuko Kuroyanagi',
    publisher: 'ผีเสื้อ',
    isbn: '9789741404179',
    isSet: false,
    price: 130,
    originalPrice: 225,
    grade: 'C',
    checklist: {
      coverIntact: true,
      noHighlight: false,
      noWaterDamage: true,
      pagesComplete: true,
      noYellowing: false,
    },
    photos: {
      cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
      back: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
      spine: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=600',
      nameTag: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600',
    },
    sellerId: 'seller-03',
    sellerName: 'หนังสือน่ารัก เชียงใหม่',
    sellerRating: 4.7,
    sellerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    isPromptPayVerified: true,
    deliveryMethods: ['MEETUP'],
    meetupZones: ['หอพักนักศึกษา ชาย/หญิง', 'คณะมนุษยศาสตร์ มช.'],
    createdAt: '2026-11-10',
  },
];

export const MOCK_ADDRESSES: Address[] = [
  {
    id: 'addr-01',
    fullName: 'สกาย ระมัดระวัง',
    phone: '081-234-5678',
    province: 'เชียงใหม่',
    district: 'เมืองเชียงใหม่',
    subdistrict: 'สุเทพ',
    postalCode: '50200',
    detail: 'หอพักนักศึกษาหญิง อาคาร 4 ห้อง 312 มหาวิทยาลัยเชียงใหม่ ถ.สุเทพ',
    isDefault: true,
  },
  {
    id: 'addr-02',
    fullName: 'สกาย ระมัดระวัง (บ้าน)',
    phone: '081-234-5678',
    province: 'กรุงเทพมหานคร',
    district: 'ปทุมวัน',
    subdistrict: 'วังใหม่',
    postalCode: '10330',
    detail: '123/45 ซอยเกษมสันต์ 1 ถ.พระราม 1',
    isDefault: false,
  },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-12345',
    buyerId: 'usr_mock_01',
    sellerId: 'seller-01',
    books: [MOCK_BOOKS[0], MOCK_BOOKS[2]],
    totalAmount: 365,
    shippingFee: 0,
    deliveryMethod: 'MEETUP',
    meetupDetails: {
      zone: 'หน้าหอสมุดกลาง มช.',
      scheduledAt: '2026-11-13 16:00',
      note: 'ใส่เสื้อสีน้ำเงิน ถือถุงผ้าลายแมว',
    },
    status: 'WAITING_PAYMENT',
    createdAt: '12 พ.ย. 2569, 10:15',
  },
  {
    id: 'ORD-12340',
    buyerId: 'usr_mock_01',
    sellerId: 'seller-02',
    books: [MOCK_BOOKS[1]],
    totalAmount: 1930,
    shippingFee: 80,
    deliveryMethod: 'PARCEL',
    shippingAddress: MOCK_ADDRESSES[0],
    trackingNumber: 'TH0123456789CM',
    status: 'SHIPPED',
    createdAt: '10 พ.ย. 2569, 14:20',
  },
];

export interface WishlistItem {
  id: string;
  title: string;
  author?: string;
  maxPrice: number;
  meetupZone?: string;
  createdAt: string;
  matchCount: number;
}

export const MOCK_WISHLIST: WishlistItem[] = [
  {
    id: 'wish-01',
    title: 'เจ้าชายน้อย (The Little Prince)',
    author: 'Antoine de Saint-Exupéry',
    maxPrice: 150,
    meetupZone: 'หน้าหอสมุดกลาง มช.',
    createdAt: '5 พ.ย. 2569',
    matchCount: 2,
  },
  {
    id: 'wish-02',
    title: 'Sapiens ประวัติย่อมนุษยชาติ',
    author: 'Yuval Noah Harari',
    maxPrice: 280,
    createdAt: '8 พ.ย. 2569',
    matchCount: 0,
  },
];

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'wishlist' | 'system';
  linkUrl: string;
  createdAt: string;
  isRead: boolean;
}

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-01',
    title: 'ผู้ขายรับออเดอร์แล้ว! 🎉',
    message: 'ร้านป้าหนอนหนังสือ รับออเดอร์ #ORD-12345 แล้ว นัดรับที่ หน้าหอสมุดกลาง มช.',
    type: 'order',
    linkUrl: '/orders/ORD-12345',
    createdAt: '10 นาทีที่แล้ว',
    isRead: false,
  },
  {
    id: 'notif-02',
    title: 'พบหนังสือที่คุณฝากตามหา! 📚',
    message: 'มีผู้ลงขาย "เจ้าชายน้อย" ในราคา ฿140 นัดรับใน มช. ได้',
    type: 'wishlist',
    linkUrl: '/book/book-01',
    createdAt: '2 ชั่วโมงที่แล้ว',
    isRead: false,
  },
  {
    id: 'notif-03',
    title: 'พัสดุของคุณถูกจัดส่งแล้ว 🚚',
    message: 'เลขพัสดุ Flash Express: TH0123456789CM',
    type: 'order',
    linkUrl: '/orders/ORD-12340',
    createdAt: 'เมื่อวานนี้',
    isRead: true,
  },
];
