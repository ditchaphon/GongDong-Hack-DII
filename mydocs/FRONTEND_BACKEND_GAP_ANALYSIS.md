# รายงานตรวจสอบ Frontend และวิเคราะห์ Gap เทียบกับ Backend (Frontend ↔ Backend Sync Spec)

> **วันที่จัดทำ:** 14 พฤศจิกายน 2569  
> **สถานะอ้างอิง:** หลังการ Merge `origin/Frame-dev` (commit `14ea231`) เข้าสู่ `Biw-dev`  
> **เป้าหมาย:** สรุประบบ Frontend v4 ทั้งหมด พร้อมระบุรายการ **ปรับ / แก้ / เพิ่ม** ของ Backend ให้เชื่อมต่องานได้ 100%

---

## 1. ภาพรวมระบบ Frontend ปัจจุบัน (Frontend v4 Audit)

ปัจจุบัน Frontend พัฒนาด้วย **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 (Brown Theme)** รองรับหน้าจอทั้งหมด **33 Routes** โดยแบ่งการทำงานออกเป็น 4 ส่วนหลัก:

### 1.1 โครงสร้างหน้าจอและ Flow หลัก (33 Routes)

| กลุ่มหน้าจอ | เส้นทาง (Routes) | ความสามารถหลักในโค้ดปัจจุบัน |
|---|---|---|
| **ทางเข้า & โปรไฟล์** | `/onboarding`, `/setup`, `/profile`, `/debug`, `/api/auth/line` | แนะนำแอป, ตั้งชื่อเล่น/Avatar, สลับโหมดผู้ซื้อ/ผู้ขาย (`useAppMode`), LINE LIFF SDK + Mock mode |
| **ตลาด & ค้นหา** | `/`, `/search`, `/book/[id]`, `/seller/[sellerId]`, `/wishlist`, `/help` | ฟีดหนังสือ, กรองหมวดหมู่/เกรด/ราคา/วิธีรับ, ดูรูป 4 มุม + จุดตำหนิ, ดูหน้าร้านสาธารณะ (`ShopProfile`), คำแนะนำหนังสือ |
| **ตะกร้า & ที่อยู่** | `/cart`, `/cart/success`, `/addresses`, `/addresses/edit` | จัดการตะกร้าแยกตามร้าน, คำนวณค่าส่งตามภาค, จัดการหลายที่อยู่จัดส่ง (ไม่มีเบอร์โทรตาม PDPA v4) |
| **การจัดการร้าน (Seller)** | `/seller`, `/seller/setup`, `/seller/listings/[id]/edit`, `/seller/report`, `/seller/report/sent` | ตั้งค่าร้าน 3 ขั้น (ข้อมูลร้าน ➔ ตารางนัดรับ/ปักหมุด OpenStreetMap ➔ KYC บัตรประชาชน), ซ่อน/แก้ไขประกาศ, แท็บหนังสือ/กำลังดำเนินการ/ประวัติขาย |
| **ลงขายหนังสือ (5 ขั้น)** | `/seller/list`, `/details`, `/step-2`, `/step-3`, `/step-4`, `/success` | เลือกเล่มเดียว/ยกชุด (`SINGLE`/`SET`), สแกนบาร์โค้ด ISBN (`@zxing`), กรอกข้อมูล+หลายหมวดหมู่, ถ่ายรูป 4 มุม (`cover`, `back`, `spine`, `inner`) + รูปตำหนิ, เช็กสภาพ 5 จุด ➔ เกรดอัตโนมัติ, ตั้งราคา+วิธีรับ |
| **เครดิตผู้ขาย** | `/seller/credits`, `/pay`, `/success`, `/verify` | ซื้อแพ็กเครดิต (Starter/Bookworm/Merchant), QR + แนบสลิป (เฉพาะเติมเครดิตแพลตฟอร์ม) |
| **ออเดอร์ & แชท** | `/orders`, `/orders/[id]`, `/schedule`, `/tracking`, `/receive`, `/review`, `/no-show` | ระบบออเดอร์ COD (นัดรับ & ส่งพัสดุ), ไทม์ไลน์นับถอยหลัง, แชทในออเดอร์ (`ChatRoom` + Masking), แจ้งไม่มาตามนัด (ล็อกเวลา 15 นาที), ถ่ายรูปยืนยันรับของ, ให้คะแนน+Tags |
| **แจ้งเตือน** | `/notifications`, `/line-preview` | ศูนย์แจ้งเตือนแยกแท็บผู้ซื้อ/ผู้ขาย, ตัวอย่าง Flex Message (ยังเป็น Mock) |

### 1.2 กติกา Business Logic ใหม่ใน Frontend v4 (ที่ต่างจาก Backend เดิม)

1. **Order Flow เป็นแบบ COD (เก็บเงินปลายทาง/เงินสด):**
   - **นัดรับ (`MEETUP`):** `REQUESTED` ➔ `SCHEDULED` (ถ้าระบุวัน/จุดนัดมาแล้ว) หรือ `ACCEPTED` ➔ `COMPLETED` (ผู้ขายกดยืนยันส่งมอบ หรือผู้ซื้อถ่ายรูปรับของ — ไม่ใช้รหัส 6 หลัก)
   - **ส่งพัสดุ (`PARCEL`):** `REQUESTED` ➔ `ACCEPTED` ➔ `PAID` / `SHIPPED` (เมื่อผู้ขายกรอกเลขพัสดุ) ➔ `COMPLETED` (ผู้ซื้อถ่ายรูปยืนยันรับของที่ `/receive`)
   - *ข้อตกลงร่วม:* **Backend จะปรับให้รองรับทั้ง 2 โหมด** คือ `COD` (ตาม Frontend ใหม่) และ `TRANSFER` (ระบบสลิป + รหัส 6 หลักเดิม) โดยเพิ่มฟิลด์ `payment_method` ใน Order
2. **PDPA v4 เข้มงวด (Zero Contact Leak):**
   - ไม่เก็บและไม่แสดงเบอร์โทรผู้ซื้อในโปรไฟล์และหน้าจัดการที่อยู่ (`Address` มีแค่ `fullName` + ที่อยู่)
   - ไม่แสดงชื่อจริงผู้ขาย (KYC) หรือสลิปโอนเงินให้ผู้ซื้อเห็น (แสดงเฉพาะสถานะ `payeeVerified: boolean`)
   - ข้อมูลจุดนัดรับ/เวลา หรือที่อยู่จัดส่ง จะถูกซ่อนในสถานะ `REQUESTED` จนกว่าผู้ขายจะกดรับออเดอร์
3. **แยก Shop Setup & KYC ออกจากการเติมเครดิต:**
   - ผู้ขายทำ KYC ด้วย **ชื่อจริง + นามสกุล + เลขบัตรประชาชน 13 หลัก** (เก็บเฉพาะค่า Masked เช่น `x-xxxx-xxxxx-12-3`)
   - ร้านที่ยังไม่ทำ KYC **สามารถลงขายและรับออเดอร์แบบนัดรับ (MEETUP) ได้** (ระบบล็อกเฉพาะการจัดส่งพัสดุ `PARCEL`)
4. **สูตรคำนวณค่าส่งพัสดุแบบแบ่งภาค:**
   - Frontend ใช้ `calcParcelFee`: **฿35 (เล่มแรก) + ฿10 (เล่มถัดไป) + ฿15 (หากส่งข้ามภาคระหว่างจังหวัดร้านกับจังหวัดผู้ซื้อ)**

---

## 2. สรุปสิ่งที่ Backend ต้อง "ปรับ / แก้ / เพิ่ม" (Gap Analysis)

### 2.1 ส่วนที่ต้อง "ปรับแก้" (Modifications & Bug Fixes)

| ลำดับ | หัวข้อ | สถานะ Backend ปัจจุบัน | สิ่งที่ต้องปรับแก้ใน Backend |
|:---:|---|---|---|
| **M1** | **Dual Payment Order State Machine (`COD` & `TRANSFER`)** | บังคับ `payment-slip` สำหรับพัสดุ และบังคับ `handoverCode` 6 หลักสำหรับนัดรับ | เพิ่ม `payment_method` (`COD` \| `TRANSFER`, default `COD`) ใน `orders`:<br>• **COD Meetup:** `acceptOrder` ➔ `SCHEDULED` ทันที (ถ้ามี `scheduledAt`+พิกัด), ปิดงานได้ด้วย `POST /api/orders/:id/complete-meetup` หรือ `receive` (ไม่ต้องกรอกรหัส 6 หลัก)<br>• **COD Parcel:** `shipOrder` ยอมให้ส่งจากสถานะ `ACCEPTED` ได้เลย (ไม่ต้องรอ `PAID`), ปิดงานผ่าน `POST /api/orders/:id/receive` (ถ่ายรูปรับของ)<br>• **TRANSFER:** คง Logic ตรวจสลิปและรหัส 6 หลักเดิมไว้ใช้งานควบคู่ |
| **M2** | **ปลดล็อกสิทธิ์รับออเดอร์ (Selective KYC Gate)** | `acceptOrder` บังคับ `!order.seller.isVerifiedSeller` ห้ามรับทุกออเดอร์ | อนุญาตให้ร้านที่ `isVerifiedSeller = false` กดรับออเดอร์แบบ `PICKUP` (`MEETUP`) ได้ โดยจะบล็อกเฉพาะคำสั่งซื้อแบบ `DELIVERY` (`PARCEL`) เท่านั้น |
| **M3** | **ปลดล็อก PDPA เบอร์โทรศัพท์ผู้ซื้อ** | `createOrder` โยน Error `PHONE_NUMBER_REQUIRED` ถ้าไม่มี `buyer.phoneNumber` และบังคับ `recipientPhone` | ลบเงื่อนไขบังคับ `buyer.phoneNumber` ใน `createOrder` และปรับ `recipient_phone` ใน `OrderDeliveryDetail` ให้เป็น **Optional (Nullable)** ตามกติกา PDPA v4 |
| **M4** | **สูตรคำนวณค่าส่งพัสดุ (Cross-Region Parcel Fee)** | Hardcode `40 + (books.length - 1) * 10` | ยก `regionOf` / `calcParcelFee` มาไว้ใน Backend (`shippingService`): **฿35 เล่มแรก + ฿10 เล่มถัดไป + ฿15 เมื่อจังหวัดผู้ขาย ≠ ภาคของจังหวัดผู้ซื้อ** |
| **M5** | **การตรวจสอบรูปภาพและข้อมูลหนังสือ (Book Listing)** | บังคับรูป `EDGE` (ป้ายชื่อ), รับ `category` เดียว, ไม่มีขายยกชุด | • เปลี่ยนรูปบังคับมุมที่ 4 เป็น `INNER` (และอนุโลมรับ `EDGE` เพื่อ Backward compatibility)<br>• รองรับ `is_set`, `total_volumes`, `missing_volumes`, `description`, `categories[]` (หลายหมวดหมู่), `defects`, `photo_checks`, สถานะ `HIDDEN` |
| **M6** | **Auth Middleware Coverage** | ติด `authMiddleware` เฉพาะ `userRouter.use('/me', ...)` แต่ `orders` และ `books` ดึงแค่ `x-user-id` | ติดตั้ง `authMiddleware` บนทุก Protected Route ของ `/api/orders/*`, `/api/books` (POST/PATCH/DELETE), `/api/seller/*`, `/api/upload`, `/api/notifications/*` เพื่อรองรับ LIFF JWT จริงใน Production |
| **M7** | **แก้ Bug ใน `reviewService.ts`** | บรรทัด 132 เขียน `include: { items: ... }` แต่ชื่อ relation ใน Prisma คือ `orderItems` | แก้ไข `items` เป็น `orderItems` ใน `getUserReviews()` (ไฟล์ `backend/src/services/reviewService.ts#L132`) และรองรับฟิลด์ `tags[]` |

---

### 2.2 ส่วนที่ต้อง "เพิ่มใหม่" (New Endpoints & Services — P0 ทั้งหมด)

| หมวดหมู่ | Endpoint / Service ที่ต้องสร้างใหม่ | รายละเอียดการทำงาน |
|---|---|---|
| **1. ระบบร้านค้า & จุดนัดรับ (Shop & Meetup)** | • `GET /api/seller/shop`<br>• `PUT /api/seller/shop`<br>• `GET /api/shops/:id`<br>• `POST /api/seller/meetup-points`<br>• `DELETE /api/seller/meetup-points/:pointId` | จัดการโปรไฟล์ร้าน (`shopName`, `description`, `avatar`, `province`, `availableDays`, `availableSlots`, `supportsParcel`, `shipMode`, `shipWithinDays`) และจุดนัดรับหลายจุดพร้อมพิกัด GPS ให้หน้า `/seller/setup` และ `/seller/[sellerId]` ดึงข้อมูลจริง |
| **2. ระบบ KYC บัตรประชาชน** | • `POST /api/seller/kyc` | ตรวจสอบเลขบัตรประชาชน 13 หลัก (Mod-11 Checksum) + ชื่อ-นามสกุล, บันทึกเฉพาะค่า Masked (`x-xxxx-xxxxx-12-3`) และอัปเดต `isVerifiedSeller = true` (ห้ามเก็บเลขบัตรดิบและห้ามคืนชื่อจริงให้ผู้ซื้อ) |
| **3. จัดการประกาศ & แนะนำหนังสือ** | • `PATCH /api/books/:id`<br>• `GET /api/books/recommended` | • แก้ไขราคา, คำอธิบาย, วิธีรับ, หรือเปลี่ยนสถานะเป็น `HIDDEN`/`AVAILABLE` (ล็อกห้ามแก้หากติดออเดอร์ที่ยังไม่ปิด)<br>• คืนรายการหนังสือแนะนำตามหมวดหมู่หรือหนังสือมาใหม่สำหรับแบนเนอร์หน้าแรก |
| **4. ออเดอร์: ยกเลิก, รับของ, โต้แย้ง** | • `POST /api/orders/:id/cancel`<br>• `POST /api/orders/:id/receive`<br>• `POST /api/orders/:id/complete-meetup`<br>• `POST /api/orders/:id/dispute`<br>• `POST /api/orders/:id/dispute-missed-meeting` | • `cancel`: ผู้ซื้อยกเลิกคำขอในสถานะ `REQUESTED`<br>• `receive`: ผู้ซื้อแนบ `received_photo_url` + รีวิว+`tags` ปิดออเดอร์เป็น `COMPLETED` และเปลี่ยนหนังสือเป็น `SOLD` ใน Transaction เดียว<br>• `complete-meetup`: ผู้ขายกดยืนยันส่งมอบเงินสดในโหมด `COD`<br>• `dispute` / `dispute-missed-meeting`: เปิดข้อพิพาท, หยุด Timer, และบันทึกเหตุผล |
| **5. แชทในออเดอร์ (In-Order Chat)** | • `GET /api/orders/:id/messages`<br>• `POST /api/orders/:id/messages` | • ส่ง/ดึงข้อความ `TEXT`, `SYSTEM`, `SCHEDULE_CARD` เฉพาะผู้ซื้อ/ผู้ขายในออเดอร์<br>• เปิดแชทเฉพาะสถานะหลัง `REQUESTED` และล็อกอ่านอย่างเดียวเมื่อ `COMPLETED`/`CANCELLED`<br>• กรองข้อความผ่าน `dataMaskingService` อัตโนมัติก่อนบันทึกลง DB |
| **6. ที่อยู่จัดส่งผู้ซื้อ (Addresses)** | • `GET /api/users/me/addresses`<br>• `POST /api/users/me/addresses`<br>• `PATCH /api/users/me/addresses/:id`<br>• `DELETE /api/users/me/addresses/:id` | จัดการที่อยู่จัดส่งหลายรายการ (`fullName`, `province`, `district`, `subdistrict`, `postalCode`, `detail`, `isDefault`) พร้อมจัดการ Default flag อัตโนมัติ |
| **7. แจ้งเตือน & LINE Webhook** | • `GET /api/notifications`<br>• `PATCH /api/notifications/:id/read`<br>• `PATCH /api/notifications/read-all`<br>• `POST /api/webhooks/line`<br>• `lineNotifyService.ts` | บันทึกการแจ้งเตือนลง DB แยกฝั่ง `BUYER`/`SELLER` พร้อมส่ง **LINE Flex Message** อัตโนมัติเมื่อเกิด Event ออเดอร์ (สร้างคำขอ, รับออเดอร์, นัดรับ, ส่งพัสดุ, จบงาน) |
| **8. ประวัติเครดิต (Ledger)** | • `GET /api/users/me/credits/history` | คืนรายการ `CreditTransaction` ย้อนหลังพร้อม `balance_after` และ `order_id` สำหรับหน้า `/seller/credits` |
| **9. อัปโหลดไฟล์ (Supabase Storage)** | • `POST /api/upload` (`Multer`) | รับไฟล์รูปภาพ (ไม่เกิน 5MB, ตรวจ MIME Type) อัปโหลดเข้า Supabase Storage แยก Bucket: `book-listings`, `avatars`, `slips` (Private Signed URL), `order-receives`, `disputes` |

---

## 3. ตารางจับคู่ Frontend Screens ↔ Backend APIs (Integration Matrix)

| Frontend Route / Hook | Action หลัก | API Endpoint (Target) | สถานะฝั่ง Backend |
|---|---|---|---|
| `useLiff` / `/setup` | Login ด้วย LIFF Token, ตั้งชื่อ/Avatar | `GET /api/users/me`, `PATCH /api/users/me` | ✅ มีแล้ว (ต้องเช็ก field ตอบกลับ) |
| `/addresses`, `/addresses/edit` | เพิ่ม/ลบ/ตั้งค่าเริ่มต้นที่อยู่ | `GET/POST/PATCH/DELETE /api/users/me/addresses` | ❌ **ต้องเพิ่มใหม่** |
| `/`, `/search` | ค้นหา/กรองหนังสือ & หนังสือแนะนำ | `GET /api/books`, `GET /api/books/recommended` | ⚠️ มี `GET /api/books` (ขาด `categories[]`, `isSet`, `recommended`) |
| `/book/[id]` | ดูรายละเอียดหนังสือ 4 ด้าน + ตำหนิ | `GET /api/books/:id` | ⚠️ ต้องเพิ่ม fields ใหม่ + รีวิวร้าน |
| `/seller/[sellerId]` | ดูหน้าร้านสาธารณะ + จุดนัดรับ + รีวิว | `GET /api/shops/:id`, `GET /api/users/:id/reviews` | ⚠️ ขาด `GET /api/shops/:id` + แก้ Bug `reviewService` |
| `/seller/setup` | ตั้งค่าร้าน, จุดนัดรับ, KYC บัตรประชาชน | `GET/PUT /api/seller/shop`, `POST /api/seller/meetup-points`, `POST /api/seller/kyc` | ❌ **ต้องเพิ่มใหม่** |
| `/seller/list/*` | สแกน ISBN, อัปโหลดรูป, ลงขาย | `GET /api/books/isbn/:isbn`, `POST /api/upload`, `POST /api/books` | ⚠️ ขาด `/api/upload` และปรับ validation `INNER`/ยกชุด |
| `/seller`, `/seller/listings/[id]/edit` | ดูคลังหนังสือร้าน, แก้ไข/ซ่อนประกาศ | `GET /api/users/me/books`, `PATCH /api/books/:id`, `DELETE /api/books/:id` | ⚠️ ขาด `PATCH /api/books/:id` และสถานะ `HIDDEN` |
| `/seller/credits/*` | ดูประวัติเครดิต, เติมเครดิตผ่านสลิป | `GET /api/users/me/credits/history`, `POST /api/users/me/topup-slip` | ⚠️ ขาด `/credits/history` |
| `/cart` | ส่งคำขอซื้อ + คำนวณค่าส่ง | `POST /api/orders` | ⚠️ ต้องปรับสูตรค่าส่ง ฿35+10+15 และปลดล็อกเบอร์โทร |
| `/orders`, `/orders/[id]` | ดูรายการ, รับ/ปฏิเสธ/ยกเลิก, แชท, ปิดงาน | `GET /api/orders/buying\|selling`, `GET /api/orders/:id`, `POST /accept\|reject\|cancel\|complete-meetup`, `GET/POST /messages` | ⚠️ ต้องปรับ COD, เพิ่ม `cancel`, `complete-meetup`, `messages` |
| `/orders/[id]/schedule` | นัดหมายวันเวลา & พิกัดจุดนัดรับ | `PATCH /api/orders/:id/schedule` | ✅ มีแล้ว (ปรับให้รองรับ COD ไม่บังคับรหัส 6 หลัก) |
| `/orders/[id]/tracking` | กรอกขนส่งและเลขพัสดุ | `POST /api/orders/:id/ship` | ⚠️ ต้องปรับให้รับจากสถานะ `ACCEPTED` ได้ (COD) |
| `/orders/[id]/receive` | ถ่ายรูปรับของ + ให้คะแนน + Tags | `POST /api/orders/:id/receive` | ❌ **ต้องเพิ่มใหม่** |
| `/orders/[id]/review` | ให้คะแนนและ Tags รีวิว | `POST /api/orders/:id/review` | ⚠️ ต้องเพิ่ม `tags[]` |
| `/orders/[id]/no-show` & Dispute | แจ้งไม่มาตามนัด & เปิดข้อพิพาท | `POST /api/orders/:id/report-missed-meeting`, `POST /api/orders/:id/dispute`, `POST /api/orders/:id/dispute-missed-meeting` | ⚠️ ขาด `/dispute` และ `/dispute-missed-meeting` |
| `/notifications` | ดึงแจ้งเตือนผู้ซื้อ/ผู้ขาย & อ่านแล้ว | `GET /api/notifications`, `PATCH /api/notifications/:id/read` | ❌ **ต้องเพิ่มใหม่** |
