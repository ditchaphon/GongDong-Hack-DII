import { ShopProfile } from '@/types';

/**
 * Public shop profiles. Buyers see the shop name only — never the owner's
 * real name, phone, LINE id or bank account (v4 rule).
 */
export const MOCK_SHOPS: ShopProfile[] = [
  {
    id: 'seller-01',
    shopName: 'ป้าหนอนหนังสือ',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    rating: 4.9,
    completedSales: 34,
    payeeVerified: true,
    memberSince: '2568',
    meetupZones: ['หน้าหอสมุดกลาง มช.', 'ประตูหน้า มช.', 'หอพักนักศึกษา'],
    supportsParcel: true,
    reviews: [
      {
        id: 'rev-01',
        author: 'สกายอ่านหนังสือ',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
        rating: 5,
        comment: 'หนังสือตรงเกรดมาก ปกสวยกว่าที่คิด นัดรับตรงเวลา',
        gradeMatched: true,
        createdAt: '10 พ.ย. 2569',
      },
      {
        id: 'rev-02',
        author: 'ธามสายมินต์',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
        rating: 5,
        comment: 'แพ็กมาดีมาก มีบับเบิ้ลให้ ส่งไว',
        gradeMatched: true,
        createdAt: '6 พ.ย. 2569',
      },
      {
        id: 'rev-03',
        author: 'บีโอสายช้อป',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
        rating: 4,
        comment: 'สภาพดี แต่สันมีรอยย่นนิดหน่อยตามที่แจ้งไว้',
        gradeMatched: true,
        createdAt: '2 พ.ย. 2569',
      },
    ],
  },
  {
    id: 'seller-02',
    shopName: 'OtaKu Bookshelf',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    rating: 4.8,
    completedSales: 88,
    payeeVerified: true,
    memberSince: '2567',
    meetupZones: ['หน้าหอสมุดกลาง มช.'],
    supportsParcel: true,
    reviews: [
      {
        id: 'rev-04',
        author: 'มินตราสะสม',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
        rating: 5,
        comment: 'ยกชุดครบ 23 เล่ม ไม่ขาดเล่ม ตรงปกทุกเล่ม',
        gradeMatched: true,
        createdAt: '8 พ.ย. 2569',
      },
      {
        id: 'rev-05',
        author: 'แบงก์นักล่าหนังสือ',
        rating: 4,
        comment: 'ส่งช้านิดนึง แต่หนังสือสภาพดีมาก',
        gradeMatched: true,
        createdAt: '1 พ.ย. 2569',
      },
    ],
  },
  {
    id: 'seller-03',
    shopName: 'หนังสือน่ารัก เชียงใหม่',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    rating: 4.7,
    completedSales: 4,
    payeeVerified: false,
    memberSince: '2569',
    meetupZones: ['หอพักนักศึกษา ชาย/หญิง', 'คณะมนุษยศาสตร์ มช.'],
    supportsParcel: false,
    reviews: [
      {
        id: 'rev-06',
        author: 'ไอคิว มือใหม่',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
        rating: 4,
        comment: 'ร้านใหม่ นัดรับง่าย หนังสือตรงเกรด',
        gradeMatched: true,
        createdAt: '9 พ.ย. 2569',
      },
    ],
  },
];

export const getShopById = (sellerId: string): ShopProfile | undefined =>
  MOCK_SHOPS.find((shop) => shop.id === sellerId);
