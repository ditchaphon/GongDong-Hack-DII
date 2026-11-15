// =============================================================================
// GongDong (กองดอง) - Database Seed Script (v3.0.0)
// Populates all 15 tables: Users, ShopProfiles, MeetupPoints, Addresses,
// BookCatalog, Listings (Single & Set with INNER images), Orders (COD & Transfer),
// OrderMessages, PaymentSlips, Reviews (with tags), CreditTransactions & Notifications
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 เริ่มต้นการ Seed ข้อมูลจำลองสำหรับ GongDong v3.0.0...');

  // ---------------------------------------------------------------------------
  // 1. ทำความสะอาดข้อมูลเก่า (เรียงลำดับตาม Foreign Key เพื่อความปลอดภัย)
  // ---------------------------------------------------------------------------
  console.log('🧹 ล้างข้อมูลเดิมในระบบ...');
  await prisma.notification.deleteMany();
  await prisma.orderMessage.deleteMany();
  await prisma.review.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderDeliveryDetail.deleteMany();
  await prisma.order.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.bookListingImage.deleteMany();
  await prisma.bookListing.deleteMany();
  await prisma.bookCatalog.deleteMany();
  await prisma.userAddress.deleteMany();
  await prisma.shopMeetupPoint.deleteMany();
  await prisma.shopProfile.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------------------------
  // 2. สร้างข้อมูลผู้ใช้งานจำลอง (Users)
  // ---------------------------------------------------------------------------
  console.log('👤 สร้างบัญชีผู้ใช้จำลอง (ผู้ขาย & ผู้ซื้อ)...');

  // ผู้ขายที่ 1: นนท์ (ผ่าน KYC บัตรประชาชน + เติมแพ็ก 10 เครดิต, รับไป 2 ออเดอร์ -> คงเหลือ 9)
  const sellerNont = await prisma.user.create({
    data: {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      lineUserId: 'U_LINE_NONT_001',
      displayName: 'Nontaphath (LINE)',
      pictureUrl:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
      nickname: 'นนท์ กองดอง',
      avatarUrl:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
      phoneNumber: '0812345678',
      verifiedName: 'นนทภัทร สุขใจ',
      promptpayId: '0812345678',
      isVerifiedSeller: true,
      kycFirstName: 'นนทภัทร',
      kycLastName: 'สุขใจ',
      kycNationalIdMasked: 'x-xxxx-xxxxx-12-3',
      kycVerifiedAt: new Date('2026-11-10T09:00:00Z'),
      noShowCount: 0,
      credits: 9,
    },
  });

  // ผู้ขายที่ 2: มายด์ (ผ่าน KYC + เติมแพ็ก 3 เครดิต, รับไป 1 ออเดอร์ -> คงเหลือ 3)
  const sellerMind = await prisma.user.create({
    data: {
      id: '8a0ceb3c-2a6c-4cac-8acc-1a0c6a2cba5c',
      lineUserId: 'U_LINE_MIND_002',
      displayName: 'Mind CMU (LINE)',
      pictureUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      nickname: 'มายด์ มช.',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      phoneNumber: '0898765432',
      verifiedName: 'พิมพ์มาดา วงศ์คำ',
      promptpayId: '0898765432',
      isVerifiedSeller: true,
      kycFirstName: 'พิมพ์มาดา',
      kycLastName: 'วงศ์คำ',
      kycNationalIdMasked: 'x-xxxx-xxxxx-45-6',
      kycVerifiedAt: new Date('2026-11-11T10:30:00Z'),
      noShowCount: 0,
      credits: 3,
    },
  });

  // ผู้ซื้อที่ 1: กานต์ (ผู้ใช้ใหม่ ได้ 1 เครดิตเริ่มต้นฟรี · ยังไม่ KYC แต่สามารถตั้งร้านนัดรับได้)
  const buyerKarn = await prisma.user.create({
    data: {
      id: '7f9bda2b-1f5b-4aba-7abb-0f9b5f1ba94b',
      lineUserId: 'U_LINE_KARN_003',
      displayName: 'Karn Kittikun (LINE)',
      pictureUrl:
        'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=300&q=80',
      nickname: 'กานต์',
      avatarUrl:
        'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=300&q=80',
      isVerifiedSeller: false,
      noShowCount: 0,
      credits: 1,
    },
  });

  // ผู้ซื้อที่ 2: บีม (ผู้ซื้อทั่วไปตามกฎ PDPA v4 ไม่มีเบอร์โทรในโปรไฟล์)
  const buyerBeam = await prisma.user.create({
    data: {
      id: '6e8aca1a-0e4a-49a9-69aa-9e8a4e0a983a',
      lineUserId: 'U_LINE_BEAM_004',
      displayName: 'Beam P. (LINE)',
      pictureUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      nickname: 'บีม',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      isVerifiedSeller: false,
      noShowCount: 0,
      credits: 1,
    },
  });

  // ---------------------------------------------------------------------------
  // 3. สร้างโปรไฟล์ร้านค้าและจุดนัดรับ (ShopProfiles & ShopMeetupPoints)
  // ---------------------------------------------------------------------------
  console.log('🏪 สร้างข้อมูลร้านค้าและพิกัดจุดนัดรับ...');

  const shopNont = await prisma.shopProfile.create({
    data: {
      id: '11110001-0000-4000-8000-000000000001',
      userId: sellerNont.id,
      shopName: 'ร้านนนท์ กองดอง',
      description: 'หนังสือพัฒนาตนเอง มังงะ และนิยายสภาพสะสม นัดรับแถว มช. ได้ทุกวันครับ',
      avatarUrl: sellerNont.avatarUrl,
      province: 'เชียงใหม่',
      availableDays: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
      availableSlots: ['บ่าย 12–16 น.', 'เย็น 16–20 น.'],
      supportsParcel: true,
      shipMode: 'AFTER_ACCEPT',
      shipWithinDays: 2,
      setupComplete: true,
    },
  });

  await prisma.shopMeetupPoint.createMany({
    data: [
      {
        shopProfileId: shopNont.id,
        name: 'หน้าหอสมุดกลาง มช. (ม้านั่งฝั่งใต้)',
        province: 'เชียงใหม่',
        lat: 18.7953214,
        lng: 98.9527312,
        note: 'จอดรถมอเตอร์ไซค์สะดวก อยู่ติดประตูหน้า',
      },
      {
        shopProfileId: shopNont.id,
        name: 'ริมอ่างแก้ว มช. หน้าร้านกาแฟ',
        province: 'เชียงใหม่',
        lat: 18.7981234,
        lng: 98.9554321,
        note: 'นัดช่วงเย็นบรรยากาศดี',
      },
    ],
  });

  const shopMind = await prisma.shopProfile.create({
    data: {
      id: '11110002-0000-4000-8000-000000000002',
      userId: sellerMind.id,
      shopName: 'มายด์บุ๊คส์ มช.',
      description: 'ส่งต่อตำราเรียนวิศวะ บัญชี และหนังสือเทคสภาพดี ราคาเป็นมิตร',
      avatarUrl: sellerMind.avatarUrl,
      province: 'เชียงใหม่',
      availableDays: ['จ', 'พ', 'ศ', 'อา'],
      availableSlots: ['เช้า 9–12 น.', 'บ่าย 12–16 น.'],
      supportsParcel: true,
      shipMode: 'AFTER_ACCEPT',
      shipWithinDays: 2,
      setupComplete: true,
    },
  });

  await prisma.shopMeetupPoint.createMany({
    data: [
      {
        shopProfileId: shopMind.id,
        name: 'ใต้ตึกคณะบริหารธุรกิจ มช.',
        province: 'เชียงใหม่',
        lat: 18.7932145,
        lng: 98.9567891,
      },
      {
        shopProfileId: shopMind.id,
        name: 'ลานหน้าตึกวิศวกรรมศาสตร์ 3',
        province: 'เชียงใหม่',
        lat: 18.7961234,
        lng: 98.9534567,
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // 4. สร้างที่อยู่จัดส่งผู้ซื้อ (UserAddresses - PDPA v4 ไม่มีเบอร์โทร)
  // ---------------------------------------------------------------------------
  console.log('📍 สร้างที่อยู่จัดส่งพัสดุตามกฎ PDPA v4...');

  await prisma.userAddress.createMany({
    data: [
      {
        userId: buyerKarn.id,
        fullName: 'กานต์ กิตติคุณ',
        province: 'กรุงเทพมหานคร',
        district: 'ปทุมวัน',
        subdistrict: 'วังใหม่',
        postalCode: '10330',
        detail: '254 ถนนพญาไท อาคารจามจุรี 9 ชั้น 3',
        isDefault: true,
      },
      {
        userId: buyerKarn.id,
        fullName: 'กานต์ กิตติคุณ',
        province: 'เชียงใหม่',
        district: 'เมืองเชียงใหม่',
        subdistrict: 'สุเทพ',
        postalCode: '50200',
        detail: 'หอพักนักศึกษาในกำกับ อาคาร 4 ห้อง 208',
        isDefault: false,
      },
      {
        userId: buyerBeam.id,
        fullName: 'บีม พงศกร',
        province: 'ขอนแก่น',
        district: 'เมืองขอนแก่น',
        subdistrict: 'ในเมือง',
        postalCode: '40002',
        detail: '123 หมู่ 16 ถนนมิตรภาพ ตึกคอมเพล็กซ์ มข.',
        isDefault: true,
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // 5. สร้างแคตตาล็อกหนังสือกลาง (Book Catalog)
  // ---------------------------------------------------------------------------
  console.log('📚 สร้างฐานข้อมูลแคตตาล็อกหนังสือสากล (ISBN Master Data)...');

  const booksCatalog = [
    {
      isbn: '9786161845678',
      title: 'จิตวิทยาวาทะด้วยเงิน (The Psychology of Money)',
      author: 'Morgan Housel',
      publisher: 'Live Rich',
      category: 'จิตวิทยา / พัฒนาตนเอง',
      coverUrl:
        'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?auto=format&fit=crop&w=600&q=80',
      originalPrice: 290.0,
    },
    {
      isbn: '9786161829029',
      title: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
      author: 'James Clear',
      publisher: 'I Learn',
      category: 'จิตวิทยา / พัฒนาตนเอง',
      coverUrl:
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80',
      originalPrice: 295.0,
    },
    {
      isbn: '9780132350884',
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      publisher: 'Prentice Hall',
      category: 'คอมพิวเตอร์ / เทคโนโลยี',
      coverUrl:
        'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=600&q=80',
      originalPrice: 1450.0,
    },
    {
      isbn: '9789740339878',
      title: 'การบัญชีการเงินเบื้องต้น (Introduction to Financial Accounting)',
      author: 'รศ.ดร. ธนกฤต มณีรัตน์',
      publisher: 'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย',
      category: 'บริหาร / การเงิน',
      coverUrl:
        'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      originalPrice: 350.0,
    },
    {
      isbn: '9786162243456',
      title: 'ดาบพิฆาตอสูร เล่ม 1 (Demon Slayer Vol. 1)',
      author: 'Koyoharu Gotouge',
      publisher: 'Siam Inter Comics',
      category: 'มังงะ / นิยาย',
      coverUrl:
        'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80',
      originalPrice: 85.0,
    },
    {
      isbn: '9789740335016',
      title: 'แคลคูลัส 1 สำหรับวิศวกรรมศาสตร์ (Calculus I for Engineers)',
      author: 'ศ.ดร. สุรพล วิศวกิจ',
      publisher: 'สำนักพิมพ์มหาวิทยาลัยเชียงใหม่',
      category: 'ตำราเรียน / มหาวิทยาลัย',
      coverUrl:
        'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80',
      originalPrice: 320.0,
    },
    {
      isbn: '9786162249999',
      title: 'ดาบพิฆาตอสูร ชุดสะสม เล่ม 1–5 (ขาดเล่ม 4)',
      author: 'Koyoharu Gotouge',
      publisher: 'Siam Inter Comics',
      category: 'มังงะ / นิยาย',
      coverUrl:
        'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=600&q=80',
      originalPrice: 425.0,
    },
  ];

  for (const book of booksCatalog) {
    await prisma.bookCatalog.create({ data: book });
  }

  // ---------------------------------------------------------------------------
  // 6. สร้างรายการลงขายหนังสือ (BookListings & Images 4 มุมรวม INNER)
  // ---------------------------------------------------------------------------
  console.log('🏷️ สร้างประกาศขายหนังสือ 7 รายการ (รวมขายยกชุด) พร้อมรูป 4 มุมแบบ INNER...');

  // รายการที่ 1: Atomic Habits — ขายสำเร็จแล้ว (SOLD) ผ่าน Order 1
  const listing1 = await prisma.bookListing.create({
    data: {
      id: 'f1a10001-1111-4000-8000-000000000001',
      isbn: '9786161829029',
      sellerId: sellerNont.id,
      isSet: false,
      description: 'อ่านจบ 1 รอบ ห่อปกใสอย่างดี ไม่มีรอยขีดเขียน',
      price: 220.0,
      category: 'จิตวิทยา / พัฒนาตนเอง',
      categories: ['จิตวิทยา', 'พัฒนาตนเอง'],
      grade: 'LIKE_NEW',
      conditionAnswers: {
        spine: false,
        stains: false,
        markings: false,
        covers: false,
        pages: false,
      },
      allowPickup: true,
      pickupLat: 18.7953214,
      pickupLng: 98.9527312,
      pickupLocationName: 'หน้าหอสมุดกลาง มช. (ม้านั่งฝั่งใต้)',
      allowDelivery: true,
      codEnabled: true,
      status: 'SOLD',
    },
  });

  await prisma.bookListingImage.createMany({
    data: [
      {
        bookListingId: listing1.id,
        imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80',
        imageType: 'FRONT_COVER',
        displayOrder: 1,
        isCover: true,
      },
      {
        bookListingId: listing1.id,
        imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
        imageType: 'BACK_COVER',
        displayOrder: 2,
        isCover: false,
      },
      {
        bookListingId: listing1.id,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        imageType: 'SPINE',
        displayOrder: 3,
        isCover: false,
      },
      {
        bookListingId: listing1.id,
        imageUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80',
        imageType: 'INNER',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  // รายการที่ 2: The Psychology of Money — AVAILABLE
  const listing2 = await prisma.bookListing.create({
    data: {
      id: 'f1a10002-2222-4000-8000-000000000002',
      isbn: '9786161845678',
      sellerId: sellerNont.id,
      isSet: false,
      description: 'มีไฮไลต์สีเหลืองประมาณ 5 หน้า บทที่ 2 และ 4 นอกนั้นสะอาด',
      price: 130.0,
      category: 'จิตวิทยา / พัฒนาตนเอง',
      categories: ['จิตวิทยา', 'การเงิน / บริหาร'],
      grade: 'WELL_LOVED',
      conditionAnswers: {
        spine: false,
        stains: false,
        markings: true,
        covers: false,
        pages: false,
      },
      defects: [
        {
          id: 'def-1',
          note: 'รอยปากกาไฮไลต์หน้า 42',
          photo: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80',
        },
      ],
      allowPickup: true,
      pickupLat: 18.7981234,
      pickupLng: 98.9554321,
      pickupLocationName: 'ริมอ่างแก้ว มช. หน้าร้านกาแฟ',
      allowDelivery: true,
      codEnabled: true,
      status: 'AVAILABLE',
    },
  });

  await prisma.bookListingImage.createMany({
    data: [
      {
        bookListingId: listing2.id,
        imageUrl: 'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?auto=format&fit=crop&w=800&q=80',
        imageType: 'FRONT_COVER',
        displayOrder: 1,
        isCover: true,
      },
      {
        bookListingId: listing2.id,
        imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
        imageType: 'BACK_COVER',
        displayOrder: 2,
        isCover: false,
      },
      {
        bookListingId: listing2.id,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        imageType: 'SPINE',
        displayOrder: 3,
        isCover: false,
      },
      {
        bookListingId: listing2.id,
        imageUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80',
        imageType: 'INNER',
        displayOrder: 4,
        isCover: false,
      },
      {
        bookListingId: listing2.id,
        imageUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80',
        imageType: 'DEFECT',
        displayOrder: 5,
        isCover: false,
      },
    ],
  });

  // รายการที่ 3: Clean Code — RESERVED (ติด Order 2 COD Parcel)
  const listing3 = await prisma.bookListing.create({
    data: {
      id: 'f1a10003-3333-4000-8000-000000000003',
      isbn: '9780132350884',
      sellerId: sellerMind.id,
      isSet: false,
      description: 'ฉบับภาษาอังกฤษ ปกแข็ง สันย่นเล็กน้อยจากการเปิดอ่าน',
      price: 870.0,
      category: 'คอมพิวเตอร์ / เทคโนโลยี',
      categories: ['คอมพิวเตอร์', 'ตำราเรียน'],
      grade: 'GENTLY_READ',
      conditionAnswers: {
        spine: true,
        stains: false,
        markings: false,
        covers: false,
        pages: false,
      },
      allowPickup: false,
      allowDelivery: true,
      codEnabled: true,
      status: 'RESERVED',
    },
  });

  await prisma.bookListingImage.createMany({
    data: [
      {
        bookListingId: listing3.id,
        imageUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=800&q=80',
        imageType: 'FRONT_COVER',
        displayOrder: 1,
        isCover: true,
      },
      {
        bookListingId: listing3.id,
        imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
        imageType: 'BACK_COVER',
        displayOrder: 2,
        isCover: false,
      },
      {
        bookListingId: listing3.id,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        imageType: 'SPINE',
        displayOrder: 3,
        isCover: false,
      },
      {
        bookListingId: listing3.id,
        imageUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80',
        imageType: 'INNER',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  // รายการที่ 4: การบัญชีการเงินเบื้องต้น — AVAILABLE
  const listing4 = await prisma.bookListing.create({
    data: {
      id: 'f1a10004-4444-4000-8000-000000000004',
      isbn: '9789740339878',
      sellerId: sellerMind.id,
      isSet: false,
      description: 'มีโน้ตสรุปสูตรและซ่อมเทปใสที่หน้าปกหลัง อ่านเนื้อหาได้ครบ 100%',
      price: 105.0,
      category: 'บริหาร / การเงิน',
      categories: ['บริหาร / การเงิน', 'ตำราเรียน'],
      grade: 'WORN_BUT_READABLE',
      conditionAnswers: {
        spine: true,
        stains: true,
        markings: true,
        covers: false,
        pages: true,
      },
      defects: [
        {
          id: 'def-2',
          note: 'ขอบปกมีเทปใสซ่อมและคราบน้ำจางๆ ที่มุมล่าง',
          photo: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80',
        },
      ],
      allowPickup: true,
      pickupLat: 18.7932145,
      pickupLng: 98.9567891,
      pickupLocationName: 'ใต้ตึกคณะบริหารธุรกิจ มช.',
      allowDelivery: true,
      codEnabled: true,
      status: 'AVAILABLE',
    },
  });

  await prisma.bookListingImage.createMany({
    data: [
      {
        bookListingId: listing4.id,
        imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        imageType: 'FRONT_COVER',
        displayOrder: 1,
        isCover: true,
      },
      {
        bookListingId: listing4.id,
        imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
        imageType: 'BACK_COVER',
        displayOrder: 2,
        isCover: false,
      },
      {
        bookListingId: listing4.id,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        imageType: 'SPINE',
        displayOrder: 3,
        isCover: false,
      },
      {
        bookListingId: listing4.id,
        imageUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80',
        imageType: 'INNER',
        displayOrder: 4,
        isCover: false,
      },
      {
        bookListingId: listing4.id,
        imageUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80',
        imageType: 'DEFECT',
        displayOrder: 5,
        isCover: false,
      },
    ],
  });

  // รายการที่ 5: ดาบพิฆาตอสูร เล่ม 1 — RESERVED (ติด Order 3 TRANSFER Parcel)
  const listing5 = await prisma.bookListing.create({
    data: {
      id: 'f1a10005-5555-4000-8000-000000000005',
      isbn: '9786162243456',
      sellerId: sellerNont.id,
      isSet: false,
      description: 'สะสมสภาพใหม่ กริบๆ ไม่เคยเปิดกางเต็มแผ่น',
      price: 60.0,
      category: 'มังงะ / นิยาย',
      categories: ['มังงะ', 'นิยาย'],
      grade: 'LIKE_NEW',
      conditionAnswers: {
        spine: false,
        stains: false,
        markings: false,
        covers: false,
        pages: false,
      },
      allowPickup: true,
      pickupLat: 18.7953214,
      pickupLng: 98.9527312,
      pickupLocationName: 'หน้าหอสมุดกลาง มช. (ม้านั่งฝั่งใต้)',
      allowDelivery: true,
      codEnabled: true,
      status: 'RESERVED',
    },
  });

  await prisma.bookListingImage.createMany({
    data: [
      {
        bookListingId: listing5.id,
        imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
        imageType: 'FRONT_COVER',
        displayOrder: 1,
        isCover: true,
      },
      {
        bookListingId: listing5.id,
        imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
        imageType: 'BACK_COVER',
        displayOrder: 2,
        isCover: false,
      },
      {
        bookListingId: listing5.id,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        imageType: 'SPINE',
        displayOrder: 3,
        isCover: false,
      },
      {
        bookListingId: listing5.id,
        imageUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80',
        imageType: 'INNER',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  // รายการที่ 6: แคลคูลัส 1 — AVAILABLE
  const listing6 = await prisma.bookListing.create({
    data: {
      id: 'f1a10006-6666-4000-8000-000000000006',
      isbn: '9789740335016',
      sellerId: sellerMind.id,
      isSet: false,
      description: 'หนังสือเรียนวิศวะ มีรอยดินสอทดเลขเบาๆ ลบออกได้',
      price: 140.0,
      category: 'ตำราเรียน / มหาวิทยาลัย',
      categories: ['ตำราเรียน / มหาวิทยาลัย'],
      grade: 'WELL_LOVED',
      conditionAnswers: {
        spine: true,
        stains: false,
        markings: true,
        covers: false,
        pages: false,
      },
      allowPickup: true,
      pickupLat: 18.7961234,
      pickupLng: 98.9534567,
      pickupLocationName: 'ลานหน้าตึกวิศวกรรมศาสตร์ 3',
      allowDelivery: true,
      codEnabled: true,
      status: 'AVAILABLE',
    },
  });

  await prisma.bookListingImage.createMany({
    data: [
      {
        bookListingId: listing6.id,
        imageUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
        imageType: 'FRONT_COVER',
        displayOrder: 1,
        isCover: true,
      },
      {
        bookListingId: listing6.id,
        imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
        imageType: 'BACK_COVER',
        displayOrder: 2,
        isCover: false,
      },
      {
        bookListingId: listing6.id,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        imageType: 'SPINE',
        displayOrder: 3,
        isCover: false,
      },
      {
        bookListingId: listing6.id,
        imageUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80',
        imageType: 'INNER',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  // รายการที่ 7: ดาบพิฆาตอสูร ยกชุด (SET) — AVAILABLE
  const listing7 = await prisma.bookListing.create({
    data: {
      id: 'f1a10007-7777-4000-8000-000000000007',
      isbn: '9786162249999',
      sellerId: sellerNont.id,
      isSet: true,
      totalVolumes: 5,
      missingVolumes: [4],
      description: 'ขายยกชุดเล่ม 1, 2, 3, 5 (ขาดเล่ม 4) สภาพสะสมทุกเล่ม',
      price: 240.0,
      category: 'มังงะ / นิยาย',
      categories: ['มังงะ', 'ชุดสะสม'],
      grade: 'GENTLY_READ',
      conditionAnswers: {
        spine: true,
        stains: false,
        markings: false,
        covers: false,
        pages: false,
      },
      allowPickup: true,
      pickupLat: 18.7953214,
      pickupLng: 98.9527312,
      pickupLocationName: 'หน้าหอสมุดกลาง มช. (ม้านั่งฝั่งใต้)',
      allowDelivery: true,
      codEnabled: true,
      status: 'AVAILABLE',
    },
  });

  await prisma.bookListingImage.createMany({
    data: [
      {
        bookListingId: listing7.id,
        imageUrl: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=800&q=80',
        imageType: 'FRONT_COVER',
        displayOrder: 1,
        isCover: true,
      },
      {
        bookListingId: listing7.id,
        imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
        imageType: 'BACK_COVER',
        displayOrder: 2,
        isCover: false,
      },
      {
        bookListingId: listing7.id,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        imageType: 'SPINE',
        displayOrder: 3,
        isCover: false,
      },
      {
        bookListingId: listing7.id,
        imageUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80',
        imageType: 'INNER',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // 7. สร้างตัวอย่างคำสั่งซื้อ Dual Mode (COD & TRANSFER), แชท, รีวิว & แจ้งเตือน
  // ---------------------------------------------------------------------------
  console.log('📦 สร้างคำสั่งซื้อจำลอง (COD Meetup, COD Parcel, Transfer Parcel)...');

  // Order 1: COD Meetup (COMPLETED) — กานต์ซื้อ Atomic Habits จาก นนท์
  const order1 = await prisma.order.create({
    data: {
      id: '0a100001-1111-4000-8000-000000000001',
      buyerId: buyerKarn.id,
      sellerId: sellerNont.id,
      shippingMethod: 'PICKUP',
      paymentMethod: 'COD',
      pickupLat: 18.7953214,
      pickupLng: 98.9527312,
      pickupLocationName: 'หน้าหอสมุดกลาง มช. (ม้านั่งฝั่งใต้)',
      scheduledAt: new Date('2026-11-12T16:30:00+07:00'),
      scheduleDateIso: '2026-11-12',
      scheduleTimeLabel: 'เย็น 16–20 น.',
      scheduleProposedBy: 'BUYER',
      scheduleConfirmedByBuyer: true,
      receivedPhotoUrl:
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80',
      receivedAt: new Date('2026-11-12T16:40:00+07:00'),
      shippingFee: 0.0,
      totalPrice: 220.0,
      status: 'COMPLETED',
      orderItems: {
        create: [{ bookListingId: listing1.id, price: 220.0 }],
      },
    },
  });

  // แชทใน Order 1 (รวมระบบ Data Masking)
  await prisma.orderMessage.createMany({
    data: [
      {
        orderId: order1.id,
        senderRole: 'SYSTEM',
        kind: 'SYSTEM',
        text: 'ผู้ขายรับคำขอแล้ว · นัดรับยืนยันแล้ว แชทในออเดอร์เปิดแล้ว',
      },
      {
        orderId: order1.id,
        senderId: buyerKarn.id,
        senderRole: 'BUYER',
        kind: 'TEXT',
        text: 'เจอกันหน้าหอสมุด 16:30 น. นะครับ ผมใส่เสื้อสีน้ำตาล',
        isMasked: false,
      },
      {
        orderId: order1.id,
        senderId: sellerNont.id,
        senderRole: 'SELLER',
        kind: 'TEXT',
        text: 'โอเคครับ เตรียมหนังสือให้เรียบร้อย เบอร์ติดต่อ [ซ่อนข้อมูลติดต่อ] เจอกันตรงม้านั่งครับ',
        isMasked: true,
      },
      {
        orderId: order1.id,
        senderId: buyerKarn.id,
        senderRole: 'BUYER',
        kind: 'SYSTEM',
        text: 'ผู้ซื้อยืนยันรับของพร้อมรูปถ่ายแล้ว · ชำระเงินปลายทางเรียบร้อย',
      },
    ],
  });

  // รีวิวพร้อม Tags ใน Order 1
  await prisma.review.create({
    data: {
      orderId: order1.id,
      reviewerId: buyerKarn.id,
      revieweeId: sellerNont.id,
      rating: 5,
      isConditionAccurate: true,
      tags: ['สภาพตรงเกรด', 'นัดตรงเวลา', 'คุยง่าย'],
      comment: 'หนังสือสภาพใหม่มาก ห่อปกมาให้เรียบร้อย พ่อค้ามาตรงเวลาครับ',
    },
  });

  // Order 2: COD Parcel (ACCEPTED) — บีม (ขอนแก่น) ซื้อ Clean Code จาก มายด์ (เชียงใหม่)
  // ค่าส่งข้ามภาค: 35 (เล่มแรก) + 15 (ข้ามภาค เหนือ->อีสาน) = 50 บาท
  const order2 = await prisma.order.create({
    data: {
      id: '0a100002-2222-4000-8000-000000000002',
      buyerId: buyerBeam.id,
      sellerId: sellerMind.id,
      shippingMethod: 'DELIVERY',
      paymentMethod: 'COD',
      shipWithinDays: 2,
      shipBy: new Date('2026-11-16T12:00:00+07:00'),
      shippingFee: 50.0,
      totalPrice: 920.0,
      status: 'ACCEPTED',
      orderItems: {
        create: [{ bookListingId: listing3.id, price: 870.0 }],
      },
      deliveryDetail: {
        create: {
          recipientName: 'บีม พงศกร',
          recipientPhone: null, // PDPA v4: ไม่บังคับเก็บเบอร์โทรใน Shared Address
          province: 'ขอนแก่น',
          deliveryAddress: '123 หมู่ 16 ถนนมิตรภาพ ตึกคอมเพล็กซ์ มข. อ.เมือง จ.ขอนแก่น 40002',
        },
      },
    },
  });

  await prisma.orderMessage.createMany({
    data: [
      {
        orderId: order2.id,
        senderRole: 'SYSTEM',
        kind: 'SYSTEM',
        text: 'ผู้ขายรับคำขอแล้ว · รอผู้ขายยืนยันการส่งและเก็บเงินปลายทาง',
      },
      {
        orderId: order2.id,
        senderId: sellerMind.id,
        senderRole: 'SELLER',
        kind: 'TEXT',
        text: 'รับออเดอร์แล้วนะคะ เดี๋ยวแพ็กบับเบิ้ลส่งให้พรุ่งนี้เช้าค่ะ',
      },
    ],
  });

  // Order 3: TRANSFER Parcel (PAID) — กานต์ (กทม.) ซื้อ ดาบพิฆาตอสูร เล่ม 1 จาก นนท์ (เชียงใหม่)
  // ค่าส่งข้ามภาค: 35 + 15 = 50 บาท, ราคารวม = 110 บาท
  const order3 = await prisma.order.create({
    data: {
      id: '0a100003-3333-4000-8000-000000000003',
      buyerId: buyerKarn.id,
      sellerId: sellerNont.id,
      shippingMethod: 'DELIVERY',
      paymentMethod: 'TRANSFER',
      shipWithinDays: 2,
      shipBy: new Date('2026-11-16T12:00:00+07:00'),
      shippingFee: 50.0,
      totalPrice: 110.0,
      status: 'PAID',
      orderItems: {
        create: [{ bookListingId: listing5.id, price: 60.0 }],
      },
      deliveryDetail: {
        create: {
          recipientName: 'กานต์ กิตติคุณ',
          recipientPhone: '0865554433',
          province: 'กรุงเทพมหานคร',
          deliveryAddress: '254 ถนนพญาไท อาคารจามจุรี 9 ชั้น 3 แขวงวังใหม่ เขตปทุมวัน กทม. 10330',
        },
      },
    },
  });

  // ---------------------------------------------------------------------------
  // 8. สร้างประวัติสลิปโอนเงิน (PaymentSlips: Credit Topup + Transfer Order)
  // ---------------------------------------------------------------------------
  console.log('💳 สร้างประวัติสลิปเติมเครดิตและค่าหนังสือ...');

  await prisma.paymentSlip.createMany({
    data: [
      {
        userId: sellerNont.id,
        slipType: 'CREDIT_TOPUP',
        slipImageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600',
        transRef: 'SEED_TOPUP_NONT_001',
        amount: 50.0,
        receiverName: 'กองดอง (GongDong)',
        verificationStatus: 'AUTO_VERIFIED',
        verifiedAt: new Date('2026-11-10T09:00:00Z'),
      },
      {
        userId: sellerMind.id,
        slipType: 'CREDIT_TOPUP',
        slipImageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600',
        transRef: 'SEED_TOPUP_MIND_001',
        amount: 20.0,
        receiverName: 'กองดอง (GongDong)',
        verificationStatus: 'AUTO_VERIFIED',
        verifiedAt: new Date('2026-11-11T10:30:00Z'),
      },
      {
        userId: buyerKarn.id,
        orderId: order3.id,
        slipType: 'ORDER_PAYMENT',
        slipImageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600',
        transRef: 'SEED_ORDER_PAY_003',
        amount: 110.0,
        receiverName: 'นนทภัทร สุขใจ',
        verificationStatus: 'AUTO_VERIFIED',
        verifiedAt: new Date('2026-11-13T11:00:00Z'),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // 9. สร้างประวัติเครดิตพร้อม balanceAfter (CreditTransactions)
  // ---------------------------------------------------------------------------
  console.log('🪙 สร้างประวัติธุรกรรมเครดิต (Ledger)...');

  await prisma.creditTransaction.createMany({
    data: [
      // นนท์: +1 (bal 1) +10 (bal 11) -1 (bal 10) -1 (bal 9)
      {
        userId: sellerNont.id,
        amount: 1,
        balanceAfter: 1,
        type: 'SIGNUP_BONUS',
        note: 'เครดิตฟรีต้อนรับสมาชิกใหม่',
      },
      {
        userId: sellerNont.id,
        amount: 10,
        balanceAfter: 11,
        type: 'TOPUP',
        note: 'แพ็กเกจ Bookworm (฿50) · อนุมัติสลิปแล้ว',
      },
      {
        userId: sellerNont.id,
        amount: -1,
        balanceAfter: 10,
        type: 'ORDER_ACCEPT',
        orderId: order1.id,
        note: 'กดรับคำขอซื้อ Atomic Habits',
      },
      {
        userId: sellerNont.id,
        amount: -1,
        balanceAfter: 9,
        type: 'ORDER_ACCEPT',
        orderId: order3.id,
        note: 'กดรับคำขอซื้อ ดาบพิฆาตอสูร เล่ม 1',
      },
      // มายด์: +1 (bal 1) +3 (bal 4) -1 (bal 3)
      {
        userId: sellerMind.id,
        amount: 1,
        balanceAfter: 1,
        type: 'SIGNUP_BONUS',
        note: 'เครดิตฟรีต้อนรับสมาชิกใหม่',
      },
      {
        userId: sellerMind.id,
        amount: 3,
        balanceAfter: 4,
        type: 'TOPUP',
        note: 'แพ็กเกจ Starter (฿20) · อนุมัติสลิปแล้ว',
      },
      {
        userId: sellerMind.id,
        amount: -1,
        balanceAfter: 3,
        type: 'ORDER_ACCEPT',
        orderId: order2.id,
        note: 'กดรับคำขอซื้อ Clean Code',
      },
      // กานต์ & บีม
      {
        userId: buyerKarn.id,
        amount: 1,
        balanceAfter: 1,
        type: 'SIGNUP_BONUS',
        note: 'เครดิตฟรีต้อนรับสมาชิกใหม่',
      },
      {
        userId: buyerBeam.id,
        amount: 1,
        balanceAfter: 1,
        type: 'SIGNUP_BONUS',
        note: 'เครดิตฟรีต้อนรับสมาชิกใหม่',
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // 10. สร้างรายการแจ้งเตือนในแอป (Notifications)
  // ---------------------------------------------------------------------------
  console.log('🔔 สร้างการแจ้งเตือนแยกฝั่ง Buyer & Seller...');

  await prisma.notification.createMany({
    data: [
      {
        userId: buyerKarn.id,
        role: 'BUYER',
        type: 'ORDER',
        title: 'ออเดอร์เสร็จสมบูรณ์',
        message: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น · ขอบคุณที่ใช้กองดองครับ',
        linkUrl: `/orders/${order1.id}`,
        isRead: true,
      },
      {
        userId: buyerBeam.id,
        role: 'BUYER',
        type: 'ORDER',
        title: 'ผู้ขายรับคำขอซื้อแล้ว',
        message: 'Clean Code · ฿920 (เก็บเงินปลายทาง) ร้านมายด์บุ๊คส์ มช. กำลังเตรียมส่ง',
        linkUrl: `/orders/${order2.id}`,
        isRead: false,
      },
      {
        userId: sellerMind.id,
        role: 'SELLER',
        type: 'ORDER',
        title: 'รอจัดส่งพัสดุ (COD)',
        message: 'ออเดอร์ Clean Code ถึง จ.ขอนแก่น กรุณากรอกเลขพัสดุภายใน 48 ชม.',
        linkUrl: `/orders/${order2.id}`,
        isRead: false,
      },
      {
        userId: sellerNont.id,
        role: 'SELLER',
        type: 'ORDER',
        title: 'ผู้ซื้อชำระเงินแล้ว (Transfer)',
        message: 'ดาบพิฆาตอสูร เล่ม 1 · ฿110 สลิปผ่านการตรวจสอบแล้ว พร้อมจัดส่ง',
        linkUrl: `/orders/${order3.id}`,
        isRead: false,
      },
    ],
  });

  console.log('✅ Seed ข้อมูลตัวอย่างสำหรับ GongDong v3.0.0 สำเร็จเรียบร้อย!');
  console.log('   - ผู้ใช้งาน: 4 คน (ผู้ขายยืนยัน KYC 2 คน, ผู้ซื้อ 2 คน)');
  console.log('   - โปรไฟล์ร้านค้า: 2 ร้าน + จุดนัดรับ 4 หมุด + ที่อยู่ผู้ซื้อ 3 รายการ');
  console.log(`   - แคตตาล็อกหนังสือ: ${booksCatalog.length} เล่ม | รายการลงขาย: 7 ประกาศ (รวมขายยกชุด & รูป INNER)`);
  console.log('   - ออเดอร์ตัวอย่าง: 3 รายการ (COD Meetup, COD Parcel, Transfer Parcel) พร้อม Chat, Slips, Reviews & Notifications');
}

main()
  .catch((e) => {
    console.error('❌ เกิดข้อผิดพลาดขณะ Seed ข้อมูล:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
