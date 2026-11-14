# อธิบายผลตรวจโค้ดฝั่ง Backend (`ponytail-audit`)

> เอกสารนี้อธิบายผลจากการรัน `/ponytail:ponytail-audit` ฝั่ง `backend/` (ไม่แตะต้อง `frontend/`) เพื่อให้เข้าใจว่าแต่ละจุดที่ระบบแนะนำให้ตัดหรือยุบคืออะไร ทำไมถึงเข้าข่ายเขียนโค้ดเกินจำเป็น (Over-engineering) และควรตัดสินใจจัดการอย่างไร **ก่อนเริ่มเชื่อม Frontend เข้ากับ Backend**

---

## ความหมายของ Tag ที่ใช้ในผลตรวจ

| Tag | ความหมายแบบเข้าใจง่าย |
| :--- | :--- |
| **`delete`** | **โค้ดหรือไฟล์ที่ไม่มีใครเรียกใช้จริง (Dead Code)** หรือฟีเจอร์ที่เขียนเผื่อไว้ล่วงหน้าแต่ยังไม่มี route/module ไหนเรียกใช้งาน |
| **`shrink`** | **โค้ดที่ทำงานได้เหมือนเดิม แต่เขียนซ้ำซ้อนหรือยาวเกินจำเป็น** สามารถยุบเป็น helper หรือใช้ pattern เดียวกันเพื่อลดบรรทัดและลดโอกาสแก้ไม่ครบจุดได้ |
| **`stdlib`** | **ใช้ library ภายนอกมาทำงานที่ JavaScript/Node.js ทำได้ในไม่กี่บรรทัด** |
| **`yagni`** | *(You Aren't Gonna Need It)* **การสร้างโครงสร้าง/Abstraction/DI พิเศษขึ้นมาทั้งที่มีจุดใช้งานจริงแค่แบบเดียว** |

---

## สรุปภาพรวมตัวเลข

- **ดำเนินการแก้ไขแล้ว (ข้อ 1 และข้อ 6)**: ลดไปแล้ว **206 บรรทัด** (`orderService.ts` จาก 1,557 ➔ 1,377 บรรทัด = `-180` บรรทัด, `types/index.ts` จาก 29 ➔ 3 บรรทัด = `-26` บรรทัด) และผ่าน `npm run lint`, `npm run build`, `npm test` (17 ไฟล์ / 145 เคส) ครบทั้งหมด
- **จำนวนบรรทัดและ Dependency ที่ยังลดเพิ่มเติมได้ในรอบถัดไป (ข้อ 2–5, 7–10)**: **~222 บรรทัด**
  - Runtime (`dependencies`): 3 ตัว — `promptpay-qr`, `qrcode`, `zod`
  - Dev (`devDependencies`): 1 ตัว — `@types/qrcode`

---

## เจาะลึกทีละรายการ (เรียงจากจุดที่ลดได้มากที่สุดไปน้อยที่สุด)

### 1. [x] [`shrink`] โค้ดตรวจสอบออเดอร์และปิดงานซ้ำซ้อนใน `orderService.ts` (**แก้ไขแล้ว: ลดไป 180 บรรทัด จาก 1,557 ➔ 1,377 บรรทัด**)
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts)
- **สิ่งที่พบ**:
  1. แทบทุกฟังก์ชันในไฟล์นี้ (`getOrderDetail`, `acceptOrder`, `rejectOrder`, `cancelOrder`, `verifyOrderPaymentSlip`, `shipOrder`, `completeDeliveryOrder`, `receiveOrder`, `completeMeetupCodOrder`, `reportMissedMeeting`, `openDispute`, `disputeMissedMeeting`, `schedulePickupOrder`, `verifyHandoverCode`) ต้องเขียนบล็อกเดิมซ้ำๆ 14 รอบ คือ:
     - `findUnique({ where: { id: orderId } })`
     - เช็ก `if (!order)` ➔ โยน `ORDER_NOT_FOUND` (404)
     - เช็กว่าเป็น `buyerId` หรือ `sellerId` ➔ โยน `FORBIDDEN` (403)
     - เช็ก `shippingMethod` และ `status`
  2. ฟังก์ชัน `completeDeliveryOrder` (ของ route `/complete-delivery`) กับ `receiveOrder` (ของ route `/receive`) ทำ logic ปิดงานเหมือนกันคือเปลี่ยน `order.status` เป็น `'COMPLETED'` และอัปเดต `bookListing.status` เป็น `'SOLD'`
- **สิ่งที่แก้ไขแล้ว**:
  - เพิ่ม helper `loadAndAuthorizeOrder()` รวมการดึงออเดอร์ + ตรวจสิทธิ์ (`BUYER` / `SELLER` / `PARTICIPANT`) + ตรวจ `shippingMethod` + ตรวจ `allowedStatuses` ไว้ในที่เดียว
  - เพิ่ม helper `markOrderCompleted()` สำหรับปิดสถานะคำสั่งซื้อเป็น `COMPLETED` และเปลี่ยนหนังสือเป็น `SOLD` ใช้ร่วมกันทั้ง `completeDeliveryOrder`, `receiveOrder`, `completeMeetupCodOrder` และ `verifyHandoverCode`
  - ยุบ pattern `.find(...) !== undefined` เป็น `.some(...)` ใน `createOrder` และ `acceptOrder`
- **สถานะ**: **Done** (คง error message และ status code เดิม 100%, ผ่าน Unit Tests ทั้ง 145 เคส)

---

### 2. [`delete`] ไฟล์ `promptPayService.ts` และแพ็กเกจ QR ที่ยังไม่มี Route ไหนเรียกใช้ (~60 บรรทัด + 3 packages)
- **ไฟล์**: [promptPayService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/promptPayService.ts), [services.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/types/services.ts), [package.json](file:///D:/Project/GongDong-Hack-DII/backend/package.json)
- **สิ่งที่พบ**:
  - จากการค้นหาทั่วทั้ง `backend/src/` ไม่พบ route หรือ service อื่นใด import `generatePromptPayQR` หรือ `sanitizePromptPayId` ไปใช้งานจริง (มีแค่ไฟล์ test ของตัวเองคือ `promptPayService.test.ts` ที่ import)
  - ส่งผลให้แพ็กเกจ `promptpay-qr`, `qrcode` และ `@types/qrcode` ถูกติดตั้งไว้โดยไม่มี endpoint ใช้งานจริง
- **คำแนะนำก่อนเชื่อม Frontend**:
  - **ถ้า Frontend สร้าง QR Code ฝั่ง Client เองอยู่แล้ว** (หรือใช้เฉพาะโหมด `COD` เป็นหลัก): สามารถลบ `promptPayService.ts` + 3 แพ็กเกจนี้ทิ้งได้ทันที
  - **ถ้าตอนเชื่อม Frontend ต้องการให้ Backend คืน PromptPay QR สำหรับโหมด `TRANSFER`**: อย่าเพิ่งลบ แต่ให้เชื่อม `generatePromptPayQR` เข้ากับ route ที่ต้องการใช้งานจริง (เช่น `GET /api/orders/:id/qr`)

---

### 3. [`shrink`] การ map ข้อมูลร้านค้าและ `meetupPoints` ซ้ำ 3 จุดใน `shopService.ts` (~35 บรรทัด)
- **ไฟล์**: [shopService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/shopService.ts)
- **สิ่งที่พบ**:
  - โค้ดแปลง `meetupPoints.map(...)` (แปลง `lat`/`lng` เป็น `Number`) ถูกเขียนซ้ำถึง 3 ที่ (`getMyShop`, `upsertMyShop`, `getPublicShop`)
  - โครงสร้าง object ร้านค้า (`shop_name`, `description`, `available_days`, `available_slots`, `supports_parcel`, ...) ถูกเขียนซ้ำระหว่าง `getMyShop` กับ `upsertMyShop`
  - ใน `upsertMyShop` มีการเขียนก้อน `update: { ... }` และ `create: { userId, ... }` ที่มี field เหมือนกันทั้งหมด
- **แนวทางแก้ให้สั้นลง**: แยก helper `mapMeetupPoint()`, `formatShopProfile()` และตัวแปร `shopWriteData` ใช้ร่วมกัน

---

### 4. [`shrink`] Route Alias และ Wrapper Function ซ้ำซ้อนใน `routes/orders.ts` (~30 บรรทัด)
- **ไฟล์**: [orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts)
- **สิ่งที่พบ**:
  - มี endpoint ที่ทำหน้าที่เดียวกันแต่ตั้งชื่อ route ซ้อนไว้หลายเส้น เช่น:
    - `POST /:id/complete-delivery` กับ `POST /:id/confirm-receipt` (เรียก `handleCompleteDelivery` เหมือนกัน)
    - `POST /:id/report-missed-meeting` กับ `POST /:id/missed-meeting` (เรียก `handleMissedMeeting` เหมือนกัน)
    - `POST /:id/ship` กับ `PATCH /:id/ship` (เรียก `handleShipOrder` เหมือนกัน)
- **คำแนะนำก่อนเชื่อม Frontend**:
  - Express รองรับการส่ง array ของ path เช่น `orderRouter.post(['/:id/ship', '/:id/ship-alt'], ...)` หรือเมื่อเชื่อม Frontend เสร็จแล้วให้ดูว่า Frontend เรียกเส้นไหนจริง แล้วลบรูทที่ไม่ได้ใช้ออกได้

---

### 5. [`shrink`] โค้ดสร้าง User ใหม่ + แจกเครดิตฟรีซ้ำ 2 จุดใน `auth.ts` (~30 บรรทัด)
- **ไฟล์**: [auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts)
- **สิ่งที่พบ**:
  - Logic การสร้าง user ใหม่พร้อมบันทึก `creditTransaction` ประเภท `SIGNUP_BONUS` (+1 เครดิต) ถูกเขียนซ้ำทั้งก้อนระหว่างบล็อก `mock_` token (บรรทัด 111–130) กับบล็อก LINE Token จริง (บรรทัด 150–170)
  - มีฟังก์ชัน factory `createAuthMiddleware(options)` และ interface `AuthMiddlewareOptions` ที่สร้างมาเพื่อให้ unit test ส่ง `tokenVerifier` เข้ามาได้
- **แนวทางแก้ให้สั้นลง**: แยก helper เดียวชื่อ `createUserWithBonus(lineUserId, displayName, pictureUrl)` ใช้ร่วมกันทั้งสองโหมด

---

### 6. [x] [`delete`] Type ที่ประกาศซ้ำและไม่ได้ใช้ใน `types/index.ts` (**แก้ไขแล้ว: ลดไป 26 บรรทัด จาก 29 ➔ 3 บรรทัด**)
- **ไฟล์**: [index.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/types/index.ts)
- **สิ่งที่พบ**:
  - `types/index.ts` มีการประกาศ type ทิ้งไว้ เช่น `BookGrade`, `BookListingStatus` (ซึ่งข้อมูลเก่าตกยุค ยังขาด `'HIDDEN'`), `ShippingMethod`, `OrderStatus`, `SlipType`, `VerificationStatus`
  - ในทางปฏิบัติ ทุกไฟล์ในระบบใช้ type จาก [services.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/types/services.ts) ผ่าน `export * from './services'` อยู่แล้ว (แถม `BookGrade` ก็ประกาศซ้ำใน `services.ts` ด้วย)
- **สิ่งที่แก้ไขแล้ว**: ลบ type ส่วนเกินที่ไม่ถูก import ใช้งานออกทั้งหมด คงไว้เฉพาะ `export * from './services'` เป็น Single Source of Truth
- **สถานะ**: **Done** (ผ่าน `tsc --noEmit` และ `tsc` 0 errors)

---

### 7. [`shrink`] โค้ด `normalize` และ `upsert` ซ้ำกันใน `bookService.ts` (~25 บรรทัด)
- **ไฟล์**: [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts)
- **สิ่งที่พบ**:
  - การเช็ก `Array.isArray(item.categories) && item.categories.length > 0 ? ...` เขียนซ้ำ 3 จุด (`mapBookFeedItem`, `getBookListingDetail`, `getUserBookListings`)
  - ใน `createBookListing` มีการเขียนก้อน `update` และ `create` ของ `bookCatalog.upsert` ซ้ำกันทุก field ยกเว้น `isbn`
  - การ select `seller` เขียนซ้ำระหว่าง `FEED_BOOK_INCLUDE` กับ `getBookListingDetail`
- **แนวทางแก้ให้สั้นลง**: แยก helper `normalizeCategories()` และ `catalogFields` (ลดโค้ดซ้ำและกันแก้ไขไม่ครบ)

---

### 8. [`shrink`] Pattern ตรวจเบอร์โทร / พร้อมเพย์ซ้ำกันใน `userService.ts` (~20 บรรทัด)
- **ไฟล์**: [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts)
- **สิ่งที่พบ**:
  - ใน `updateUserProfile` มีบล็อก `trim()` -> `replace(/[-\s]/g, '')` -> `RegExp.test()` -> throw `AppError` หน้าตาเหมือนกันเป๊ะ 2 รอบ (รอบแรกสำหรับ `phone_number`, รอบสองสำหรับ `promptpay_id`)
  - มี `TopupSlipVerifier` callback abstraction ที่ถูกใช้จริงแค่ใน unit test 1 กรณี
- **แนวทางแก้ให้สั้นลง**: สร้าง helper เล็กๆ สำหรับ clean + validate regex แทนการเขียนซ้ำ 2 รอบ

---

### 9. [`stdlib`] ใช้ `zod` ทั้งแพ็กเกจเพียงเพื่ออ่านค่า `.env` ใน `env.ts` (~12 บรรทัด + 1 package)
- **ไฟล์**: [env.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/config/env.ts), [package.json](file:///D:/Project/GongDong-Hack-DII/backend/package.json)
- **สิ่งที่พบ**:
  - ทั้ง `backend/` มีการ `import { z } from 'zod'` แค่ในไฟล์ `env.ts` เพียงไฟล์เดียว เพื่อแปลง `PORT` เป็นตัวเลขและตรวจ `NODE_ENV` (`development` | `production` | `test`) ส่วนค่าอื่นๆ เป็น `string | undefined` หมด
- **คำแนะนำ**:
  - ถ้าไม่ได้จะนำ `zod` มาใช้ validate request body ใน route อื่นๆ สามารถใช้ `parseInt(process.env.PORT || '8000', 10)` และเช็ก `NODE_ENV` ด้วย JavaScript ปกติได้เลย แล้วถอด `zod` ออกจาก `package.json` (แต่ถ้าวางแผนจะใช้ `zod` validate payload ของ API ในอนาคต ก็เก็บไว้ใช้งานต่อได้)

---

### 10. [`yagni`] สร้าง Supabase Client ใหม่ทุกครั้งที่อัปโหลดรูปใน `uploadService.ts` (~10 บรรทัด)
- **ไฟล์**: [uploadService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/uploadService.ts)
- **สิ่งที่พบ**:
  - `getSupabaseAdminClient()` เรียก `createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, ...)` ใหม่ทุกครั้งที่มีคนยิง `POST /api/upload`
  - พารามิเตอร์ `supabaseClientOverride` ถูกเพิ่มเข้ามาเฉพาะเพื่อทำ mock ใน unit test 1 ไฟล์
- **แนวทางแก้ให้สั้นลง**: สร้าง Supabase client เป็น singleton ระดับ module เพียงครั้งเดียวเมื่อมี env key

---

## คำแนะนำก่อนลงมือเชื่อม Frontend กับ Backend

1. **พร้อมเชื่อม Frontend ได้ทันที** — หลังแก้ไขข้อ 1 ([orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts)) และข้อ 6 ([index.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/types/index.ts)) แล้ว Backend ผ่านการตรวจสอบทั้งหมด:
   - `npm run lint` (`tsc --noEmit`): ผ่าน 0 errors
   - `npm run build` (`tsc`): ผ่าน 0 errors
   - `npm test` (`vitest run`): ผ่าน **17/17 ไฟล์ (145/145 เคส)**
2. **จุดที่ควรระวังเวลาเชื่อม Frontend**:
   - **เรื่อง `promptPayService` (ข้อ 2)**: เช็กให้ชัวร์ก่อนว่า Frontend หน้าจ่ายเงินโอน (`TRANSFER`) คาดหวังให้ Backend ส่งรูป QR มาให้หรือไม่ ถ้าไม่ใช้ค่อยลบ
   - **เรื่อง Route Aliases ใน `orders.ts` (ข้อ 4)**: เก็บไว้ชั่วคราวระหว่างเชื่อม Frontend ก่อนได้ พอเชื่อมครบทุกหน้าแล้วค่อยลบรูทซ้ำออก
   - **ข้อ 1 และข้อ 6**: ~~แนะนำให้ทำก่อนเชื่อม~~ **ดำเนินการเรียบร้อยแล้ว** ✅
