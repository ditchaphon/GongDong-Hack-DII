# รายงานตรวจสอบช่องโหว่และความซับซ้อนเกินจำเป็นของระบบ (Security, Logic & Ponytail Audit)

> **วันที่ตรวจสอบ**: 2026-11-18  
> **สถานะการแก้ไขล่าสุด (2026-11-18)**: ✅ **แก้ไขครบทั้ง 2 CRITICAL และ 4 HIGH แล้ว** (Zero DB Migration — พร้อมผ่าน `tsc --noEmit` ทั้ง Backend/Frontend และ Unit Tests 21 ไฟล์ / 249 เคส; ส่วน MEDIUM และ LOW คงไว้เป็นแผนถัดไป)
> **ขอบเขต**: ตรวจสอบโค้ดจริงทั้ง `backend/` และ `frontend/` (อัปเดตสถานะล่าสุดหลังการแก้ไขในรอบก่อนหน้า)  
> **วัตถุประสงค์**:
> 1. **ตรวจหาช่องโหว่ด้านความปลอดภัย ตรรกะธุรกิจ (Business Logic) และ PDPA** ที่ยังหลงเหลืออยู่ในโค้ดปัจจุบัน พร้อมอธิบายสาเหตุ ผลกระทบ และแนวทางแก้ไขแบบเข้าใจง่าย
> 2. **ตรวจหาความซับซ้อนเกินจำเป็น (Over-engineering / Dead Code)** ตามเกณฑ์ `/ponytail:ponytail-audit`

---

## ส่วนที่ 1: ช่องโหว่ความปลอดภัยและตรรกะธุรกิจ (Security & Business Logic Vulnerabilities)

### สรุปภาพรวมตามระดับความรุนแรง

| ระดับ | จำนวน | ประเด็นหลัก |
| :--- | :---: | :--- |
| **CRITICAL** | 2 | ช่องโหว่ตรวจสลิปเติมเครดิตไม่เช็กผู้รับเงิน / สลิปสั่งซื้อข้ามชื่อผู้รับ, ผู้ขายตั้งเวลานัดและยืนยันแทนผู้ซื้อเองเพื่อกดรายงาน No-Show |
| **HIGH** | 4 | Brute-force รหัส 6 หลักบน Vercel (In-memory store + ไม่มี Rate Limit), ผู้ขายติด Blacklist ยังลงขาย/รับนัดรับได้, Auth Bypass เมื่อ `NODE_ENV !== 'production'`, ข้อมูลติดต่อหลุดนอกแอปผ่านรายละเอียดหนังสือ/เหตุผลยกเลิก |
| **MEDIUM** | 3 | ไม่ตรวจ URL scheme ในสลิป/รูปรับของ, ไฟล์ `disputes` ถูกลบได้แม้ยังอ้างอิง + DoS โหลดรีวิวทั้งหมดลง RAM, ผู้ซื้อยกเลิกออเดอร์ `SCHEDULED` หนี No-Show |
| **LOW** | 3 | หน้า `/design-system` และ `/line-preview` เปิดอยู่ใน Production, `next/image` ยอมรับโดเมน `**`, CDN Cache หนังสือค้างหลัง `RESERVED`/`SOLD` |

---

### [CRITICAL-1] ระบบตรวจสลิปเติมเครดิตไม่ตรวจบัญชีผู้รับ (`receiverName`) และสลิปสั่งซื้อข้ามชื่อผู้รับได้

- **ไฟล์ที่เกี่ยวข้อง**:
  - [users.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/users.ts#L143-L157)
  - [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L310-L315)
  - [slipokService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/slipokService.ts#L54-L98)
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1861-L1943)
- **ปัญหาที่พบ**:
  1. **ฝั่งเติมเครดิต (`POST /api/users/me/topup-slip`)**:
     - [users.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/users.ts#L148-L155) เรียก `verifySlipWithSlipOk(url)` โดย **ไม่ส่ง `amount`** และดึงกลับมาแค่ `{ transRef, amount, senderName }` โดย **ทิ้ง `receiverName`** ไปเลย
     - `processTopupSlip` เช็กแค่ว่ายอดเงินตรงกับแพ็กเกจ (฿20 / ฿50 / ฿100) หรือไม่ และ `transRef` ซ้ำหรือไม่ **แต่ไม่ได้ตรวจว่าโอนเข้าบัญชีแพลตฟอร์มจริงหรือไม่** (หากบัญชี SlipOK Branch ไม่ได้เปิดล็อกชื่อ/เลขบัญชีผู้รับไว้ หรือใช้ Branch เดียวกับฝั่ง P2P ออเดอร์ ผู้ไม่หวังดีสามารถนำสลิปที่โอนเงินให้เพื่อน ฿20/฿50/฿100 มาเติมเครดิตและปลดล็อก `isVerifiedSeller = true` ได้ฟรี)
  2. **ฝั่งชำระเงินค่าหนังสือ (`POST /api/orders/:id/payment-slip`)**:
     - ใน [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1930-L1943) ใช้เงื่อนไข `if (input.receiverName && order.seller.verifiedName)` — หาก SlipOK ไม่ได้ส่ง `receiverName` กลับมา (`undefined`) หรือผู้ขายยังไม่มี `verifiedName` เงื่อนไขตรวจสอบชื่อผู้รับเงินจะถูก **ข้ามไปทั้งหมด**
- **แนวทางแก้ไข**:
  - ส่ง `receiverName` จาก `verifySlipWithSlipOk` เข้าไปใน `processTopupSlip` และบังคับเทียบกับชื่อบัญชีรับชำระของแพลตฟอร์ม (`env.PLATFORM_RECIPIENT_NAME` / ค่าที่ตั้งไว้) รวมถึงตั้งค่าล็อกบัญชีผู้รับบน SlipOK Branch ให้ชัดเจน
  - ใน `verifyOrderPaymentSlip` เมื่อใช้งานจริงกับ `slipVerifier` ให้บังคับว่าต้องมีผลยืนยันผู้รับเงินสอดคล้องกับผู้ขาย (และผู้ขายโหมด `TRANSFER` ต้องมี `verifiedName` จาก KYC แล้ว)

---

### [CRITICAL-2] ผู้ขายตั้งเวลานัดรับและตั้งสถานะ `scheduleConfirmedByBuyer = true` เองได้ เพื่อกดรายงาน No-Show ใส่ผู้ซื้อ

- **ไฟล์ที่เกี่ยวข้อง**:
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L93-L98) (`validateScheduledAtFuture`)
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L2277-L2292) (`reportMissedMeeting`)
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L2513-L2531) (`schedulePickupOrder`)
- **ปัญหาที่พบ**:
  - ใน `schedulePickupOrder` (`PATCH /api/orders/:id/schedule`) อนุญาตให้ **ทั้งผู้ซื้อ (`BUYER`) และผู้ขาย (`SELLER`)** เป็นคนบันทึกนัดหมายได้ เมื่อสถานะยังเป็น `ACCEPTED`
  - **จุดโหว่**: บรรทัดที่ `2530` ตั้งค่า `scheduleConfirmedByBuyer: true` **เสมอ** แม้ว่า `actorRole === 'SELLER'` ก็ตาม (ผู้ซื้อไม่เคยกดยืนยันเลย)
  - ประกอบกับ `validateScheduledAtFuture` มี `SCHEDULE_PAST_GRACE_MS = 5 นาที` (อนุญาตให้ตั้งเวลาย้อนหลังได้สูงสุด ~4–5 นาที)
  - **ผลกระทบ**: ผู้ขายที่ไม่สุจริตสามารถรับออเดอร์ ➔ เรียก `PATCH /api/orders/:id/schedule` ตั้งเวลาเป็น `4 นาทีที่แล้ว` ➔ ระบบล็อกเป็น `SCHEDULED` และถือว่าผู้ซื้อยืนยันแล้ว (`scheduleConfirmedByBuyer = true`) ➔ รออีก 11 นาทีแล้วกด `reportMissedMeeting` (ครบ `scheduledAt + 15 นาที`) เพื่อเปิดข้อพิพาทและกล่าวหาว่าผู้ซื้อเบี้ยวนัดได้ทันที
- **แนวทางแก้ไข**:
  - หาก `actorRole === 'SELLER'` ใน `schedulePickupOrder` ให้ตั้ง `scheduleConfirmedByBuyer: false` และสร้าง endpoint ให้ผู้ซื้อกดยืนยันแยกต่างหาก (หรือบังคับให้เฉพาะผู้ซื้อ/หรือผู้รับข้อเสนออีกฝ่ายเป็นคนยืนยัน) ก่อนจึงจะอนุญาตให้ `reportMissedMeeting` ทำงานได้

---

### [HIGH-1] Brute-Force รหัสส่งมอบ 6 หลักบน Serverless และไม่มี API Rate Limiting

- **ไฟล์ที่เกี่ยวข้อง**:
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L40-L47) (`idempotencyStore`, `handoverAttemptsStore`, `userMaintenanceCooldown`)
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L2598-L2636) (`verifyHandoverCode`)
  - [auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L7-L10) (`verifiedLineTokenCache`)
  - [index.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/index.ts#L29-L56)
  - [vercel.json](file:///D:/Project/GongDong-Hack-DII/backend/vercel.json#L1-L4)
- **ปัญหาที่พบ**:
  1. `handoverAttemptsStore` ที่จำกัดการกรอกรหัสส่งมอบ 6 หลักผิดไม่เกิน 5 ครั้งใน 15 นาที **ถูกเก็บไว้ใน Memory (`Map`)** ของ Node.js Process เมื่อ Deploy บน **Vercel Serverless** แต่ละ Serverless Instance จะมี RAM แยกกันและรีเซ็ตเมื่อ Cold Start ทำให้ผู้โจมตียิงเดารหัสข้าม Instance ได้โดยไม่ติด Lockout (เพื่อปิดออเดอร์ `SCHEDULED -> COMPLETED` และเปลี่ยนสถานะหนังสือเป็น `SOLD` โดยไม่ต้องส่งมอบจริง)
  2. ระบบ Express (`index.ts`) **ไม่มี Rate Limiter ระดับ IP/User** เลย ทำให้อินทิเกรชันที่มีต้นทุน/โควตาภายนอก เช่น `/api/seller/kyc` (ยิง Blacklistseller API), `/api/users/me/topup-slip` (ยิง SlipOK), `/api/upload` (อัปโหลด 5MB เข้า Supabase) เสี่ยงถูกยิงสแปมจนโควตาเต็มหรือ Bandwidth เต็ม
- **แนวทางแก้ไข**:
  - ย้ายตัวนับ `handoverAttempts` (จำนวนครั้งผิด + `lockedUntil`) ลงคอลัมน์ในตาราง `Order` ใน PostgreSQL เพื่อให้อยู่ใน Transaction และใช้ร่วมกันได้ทุก Serverless Instance
  - เพิ่ม Rate Limiting Middleware (เช่น Redis/Upstash หรือ Rate Limit ของ Vercel WAF/Middleware) โดยเฉพาะ endpoint `handover`, `kyc`, `topup-slip`, `payment-slip`, `upload`

---

### [HIGH-2] ผู้ขายที่ติด `isBlacklisted = true` จาก Blacklistseller ยังลงขายและรับออเดอร์นัดรับได้

- **ไฟล์ที่เกี่ยวข้อง**:
  - [schema.prisma](file:///D:/Project/GongDong-Hack-DII/backend/prisma/schema.prisma#L37)
  - [shopService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/shopService.ts#L488-L507)
  - [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L351-L385)
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1370-L1377)
- **ปัญหาที่พบ**:
  - เมื่อผู้ใช้ยืนยัน KYC แล้วพบประวัติใน Blacklistseller ระบบบันทึก `isBlacklisted = true` และ `isVerifiedSeller = false`
  - แต่ในโค้ด `createBookListing` ([bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts)), `acceptOrder` ([orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1371) เช็กแค่กรณี `DELIVERY`) และ `authMiddleware` **ไม่มีจุดไหนตรวจสอบ `user.isBlacklisted` เลย**
  - **ผลกระทบ**: ผู้ขายที่ถูกตรวจพบว่าอยู่ในบัญชีดำยังสามารถสร้างประกาศขายหนังสือและกดรับออเดอร์แบบนัดรับ (`PICKUP`) ได้ตามปกติ
- **แนวทางแก้ไข**:
  - เพิ่มเงื่อนไขปฏิเสธ (`403 ACCOUNT_BLACKLISTED`) หาก `user.isBlacklisted === true` ใน `createBookListing`, `acceptOrder`, `upsertMyShop` และอาจแสดงแบนเนอร์/ระงับสิทธิ์การขายใน UI

---

### [HIGH-3] Auth Bypass เมื่อ `NODE_ENV !== 'production'` และ Fallback `x-user-id` ใน `requestUser.ts`

- **ไฟล์ที่เกี่ยวข้อง**:
  - [auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L207-L249)
  - [requestUser.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/utils/requestUser.ts#L7-L11)
  - [admin.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/admin.ts#L70-L81)
- **ปัญหาที่พบ**:
  - `auth.ts` เปิดโหมด Bypass (`x-user-id` และ `Bearer mock_<id>`) อัตโนมัติตราบใดที่ `process.env.NODE_ENV !== 'production'` หาก Deploy ขึ้น Preview/Staging โดยไม่ได้ตั้ง `NODE_ENV=production` ผู้ไม่หวังดีสามารถสวมรอยเป็น User หรือ **Admin** (ถ้ามี `ADMIN_LINE_USER_IDS`) ได้ทันทีด้วยการส่ง `Authorization: Bearer mock_<adminLineUserId>` และยังสร้างบัญชีใหม่พร้อม `+1 เครดิต` ได้ไม่จำกัด
  - `getUserIdFromRequest(req)` ยังมี fallback อ่าน `req.headers['x-user-id']` โดยตรง (แม้ route ปัจจุบันจะมี `authMiddleware` คั่น แต่หากลืมใส่ middleware ใน route ใหม่ในอนาคตจะเกิด Auth Bypass ทันที)
- **แนวทางแก้ไข**:
  - ควบคุม Mock Auth ด้วย Flag เฉพาะ เช่น `process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AUTH === 'true'` แทนการเปิดตลอดใน non-production
  - ลบ `(req.headers['x-user-id'] as string)` ออกจาก `getUserIdFromRequest` ให้เชื่อเฉพาะ `req.userId` ที่ผ่าน `authMiddleware` เท่านั้น

---

### [HIGH-4] ข้อมูลติดต่อหลุดนอกแอป (Contact-Leak / PDPA Bypass) ผ่านรายละเอียดหนังสือและเหตุผลยกเลิก

- **ไฟล์ที่เกี่ยวข้อง**:
  - [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L556-L566) (`createBookListing`), [L657-L671](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L657-L671) (`updateBookListing`)
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1689-L1710) (`cancelOrder`), [L2347-L2375](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L2347-L2375) (`openDispute`)
  - [dataMaskingService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/dataMaskingService.ts#L4-L20)
- **ปัญหาที่พบ**:
  - แม้แชท (`messageService.ts`), รีวิว (`reviewService.ts`) และโปรไฟล์ร้าน (`shopService.ts`) จะกรอง/เซ็นเซอร์ด้วย `maskSensitiveData()` แล้ว แต่ **ฝั่ง Backend ไม่ได้ตรวจหรือเซ็นเซอร์ `description` และ `pickupLocationName` ของหนังสือ** รวมถึง `cancelReason` / `disputeReason`
  - ผู้ขายสามารถใส่เบอร์โทร, LINE ID (`@xxx`), หรือลิงก์ติดต่อในช่อง `คำอธิบายเพิ่มเติม` ของหนังสือเพื่อชวนผู้ซื้อทักนอกแอปและเลี่ยงการเสีย 1 เครดิตได้
- **แนวทางแก้ไข**:
  - เรียก `maskSensitiveData()` เพื่อปฏิเสธหรือเซ็นเซอร์ข้อมูลติดต่อใน `description` และ `pickupLocationName` ของ `createBookListing` / `updateBookListing` รวมถึง `cancelReason` / `disputeReason`

---

### [MEDIUM-1] ช่องโหว่ URL Validation, Private Bucket `disputes`, และ DoS ใน Review Pagination

- **ไฟล์ที่เกี่ยวข้อง**:
  - [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1855-L1857) (`verifyOrderPaymentSlip`), [L2126-L2128](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L2126-L2128) (`receiveOrder`)
  - [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L367-L375) (`createBookListing`), [L667-L671](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L667-L671) (`updateBookListing`)
  - [uploadService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/uploadService.ts#L442) (`isStorageUrlReferencedInDb`)
  - [reviewService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/reviewService.ts#L174-L234) (`getUserReviews`)
- **ปัญหาที่พบ**:
  1. `verifyOrderPaymentSlip` ไม่ได้เช็กว่า `slipImageUrl` ขึ้นต้นด้วย `https://` หรือเป็น URL จาก Storage ของระบบ และ `receiveOrder` ไม่ได้เช็ก format ของ `receivedPhotoUrl` เลย (ส่ง `javascript:...` หรือข้อความสุ่มมาได้) ส่วน `createBookListing` ยอมรับ `http://` ทั่วไปได้
  2. `updateBookListing` ไม่ได้ตรวจสอบช่วงพิกัด `pickupLat` (`-90..90`) / `pickupLng` (`-180..180`) เหมือนตอน `addMeetupPoint`
  3. ใน `uploadService.ts` ฟังก์ชัน `isStorageUrlReferencedInDb` ไม่ได้เช็กการอ้างอิงสำหรับ bucket `disputes` (คืน `false` เสมอที่บรรทัด `442`) ทำให้รูปหลักฐานข้อพิพาทถูกลบผ่าน `DELETE /api/upload` ได้
  4. `getUserReviews` (`GET /api/users/:id/reviews` ซึ่งเป็น Public endpoint) ดึงรีวิว **ทั้งหมด** พร้อม `include` ซ้อนลึก 4 ชั้น (`order -> orderItems -> bookListing -> bookCatalog`) เข้ามาใน Memory ก่อนแล้วค่อย `.slice(offset, offset + limit)` แทนการใช้ `aggregate` + `take/skip` ใน Prisma หากร้านมีรีวิวจำนวนมากอาจทำให้ API ช้าหรือ Memory พุ่ง (DoS)
- **แนวทางแก้ไข**:
  - สร้าง helper ตรวจ URL ให้รองรับเฉพาะ `https://` (และแนะนำตรวจ domain Supabase ของโปรเจกต์ใน Production) ใช้ร่วมกันใน `bookService`, `orderService`, `userService`
  - แยก query `review.aggregate` / `groupBy` สำหรับ `summary` และใช้ `take`/`skip` ใน `review.findMany`

---

### [MEDIUM-2] ผู้ซื้อยกเลิกออเดอร์สถานะ `SCHEDULED` ได้หลังเลยเวลานัดหมายเพื่อหนี No-Show

- **ไฟล์ที่เกี่ยวข้อง**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1695-L1711)
- **ปัญหาที่พบ**:
  - `cancelOrder` อนุญาตให้ `BUYER` ยกเลิกคำสั่งซื้อในสถานะ `SCHEDULED` ได้ทุกเมื่อ โดยไม่มีเงื่อนไขตรวจเวลา `scheduledAt`
  - หากผู้ซื้อไม่ไปตามนัดและเห็นว่าเลยเวลานัดไปแล้ว สามารถรีบกดยกเลิกก่อนผู้ขายกดรายงาน No-Show (`scheduledAt + 15 นาที`) เพื่อหลีกเลี่ยงการถูกบันทึกประวัติได้
- **แนวทางแก้ไข**:
  - เมื่อสถานะเป็น `SCHEDULED` และมี `scheduledAt` ให้จำกัดไม่ให้ผู้ซื้อยกเลิกเองหลังจากใกล้หรือเลยเวลานัด (เช่น ก่อน `scheduledAt - 30 นาที`) หากพ้นกำหนดต้องเข้า flow ข้อพิพาทหรือให้ผู้ขายดำเนินการ

---

### [LOW] ช่องโหว่และการตั้งค่าความปลอดภัยเพิ่มเติม (Hardening)

1. **หน้า Dev/Showcase เปิดใช้งานใน Production**:
   - [design-system/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/design-system/page.tsx) และ [line-preview/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/line-preview/page.tsx) **ยังไม่มีการเช็ก `NODE_ENV !== 'production'`** (มีเพียง [debug/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/debug/page.tsx#L11-L13) เท่านั้นที่ปิดใน Production)
2. **Next.js Image Optimization เปิดรับทุกโดเมน (`hostname: "**"`)**:
   - [next.config.ts](file:///D:/Project/GongDong-Hack-DII/frontend/next.config.ts#L20-L25) อนุญาต `remotePatterns` แบบ wildcard `**` สำหรับทุก HTTPS host เสี่ยงถูกใช้ Image Optimization Endpoint (`/_next/image`) เป็น Proxy ดึงรูปจากภายนอกที่ไม่เกี่ยวข้อง
3. **CDN Cache ค้างสถานะหนังสือหลังถูกจอง/ขาย/ซ่อน**:
   - [books.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/books.ts#L156-L231) ตั้ง `Cache-Control: public, max-age=0, s-maxage=15, stale-while-revalidate=60` ทำให้ผู้ซื้อคนอื่นอาจเห็นหนังสือที่ถูก `RESERVED`/`SOLD`/`HIDDEN` ไปแล้วยังขึ้นว่า `AVAILABLE` บน CDN ได้นานถึง ~75 วินาที

---

## ส่วนที่ 2: ผลตรวจความซับซ้อนเกินจำเป็น (`/ponytail:ponytail-audit`)

> ตรวจทั้ง Repository (`frontend/` + `backend/`) เฉพาะด้าน Over-engineering, Dead Code และโค้ดซ้ำซ้อน (อัปเดตตามสถานะไฟล์จริง ณ วันที่ 2026-11-18 — หมายเหตุ: `MockQr.tsx`, `mocks/seller.ts`, `mocks/shops.ts`, `lib/qr.ts` จากรอบก่อนถูกลบออกไปแล้ว)

### Findings (Biggest Cut First)

- `delete` Prototype design-system gallery, unused showcase components, and static mock fixtures (`design-system/page.tsx`, `V4Showcase.tsx`, `mocks/books.ts`, `mocks/v4.ts`, `OrderCard.tsx`, `Skeleton.tsx`, `TrustBadge.tsx`, `CreditPackCard.tsx`, `DateTimePicker.tsx`, `NextActionCard.tsx`, `OrderTimeline.tsx`) which have 0 imports in any production route. Remove `/design-system`, `mocks/`, and the 8 unused components (plus their exports in `components/ui/index.ts` and `components/v4/index.ts`). [frontend/src/app/design-system/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/design-system/page.tsx) [frontend/src/components/v4/V4Showcase.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/V4Showcase.tsx) [frontend/src/mocks/](file:///D:/Project/GongDong-Hack-DII/frontend/src/mocks/v4.ts)
- `delete` Spec-only LINE Flex template preview route & stub (`line-preview/page.tsx`, `lib/lineAssets.ts`) which has 0 callers in production flows and duplicates backend Flex cards in `lineNotifyService.ts`. Delete both files once LINE Flex preview is no longer needed. [frontend/src/app/line-preview/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/line-preview/page.tsx) [frontend/src/lib/lineAssets.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/lineAssets.ts)
- `delete` Prototype client-side credit ledger simulator (`balanceOf`, `canAcceptOrder`, `spendForAccept`, `refundNoShow`, `topUp`, `signupBonus`, `push`, `ACCEPT_COST`, `SIGNUP_BONUS`) and duplicate `CREDIT_PACKS` array. Keep only `CREDIT_REASON_LABEL` + `sortLedger` (or inline into `seller/credits/page.tsx`) and reuse `CREDIT_PACKAGES` from `catalog.ts`. [frontend/src/lib/creditLedger.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/creditLedger.ts)
- `shrink` Repeated shop-group pickup availability & parcel fee calculation (`availableDays`, `expandShopHourlySlots`, `upcomingDates`, `findFirstFreeDateAndSlot`, `calcParcelFee`) computed separately in `evaluateShopGroup`, `useEffect`, `totals`, and `handleSubmit`. Compute once per shop group in a single memoized map. [frontend/src/app/cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx)
- `shrink` Duplicated `buying`/`selling` summary mappers (`includeDetails` branch vs summary-only branch) inside `getUserOrders`. Extract one shared `mapOrderSummaryItem(order, role)` helper. [backend/src/services/orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1231-L1317)
- `shrink` Duplicated `categories` resolution, `_catalogSnapshot` field fallback (`title`/`author`/`originalPrice`), and `seller` select across `mapBookFeedItem`, `getBookListingDetail`, `getUserBookListings`, and `getPreviousListingsByIsbn`. Extract `resolveBookMetadata(item)` and `SELLER_SUMMARY_SELECT`. [backend/src/services/bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts)
- `shrink` Duplicated `meetupPoints.map` (3 sites), shop DTO serialization (`getMyShop` vs `upsertMyShop`), and identical `update`/`create` payloads in `upsertMyShop`. Extract `formatShopProfile(shop)` and reuse `shopData`. [backend/src/services/shopService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/shopService.ts)
- `shrink` Duplicated `trim().replace(/[-\s]/g, '')` + regex + `AppError` validation for `phone_number` and `promptpay_id`, plus single-implementation `TopupSlipVerifier` DI parameter in `userService.ts`. Extract `normalizeDigitField()` and call `verifySlipWithSlipOk` directly or keep minimal options. [backend/src/services/userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L209-L241)
- `yagni` Single-implementation `createAuthMiddleware(options)` factory & `AuthMiddlewareOptions` interface, plus repeated `touchUserLastActive` + `req.user` assignment across 3 branches (`x-user-id`, `mock_`, LINE token). Export `authMiddleware` directly with one `attachUser(req, user)` helper. [backend/src/middlewares/auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L189-L284)
- `delete` Unused `orderRouter` aliases (`PATCH /:id/ship`, `POST /:id/confirm-receipt`, `POST /:id/missed-meeting`) never called by Frontend (`useV4Orders.tsx` uses `POST /:id/ship`, `POST /:id/complete-delivery`, `POST /:id/report-missed-meeting`). Drop the 3 duplicate route bindings. [backend/src/routes/orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts#L565-L620)
- `stdlib` `zod` dependency used solely in `env.ts` to coerce `PORT` integer and validate `NODE_ENV` enum. Replace with `Number.parseInt` and a `Set(['development', 'production', 'test'])` check, then drop `zod`. [backend/src/config/env.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/config/env.ts) [backend/package.json](file:///D:/Project/GongDong-Hack-DII/backend/package.json#L34)
- `delete` Unused `tailwind-merge` dependency (`^3.7.0`) with zero imports across `frontend/src`. Remove from `frontend/package.json`. [frontend/package.json](file:///D:/Project/GongDong-Hack-DII/frontend/package.json#L28)

### Net Removable Summary

- **Lines removable**:
  - **~2,320 lines** total if removing `/design-system` + `/line-preview` + unused showcase/mock files (`~2,080` lines Frontend + `~240` lines Backend deduplication/cleanup), **or**
  - **~310 lines** if keeping `/design-system` and `/line-preview` intact (`~70` lines from `creditLedger.ts` + `cart/page.tsx`, and `~240` lines of duplication/boilerplate across `orderService.ts`, `bookService.ts`, `shopService.ts`, `userService.ts`, `auth.ts`, `env.ts`, `routes/orders.ts`).
- **Dependencies removable (2)**:
  - `tailwind-merge` in [frontend/package.json](file:///D:/Project/GongDong-Hack-DII/frontend/package.json#L28) (0 imports)
  - `zod` in [backend/package.json](file:///D:/Project/GongDong-Hack-DII/backend/package.json#L34) (only used in `env.ts`)
