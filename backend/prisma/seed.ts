// =============================================================================
// GongDong (กองดอง) - Database Seed Script
// Populates mock users, book catalog, listings with 4-angle images & credit logs
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 เริ่มต้นการ Seed ข้อมูลจำลองสำหรับ GongDong...');

  // ---------------------------------------------------------------------------
  // 1. ทำความสะอาดข้อมูลเก่า (เรียงลำดับตาม Foreign Key เพื่อความปลอดภัย)
  // ---------------------------------------------------------------------------
  console.log('🧹 ล้างข้อมูลเดิมในระบบ...');
  await prisma.review.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderDeliveryDetail.deleteMany();
  await prisma.order.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.bookListingImage.deleteMany();
  await prisma.bookListing.deleteMany();
  await prisma.bookCatalog.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------------------------
  // 2. สร้างข้อมูลผู้ใช้งานจำลอง (Users)
  // ---------------------------------------------------------------------------
  console.log('👤 สร้างบัญชีผู้ใช้จำลอง (ผู้ขาย & ผู้ซื้อ)...');

  // ผู้ขายที่ 1: นนท์ (ผ่าน Frictionless KYC ระดับ 2 เรียบร้อย มี 4 เครดิต)
  const sellerNont = await prisma.user.create({
    data: {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      lineUserId: 'U_LINE_NONT_001',
      displayName: 'Nontaphath (LINE)',
      pictureUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
      nickname: 'นนท์ กองดอง',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
      phoneNumber: '0812345678',
      verifiedName: 'นนทภัทร สุขใจ',
      promptpayId: '0812345678',
      isVerifiedSeller: true,
      credits: 4,
    },
  });

  // ผู้ขายที่ 2: มายด์ (นักศึกษา มช. ยืนยันตัวตนแล้ว มี 3 เครดิต)
  const sellerMind = await prisma.user.create({
    data: {
      id: '8a0ceb3c-2a6c-4cac-8acc-1a0c6a2cba5c',
      lineUserId: 'U_LINE_MIND_002',
      displayName: 'Mind CMU (LINE)',
      pictureUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      nickname: 'มายด์ มช.',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      phoneNumber: '0898765432',
      verifiedName: 'พิมพ์มาดา วงศ์คำ',
      promptpayId: '0898765432',
      isVerifiedSeller: true,
      credits: 3,
    },
  });

  // ผู้ซื้อที่ 1: กานต์ (ผู้ใช้ใหม่ ได้ 1 เครดิตเริ่มต้นฟรี)
  const buyerKarn = await prisma.user.create({
    data: {
      id: '7f9bda2b-1f5b-4aba-7abb-0f9b5f1ba94b',
      lineUserId: 'U_LINE_KARN_003',
      displayName: 'Karn Kittikun (LINE)',
      pictureUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=300&q=80',
      nickname: 'กานต์',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=300&q=80',
      phoneNumber: '0865554433',
      isVerifiedSeller: false,
      credits: 1,
    },
  });

  // ผู้ซื้อที่ 2: บีม (ผู้ซื้อทั่วไป)
  await prisma.user.create({
    data: {
      id: '6e8aca1a-0e4a-49a9-69aa-9e8a4e0a983a',
      lineUserId: 'U_LINE_BEAM_004',
      displayName: 'Beam P. (LINE)',
      pictureUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      nickname: 'บีม',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      phoneNumber: '0841112233',
      isVerifiedSeller: false,
      credits: 1,
    },
  });

  // บันทึก Audit เครดิตเริ่มต้นและประวัติการเติม
  await prisma.creditTransaction.createMany({
    data: [
      { userId: sellerNont.id, amount: 1, type: 'SIGNUP_BONUS' },
      { userId: sellerNont.id, amount: 3, type: 'TOPUP' },
      { userId: sellerMind.id, amount: 1, type: 'SIGNUP_BONUS' },
      { userId: sellerMind.id, amount: 3, type: 'TOPUP' },
      { userId: buyerKarn.id, amount: 1, type: 'SIGNUP_BONUS' },
    ],
  });

  // ---------------------------------------------------------------------------
  // 3. สร้างแคตตาล็อกหนังสือกลาง (Book Catalog)
  // ---------------------------------------------------------------------------
  console.log('📚 สร้างฐานข้อมูลแคตตาล็อกหนังสือสากล (ISBN Master Data)...');

  const booksCatalog = [
    {
      isbn: '9786161845678',
      title: 'จิตวิทยาวาทะด้วยเงิน (The Psychology of Money)',
      author: 'Morgan Housel',
      publisher: 'Live Rich',
      category: 'จิตวิทยา / พัฒนาตนเอง',
      coverUrl: 'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?auto=format&fit=crop&w=600&q=80',
      originalPrice: 290.00,
    },
    {
      isbn: '9786161829029',
      title: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
      author: 'James Clear',
      publisher: 'I Learn',
      category: 'จิตวิทยา / พัฒนาตนเอง',
      coverUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80',
      originalPrice: 295.00,
    },
    {
      isbn: '9780132350884',
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      publisher: 'Prentice Hall',
      category: 'คอมพิวเตอร์ / เทคโนโลยี',
      coverUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=600&q=80',
      originalPrice: 1450.00,
    },
    {
      isbn: '9789740339878',
      title: 'การบัญชีการเงินเบื้องต้น (Introduction to Financial Accounting)',
      author: 'รศ.ดร. ธนกฤต มณีรัตน์',
      publisher: 'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย',
      category: 'บริหาร / การเงิน',
      coverUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      originalPrice: 350.00,
    },
    {
      isbn: '9786162243456',
      title: 'ดาบพิฆาตอสูร เล่ม 1 (Demon Slayer Vol. 1)',
      author: 'Koyoharu Gotouge',
      publisher: 'Siam Inter Comics',
      category: 'มังงะ / นิยาย',
      coverUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80',
      originalPrice: 85.00,
    },
    {
      isbn: '9789740335016',
      title: 'แคลคูลัส 1 สำหรับวิศวกรรมศาสตร์ (Calculus I for Engineers)',
      author: 'ศ.ดร. สุรพล วิศวกิจ',
      publisher: 'สำนักพิมพ์มหาวิทยาลัยเชียงใหม่',
      category: 'ตำราเรียน / มหาวิทยาลัย',
      coverUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80',
      originalPrice: 320.00,
    },
  ];

  for (const book of booksCatalog) {
    await prisma.bookCatalog.create({ data: book });
  }

  // ---------------------------------------------------------------------------
  // 4. สร้างรายการหนังสือที่ผู้ขายลงขายจริง (Book Listings & 4-Angle Images)
  // ---------------------------------------------------------------------------
  console.log('🏷️ สร้างประกาศขายหนังสือมือสอง 6 รายการ พร้อมรูปถ่ายจริง 4 มุม...');

  // รายการที่ 1: Atomic Habits — เกรด LIKE_NEW (เหมือนใหม่ 75%)
  const listing1 = await prisma.bookListing.create({
    data: {
      id: 'f1a10001-1111-4000-8000-000000000001',
      isbn: '9786161829029',
      sellerId: sellerNont.id,
      price: 220.00, // แนะนำ 75% จาก 295 = 221.25 -> ตั้ง 220
      category: 'จิตวิทยา / พัฒนาตนเอง',
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
      status: 'AVAILABLE',
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
        imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
        imageType: 'EDGE',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  // รายการที่ 2: The Psychology of Money — เกรด WELL_LOVED (45%) มีรอยไฮไลต์
  const listing2 = await prisma.bookListing.create({
    data: {
      id: 'f1a10002-2222-4000-8000-000000000002',
      isbn: '9786161845678',
      sellerId: sellerNont.id,
      price: 130.00, // แนะนำ 45% จาก 290 = 130.50 -> ตั้ง 130
      category: 'จิตวิทยา / พัฒนาตนเอง',
      grade: 'WELL_LOVED',
      conditionAnswers: {
        spine: false,
        stains: false,
        markings: true,
        covers: false,
        pages: false,
      },
      allowPickup: true,
      pickupLat: 18.7981234,
      pickupLng: 98.9554321,
      pickupLocationName: 'ริมอ่างแก้ว มช. หน้าร้านกาแฟ',
      allowDelivery: true,
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
        imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
        imageType: 'EDGE',
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

  // รายการที่ 3: Clean Code — เกรด GENTLY_READ (60%) สันย่นเล็กน้อย
  const listing3 = await prisma.bookListing.create({
    data: {
      id: 'f1a10003-3333-4000-8000-000000000003',
      isbn: '9780132350884',
      sellerId: sellerMind.id,
      price: 870.00, // แนะนำ 60% จาก 1450 = 870.00
      category: 'คอมพิวเตอร์ / เทคโนโลยี',
      grade: 'GENTLY_READ',
      conditionAnswers: {
        spine: true,
        stains: false,
        markings: false,
        covers: false,
        pages: false,
      },
      allowPickup: false, // ส่งพัสดุอย่างเดียว
      allowDelivery: true,
      status: 'AVAILABLE',
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
        imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
        imageType: 'EDGE',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  // รายการที่ 4: การบัญชีการเงินเบื้องต้น — เกรด WORN_BUT_READABLE (30%) มีหน้าซ่อมเทป
  const listing4 = await prisma.bookListing.create({
    data: {
      id: 'f1a10004-4444-4000-8000-000000000004',
      isbn: '9789740339878',
      sellerId: sellerMind.id,
      price: 105.00, // แนะนำ 30% จาก 350 = 105.00
      category: 'บริหาร / การเงิน',
      grade: 'WORN_BUT_READABLE',
      conditionAnswers: {
        spine: true,
        stains: true,
        markings: true,
        covers: false,
        pages: true,
      },
      allowPickup: true,
      pickupLat: 18.7932145,
      pickupLng: 98.9567891,
      pickupLocationName: 'ใต้ตึกคณะบริหารธุรกิจ มช.',
      allowDelivery: true,
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
        imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
        imageType: 'EDGE',
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

  // รายการที่ 5: ดาบพิฆาตอสูร เล่ม 1 — เกรด LIKE_NEW (75%)
  const listing5 = await prisma.bookListing.create({
    data: {
      id: 'f1a10005-5555-4000-8000-000000000005',
      isbn: '9786162243456',
      sellerId: sellerNont.id,
      price: 60.00, // แนะนำ 75% จาก 85 = 63.75 -> ตั้ง 60
      category: 'มังงะ / นิยาย',
      grade: 'LIKE_NEW',
      conditionAnswers: {
        spine: false,
        stains: false,
        markings: false,
        covers: false,
        pages: false,
      },
      allowPickup: true,
      pickupLat: 18.7901234,
      pickupLng: 98.9501234,
      pickupLocationName: 'ประตูหลัง มช. (ร้านนมสด)',
      allowDelivery: true,
      status: 'AVAILABLE',
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
        imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
        imageType: 'EDGE',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  // รายการที่ 6: แคลคูลัส 1 — เกรด WELL_LOVED (45%)
  const listing6 = await prisma.bookListing.create({
    data: {
      id: 'f1a10006-6666-4000-8000-000000000006',
      isbn: '9789740335016',
      sellerId: sellerMind.id,
      price: 140.00, // แนะนำ 45% จาก 320 = 144.00 -> ตั้ง 140
      category: 'ตำราเรียน / มหาวิทยาลัย',
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
        imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
        imageType: 'EDGE',
        displayOrder: 4,
        isCover: false,
      },
    ],
  });

  console.log('✅ Seed ข้อมูลตัวอย่างสำหรับ GongDong สำเร็จเรียบร้อย!');
  console.log(`   - ผู้ใช้งาน: 4 คน (ผู้ขายยืนยัน 2 คน, ผู้ซื้อ 2 คน)`);
  console.log(`   - แคตตาล็อกหนังสือ: ${booksCatalog.length} เล่ม`);
  console.log(`   - รายการลงขายจริง: 6 ประกาศ (ครอบคลุมเกรด LIKE_NEW, GENTLY_READ, WELL_LOVED, WORN_BUT_READABLE)`);
  console.log(`   - รูปถ่ายจริง 4 มุม: 26 รูป`);
}

main()
  .catch((e) => {
    console.error('❌ เกิดข้อผิดพลาดขณะ Seed ข้อมูล:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
