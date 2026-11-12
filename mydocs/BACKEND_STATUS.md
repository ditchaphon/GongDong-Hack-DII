# สรุปสถานะการพัฒนาระบบ Backend — GongDong (กองดอง) 📚⚡

> **อัปเดตล่าสุด:** 12 พฤศจิกายน 2569  
> **Git Branch:** `Biw-dev`  
> **Latest Commit:** `cc20a11` (`feat(backend): implement core services, state machines, marketplace, auth, and reviews with 117 passing tests`)  
> **สถานะการทดสอบ:** ผ่านครบถ้วน **117/117 Tests (10 Test Suites)** ในเวลา 464ms  
> **สถานะการคอมไพล์:** `tsc` build สำเร็จ 100% (0 Errors)

---

## 1. สิ่งที่พัฒนาและขึ้น Git เรียบร้อยแล้ว (Completed Modules)

| ลำดับ | โมดูล / ระบบ | รายละเอียดที่พัฒนาเสร็จสิ้น | ไฟล์ต้นฉบับ |
|:---:|---|---|---|
| **1** | **Core Business Logic Services** | • **`gradingService`:** ตรวจสอบสภาพ 5 จุด & ตัดเกรดอัตโนมัติ 4 ระดับ (75%, 60%, 45%, 30%)<br>• **`googleBooksService`:** ค้นหา ISBN ผ่าน Google Books API พร้อม Cache-Aside ลง `book_catalog`<br>• **`promptPayService`:** สร้าง EMVCo QR Code สำหรับเบอร์โทร 10 หลักและบัตร ปชช. 13 หลัก<br>• **`dataMaskingService`:** PDPA Regex กรองเบอร์โทร, เลขบัญชี, LINE ID อัตโนมัติในข้อความแชท | • `src/services/gradingService.ts`<br>• `src/services/googleBooksService.ts`<br>• `src/services/promptPayService.ts`<br>• `src/services/dataMaskingService.ts` |
| **2** | **Order State Machine & Delivery Flow** | • **`acceptOrder`:** ACID Transaction รวม 4 ขั้นตอน (ตรวจเครดิต >= 1 ➔ หัก 1 เครดิต ➔ ล็อกหนังสือ ➔ ตัดคำขอซื้อซ้อนอัตโนมัติ ➔ เปลี่ยนเป็น ACCEPTED)<br>• **`schedulePickupOrder` & `verifyHandoverCode`:** ระบบนัดรับ & รหัสส่งมอบ 6 หลักเพื่อปิดงาน<br>• **`createOrder`:** กฎ 1 ตะกร้า = 1 ร้าน, จำกัดค้างคำขอไม่เกิน 3 ออเดอร์, ค่าส่ง ฿40+฿10<br>• **`getOrderDetail`:** PDPA ซ่อนที่อยู่/เบอร์ผู้รับจนกว่าจะถึงสถานะ `PAID` หรือ `SHIPPED` และซ่อนกลับเมื่อ `COMPLETED`<br>• **`verifyOrderPaymentSlip`:** ตรวจสลิปโอนเงิน (Anti-replay ตรวจ `transRef` ซ้ำ, ตรวจยอดเงิน, ตรวจชื่อผู้รับตรงกับร้านค้า)<br>• **`shipOrder`:** บันทึก Tracking No., ขนส่ง, รูปกล่อง ➔ `SHIPPED`<br>• **`completeDeliveryOrder`:** ยืนยันรับของ ➔ `COMPLETED` & หนังสือเป็น `SOLD`<br>• **`reportMissedMeeting`:** รายงานไม่มาตามนัดเมื่อเลยเวลา 15 นาที | • `src/services/orderService.ts`<br>• `src/routes/orders.ts` |
| **3** | **Books & Marketplace** | • **`getBookListings`:** Feed ค้นหา/กรองหนังสือ (หมวดหมู่, เกรด, วิธีรับของ) รองรับ Pagination<br>• **`getBookListingDetail`:** รายละเอียดหนังสือพร้อมแกลเลอรีรูป 4 มุม และโปรไฟล์ผู้ขายที่ปลอดภัย<br>• **`createBookListing`:** ลงขายหนังสือเล่มใหม่ บังคับรูป 4 มุม (`FRONT_COVER`, `BACK_COVER`, `SPINE`, `EDGE`) และคำนวณเกรดฝั่ง Server<br>• **`getUserBookListings`:** หน้าร้านค้าของฉัน (S4)<br>• **`deleteBookListing`:** ลบประกาศขาย (เฉพาะเล่มที่ยัง `AVAILABLE`) | • `src/services/bookService.ts`<br>• `src/routes/books.ts` |
| **4** | **Users & LINE Auth Middleware** | • **`authMiddleware`:** ตรวจสอบ LIFF ID Token กับ LINE Verify API พร้อมโหมด Dual-mode สำหรับ Dev/Testing<br>• **First Login Auto-creation:** สร้างบัญชีผู้ใช้ใหม่อัตโนมัติเมื่อล็อกอินครั้งแรก พร้อมแจก **1 เครดิตฟรี** (`SIGNUP_BONUS`) ใน ACID Transaction<br>• **`getUserProfile` (`GET /api/users/me`):** ดูโปรไฟล์ ยอดเครดิต และสถานะ KYC<br>• **`updateUserProfile` (`PATCH /api/users/me`):** บันทึกข้อมูลส่วนตัว (ชื่อเล่น, อวตาร, เบอร์โทร, พร้อมเพย์ พร้อม Data Validation)<br>• **`processTopupSlip` (`POST /api/users/me/topup-slip`):** **Frictionless KYC Level 2** ตรวจสลิปเติมเครดิต ฿20=3 / ฿50=10 / ฿100=25, ดึงชื่อผู้โอนเป็น `verified_name`, ปรับ `is_verified_seller = true` ทันที | • `src/middlewares/auth.ts`<br>• `src/services/userService.ts`<br>• `src/routes/users.ts` |
| **5** | **Reviews & Trust Score** | • **`createOrderReview` (`POST /api/orders/:id/review`):** ให้คะแนน 1-5 ดาวหลังจบออเดอร์ (`COMPLETED`), สิทธิ์เฉพาะผู้ซื้อ/ผู้ขาย, One-time write ห้ามรีวิวซ้ำ, บังคับผู้ซื้อระบุสภาพตรงเกรด (`is_condition_accurate`)<br>• **`getUserReviews` (`GET /api/users/:id/reviews`):** สถิติ Trust Metrics (คะแนนเฉลี่ย, จำนวนรีวิวทั้งหมด, เปอร์เซ็นต์สภาพตรงเกรด, การกระจายดาว 1-5 ดาว, และ Pagination) เปิดให้เข้าถึงแบบ Public | • `src/services/reviewService.ts`<br>• `src/routes/users.ts`<br>• `src/routes/orders.ts` |
| **6** | **Database Seed Data** | • **`seed.ts`:** ข้อมูลจำลองผู้ใช้ 4 คน (ผู้ขายยืนยันตัวตน 2 คน, ผู้ซื้อ 2 คน), หนังสือแคตตาล็อกและรายการลงขาย 6 เล่มครอบคลุม 4 เครดิตและพิกัด มช., รูปภาพ 26 รูป, ประวัติเครดิต | • `prisma/seed.ts` |

---

## 2. ผลการรันชุดทดสอบ (Automated Test Results)

รันด้วย Vitest:
```bash
cd backend
npm test -- --run
```

```text
 RUN  v5.1.0 D:/Project/GongDong-Hack-DII/backend

 ✓ src/services/__tests__/gradingService.test.ts (11 tests) 8ms
 ✓ src/services/__tests__/dataMaskingService.test.ts (8 tests) 11ms
 ✓ src/middlewares/__tests__/auth.test.ts (6 tests) 7ms
 ✓ src/services/__tests__/userService.test.ts (14 tests) 13ms
 ✓ src/services/__tests__/googleBooksService.test.ts (7 tests) 11ms
 ✓ src/services/__tests__/bookService.test.ts (13 tests) 18ms
 ✓ src/services/__tests__/orderDeliveryFlow.test.ts (23 tests) 20ms
 ✓ src/services/__tests__/orderService.test.ts (17 tests) 21ms
 ✓ src/services/__tests__/reviewService.test.ts (11 tests) 11ms
 ✓ src/services/__tests__/promptPayService.test.ts (7 tests) 27ms

 Test Files  10 passed (10)
      Tests  117 passed (117)
   Duration  464ms
```

---

## 3. ส่วนที่ยังไม่ได้ทำ (Pending Backend Tasks & Next Steps)

| ลำดับ | รายการระบบที่ยังไม่ได้ทำ | รายละเอียดและขั้นตอนการพัฒนา | สถานะ |
|:---:|---|---|:---:|
| **1** | **ระบบอัปโหลดรูปภาพ (`POST /api/upload`)** | • ใช้ `multer` รับไฟล์รูปภาพ (`multipart/form-data`)<br>• เชื่อมต่อ Supabase Storage API อัปโหลดไฟล์เข้า Buckets:<br>&nbsp;&nbsp;&nbsp;&nbsp;▫️ `book-listings` (Public): รูปถ่ายหนังสือ 4 มุม<br>&nbsp;&nbsp;&nbsp;&nbsp;▫️ `avatars` (Public): รูปโปรไฟล์ผู้ใช้<br>&nbsp;&nbsp;&nbsp;&nbsp;▫️ `slips` (**Private Bucket**): สลิปโอนเงิน เข้าถึงผ่าน Signed URL เท่านั้น | ⏳ รอดำเนินการ |
| **2** | **ระบบแจ้งเตือน LINE Messaging API** | • สร้าง Service ส่ง Flex Messages ผ่าน LINE OA เข้าแชทผู้ใช้:<br>&nbsp;&nbsp;&nbsp;&nbsp;▫️ ส่งเตือนร้านค้าเมื่อมีคนขอซื้อ (`REQUESTED`)<br>&nbsp;&nbsp;&nbsp;&nbsp;▫️ ส่งเตือนผู้ซื้อเมื่อร้านค้ารับออเดอร์ (`ACCEPTED`)<br>&nbsp;&nbsp;&nbsp;&nbsp;▫️ ส่งเลขพัสดุและลิงก์ติดตามสถานะเมื่อของจัดส่งแล้ว (`SHIPPED`)<br>• Webhook `POST /api/webhook/line` สำหรับตรวจจับ Follow Event (แจก 1 เครดิตฟรี) | ⏳ รอดำเนินการ |
| **3** | **ข้อพิพาทคำสั่งซื้อ (Dispute Endpoints)** | • `POST /api/orders/:id/dispute`: ผู้ซื้อเปิดข้อพิพาทเมื่อหนังสือไม่ตรงสภาพ (เปลี่ยนสถานะเป็น `DISPUTED`)<br>• `POST /api/orders/:id/dispute-missed-meeting`: ผู้ซื้อกดโต้แย้งกรณีถูกผู้ขายรายงานไม่มาตามนัดภายใน 24 ชม. | ⏳ รอดำเนินการ |
| **4** | **Sync ฐานข้อมูลจริงขึ้น Supabase** | • นำ Connection String จริง (`DATABASE_URL`, `DIRECT_URL`) ของ Supabase ใส่ใน `.env`<br>• รัน `npm run prisma:push` เพื่อสร้าง Table และ Constraint บน Supabase<br>• รัน `npm run prisma:seed` เพื่อใส่ Seed Data จำลอง | ⏳ รอดำเนินการ (รอ Credentials จริง) |

---

## 4. โครงสร้างไฟล์ในระบบ Backend

```text
backend/
├── prisma/
│   ├── schema.prisma            # Prisma Schema v2.2.0 (PostgreSQL + RLS)
│   └── seed.ts                  # ข้อมูลจำลองสำหรับทดสอบระบบ
├── src/
│   ├── config/
│   │   └── prisma.ts            # Prisma Client Singleton
│   ├── middlewares/
│   │   ├── auth.ts              # LINE Auth & Auto-create User Middleware
│   │   ├── errorHandler.ts      # Global Error Handler (AppError)
│   │   └── __tests__/
│   │       └── auth.test.ts     # Unit tests for Auth Middleware
│   ├── routes/
│   │   ├── books.ts             # Books & Marketplace Router
│   │   ├── orders.ts            # Orders & State Machine Router
│   │   └── users.ts             # Users & Profiles Router
│   ├── services/
│   │   ├── bookService.ts       # Marketplace Listings & Feeds
│   │   ├── dataMaskingService.ts# PDPA Contact Filtering
│   │   ├── googleBooksService.ts# ISBN Catalog Lookup
│   │   ├── gradingService.ts    # 5-point Condition & 4-tier Grading
│   │   ├── orderService.ts      # Order Transactions & Delivery Flow
│   │   ├── promptPayService.ts  # EMVCo QR Generator
│   │   ├── reviewService.ts     # Reviews & Trust Score Calculation
│   │   ├── userService.ts       # Profiles & Frictionless KYC Level 2
│   │   └── __tests__/           # Unit Test Suites (117 tests)
│   ├── types/
│   │   ├── index.ts             # Shared Types
│   │   └── services.ts          # Detailed Interfaces & DTOs
│   └── index.ts                 # Express Application Entrypoint
├── package.json
├── tsconfig.json
└── vitest.config.mts            # Vitest Configuration
```
