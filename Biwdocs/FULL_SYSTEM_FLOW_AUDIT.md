# GongDong Full System Flow Audit (ช่องโหว่ ความเสี่ยง และบั๊กทั้งระบบ)

> **วันที่ตรวจสอบ**: 2026-11-14 (ตรวจโค้ด Backend + Frontend ทั้งระบบ หลังอัปเดต Multi-Seller Batch Order Flow ณ commit `2581a83`)  
> **หมายเหตุ**: รายงานนี้รวบรวมเฉพาะจุดที่ตรวจสอบพบจริงในซอร์สโค้ดปัจจุบัน (**ไม่รวม** จุดของ Multi-Seller Checkout Flow ที่แก้ไขไปแล้วใน [MULTI_BOOK_MULTI_SELLER_ORDER_AUDIT.md](file:///D:/Project/GongDong-Hack-DII/Biwdocs/MULTI_BOOK_MULTI_SELLER_ORDER_AUDIT.md))

---

## สรุปภาพรวมตามระดับความรุนแรง

| ระดับ | หัวข้อที่พบ | ตัวอย่างผลกระทบหลัก |
|---|---:|---|
| **CRITICAL** | 14 หัวข้อ | เสกเครดิต/ปลดล็อก KYC ฟรี, ข้ามตรวจสลิป/Webhook, หน้า `addresses` และ `notifications` พังใช้งานจริงไม่ได้, `cancelOrder` คืนเครดิตซ้ำจาก Race Condition, ข้ามรหัส Handover, แก้ข้อมูล `BookCatalog` ของร้านอื่นได้ |
| **HIGH** | 20 หัวข้อ | State Machine หลังรับออเดอร์ (`SCHEDULED`, `PAID`/`SHIPPED`, `no-show`) ไม่ตรงกันระหว่าง FE/BE, หลุด PDPA เบอร์โทรผู้ซื้อและชื่อ LINE จริง, Race condition เครดิตติดลบ/รีวิวซ้ำ/สร้าง user แรกเข้า, ซ่อน/ล็อกประกาศด้วย `title` แทน `id`, ข้อมูล Mock ยังค้างใน Credit/Wishlist/Report |
| **MEDIUM / LOW** | จัดกลุ่มแยกตาม Flow | Query/Param validation (`NaN`, non-UUID) ทำ API 500, Role spoofing ผ่าน `?role=`, Chat masking backend ไม่ครบเท่า frontend, Seller list SET mode & defect photo leak, Credit ledger แสดง label ผิด, Timezone UTC shift, CORS localhost |

---

## 1. Auth, Onboarding, Profile & PDPA Consent

### 1.1 [CRITICAL] LINE Webhook ข้ามการตรวจ Signature เมื่อไม่ได้ตั้งค่า `LINE_CHANNEL_SECRET`
- **ไฟล์**: [env.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/config/env.ts#L23), [webhooks.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/webhooks.ts#L24-L29)
- **ปัญหา**: `LINE_CHANNEL_SECRET` ถูกประกาศเป็น `.optional()` และ `webhooks.ts` จะตรวจ `x-line-signature` เฉพาะเมื่อตัวแปรนี้มีค่าเท่านั้น หาก Deploy โดยไม่ได้ตั้งค่า Secret ผู้ไม่หวังดีสามารถยิงปลอม Webhook Event เข้ามาได้ทันที

### 1.2 [CRITICAL] `/api/auth/line` ยอมรับ `mock_` Token ทุก Environment และคืน Success แม้ Backend Fail
- **ไฟล์**: [route.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/api/auth/line/route.ts#L21-L98)
- **ปัญหา**:
  1. ยอมรับ `idToken.startsWith('mock_')` โดยไม่ตรวจ `NODE_ENV` แล้วคืน session `usr_mock_01` (`credits: 5`)
  2. หากเรียก Express `/api/users/me` ไม่สำเร็จ Route ยังคงคืน HTTP `200 { success: true, user: { ... credits: 1 } }` ที่ไม่มี DB `id`
  3. หากส่ง `idToken` ที่ไม่ใช่ string จะ crash ที่ `idToken.startsWith` (`500`) *(Route นี้ไม่ได้ถูก `useLiff.tsx` เรียกใช้จริงด้วย)*

### 1.3 [HIGH] Auth Bypass เปิดใช้งานตลอดเมื่อ `NODE_ENV !== 'production'` + `getUserIdFromRequest` fallback
- **ไฟล์**: [auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L91-L100), [requestUser.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/utils/requestUser.ts#L7-L12)
- **ปัญหา**: `isTestOrDev` เช็กแค่ `process.env.NODE_ENV !== 'production'` หากลืมตั้งหรือเป็น `staging` ผู้ใช้สามารถปลอมเป็นใครก็ได้ด้วย Header `x-user-id` หรือ `Bearer mock_<id>` (พร้อมสร้างบัญชีใหม่ + 1 เครดิตให้อัตโนมัติ)

### 1.4 [HIGH] Race Condition ตอน Auto-Create User ครั้งแรก (`P2002`)
- **ไฟล์**: [auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L155-L182)
- **ปัญหา**: เมื่อผู้ใช้ล็อกอินครั้งแรก Frontend จะยิงหลาย Request พร้อมกัน (`useLiff`, `useCart`, `useSeller`, `useV4Orders`) ซึ่งทุกตัวเข้า `findUnique` -> `null` -> `$transaction(... tx.user.create)` แข่งกัน ทำให้ Request ที่แพ้เกิด `P2002 Unique Constraint` (`line_user_id`) และคืน HTTP 500

### 1.5 [HIGH] `/setup` ถูกทิ้งร้าง และ `/seller/setup` นำชื่อ-รูป LINE จริงไปทับ PDPA Profile โดยไม่ขอ Consent
- **ไฟล์**: [onboarding/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/onboarding/page.tsx#L15-L22), [setup/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/setup/page.tsx#L15-L66), [seller/setup/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/setup/page.tsx#L205-L213), [useProfile.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useProfile.tsx#L32-L46)
- **ปัญหา**:
  - ไม่มีหน้าไหนลิงก์ไป `/setup` (`AccountSetupPage`) เลย ทำให้ Flow ตั้งชื่อเล่น/Avatar ป้องกัน PDPA ไม่ถูกบังคับ
  - หน้า `/seller/setup` ฟังก์ชัน `finish()` เรียก `profile.saveProfile({ nickname: user.displayName, avatar: user.pictureUrl, consent: true })` ซึ่งนำ **ชื่อจริงและรูป LINE จริง** มาบันทึกเป็นชื่อแสดงผลสาธารณะ และตั้ง `consent: true` โดยไม่ได้ถามผู้ขาย
  - `useProfile` เก็บ Consent แค่ใน `localStorage` (`gongdong.pdpa.consent.${userId}`) ไม่ได้บันทึกลง DB

### 1.6 [HIGH] `useLiff` ค้างสถานะ `MOCK_USER` (`credits: 5, isVerifiedSeller: true`) แม้ในโหมด LIFF จริง
- **ไฟล์**: [useLiff.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useLiff.tsx#L65-L78), [useLiff.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useLiff.tsx#L180-L199)
- **ปัญหา**: State เริ่มต้นกำหนดเป็น `MOCK_USER` หาก `liff.getIDToken()` ได้ `null` หรือ `syncUserWithBackend` พัง ระบบยังให้ `isLoggedIn = true` พร้อมสิทธิ์ปลอม `usr_mock_01`, `credits: 5`, `isVerifiedSeller: true` และหาก `NEXT_PUBLIC_LIFF_ID` ว่างใน Production ระบบจะเข้า Mock Mode อัตโนมัติ

### 1.7 [MEDIUM] Route Ordering Bug: `GET /api/users/me/reviews` ทะลุ `authMiddleware`
- **ไฟล์**: [users.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/users.ts#L28-L48)
- **ปัญหา**: `userRouter.get('/:id/reviews', ...)` ลงทะเบียนไว้ก่อน `userRouter.use('/me', authMiddleware)` ทำให้ `GET /api/users/me/reviews` ถูกจับเป็น `id = 'me'` โดยไม่ผ่าน Auth แล้วไปพัง `500 P2023` ใน Prisma แทน

### 1.8 [MEDIUM] Webhook Event Replay & JSON Parse Crash + `verifyLineToken` Env Mismatch
- **ไฟล์**: [lineNotifyService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/lineNotifyService.ts#L167-L219), [webhooks.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/webhooks.ts#L18-L32), [auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L22-L28)
- **ปัญหา**:
  - Webhook ไม่เช็กซ้ำ `event.webhookEventId` และไม่มี `try/catch` ราย event หาก 1 event error จะคืน `500` ทำให้ LINE ยิง retry ซ้ำ
  - `verifyLineToken` อ่าน `LINE_LIFF_CHANNEL_ID || LINE_CHANNEL_ID` (ไม่มี `LINE_CHANNEL_ID` ใน `env.ts`) และหากขาด `client_id` ก็ยังคงยิง LINE Verify API ทั้งที่ LINE บังคับฟิลด์นี้

### 1.9 [LOW] Bugs ย่อยใน Auth / Profile / CORS
- [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L171-L207): `PATCH /api/users/me` ไม่สามารถส่ง `null` หรือ `""` เพื่อลบ `phone_number` / `promptpay_id` เดิมได้ และไม่มีตรวจความยาว `nickname` (`VarChar(100)`) หรือ URL scheme ของ `avatar_url`
- [useProfile.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useProfile.tsx#L55-L65): ถ้า `!idToken` ฟังก์ชัน `saveProfile` ข้าม API และทำเหมือนสำเร็จใน `localStorage` เงียบๆ
- [useLiff.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useLiff.tsx#L173-L178), [useLiff.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useLiff.tsx#L222-L255): `getFriendship()` error แล้วตั้ง `friendship = true`, `logout()` ไม่รีเซ็ต `user`, `login()` โหมด mock ไม่คืน token
- [index.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/index.ts#L19-L24): Hardcode `http://localhost:3000` และ `https://localhost:3000` ใน CORS allowlist ตลอดเวลา (รวม Production)

---

## 2. Seller KYC, Credits Top-Up & Shop Management

### 2.1 [CRITICAL] `POST /api/users/me/topup-slip` เสกเครดิตฟรีและปลดล็อก `isVerifiedSeller` ได้ไม่จำกัด
- **ไฟล์**: [users.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/users.ts#L127-L143), [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L266-L322), [env.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/config/env.ts#L28-L29)
- **ปัญหา**:
  - Route เรียก `processTopupSlip(userId, req.body)` โดยไม่ส่ง `slipVerifier` เข้าไป (`SLIPOK_API_KEY` / `SLIPOK_BRANCH_ID` ยังไม่ถูกใช้จริงในระบบ)
  - เมื่อไม่มี `slipVerifier` Backend จะเข้าโหมด Mock **ทุก Environment รวม Production** โดยเชื่อ `amount`, `transRef`, `senderName` ที่ Client ส่งมา (เช่นส่ง `{ amount: 100, slip_image_url: "x" }` -> ได้ `+25 เครดิต` + `isVerifiedSeller = true` ทันที)

### 2.2 [CRITICAL] หน้าเติมเครดิต Frontend (`/seller/credits/pay`, `/success`) เป็น Mock 100% ไม่เชื่อม Backend จริง
- **ไฟล์**: [seller/credits/pay/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/credits/pay/page.tsx#L27-L62), [seller/credits/success/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/credits/success/page.tsx#L16-L29), [useSeller.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useSeller.tsx#L393-L417), [QrPayCard.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/QrPayCard.tsx#L26), [qr.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/qr.ts#L1-L19)
- **ปัญหา**: ไม่เรียก `GET /api/users/me/topup-qr` หรือ `POST /api/users/me/topup-slip` เลย; QR ที่แสดงเป็น SVG สุ่ม (`buildQrCells`) ที่สแกนจ่ายไม่ได้จริง และปุ่ม `"จำลองการอนุมัติ"` เพียงเพิ่มเครดิตใน React state ชั่วคราว (รีเฟรชแล้วหาย)

### 2.3 [CRITICAL] KYC ยืนยันตัวตนผู้ขายตรวจแค่สูตร Mod-11 และไม่กันใช้เลขบัตรซ้ำหลายบัญชี
- **ไฟล์**: [seller.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/seller.ts#L99-L114), [shopService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/shopService.ts#L248-L290), [useSeller.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useSeller.tsx#L200-L234)
- **ปัญหา**: แค่กรอกเลขบัตร 13 หลักที่ผ่าน checksum Mod-11 + ชื่อ 2 ตัวอักษร ระบบตั้ง `isVerifiedSeller = true` ทันที ไม่มีตรวจเอกสาร/สลิป และไม่มี unique check สำหรับเลขบัตร ทำให้ 1 เลขบัตรใช้ยืนยันได้ไม่จำกัดบัญชี ส่วนฝั่ง Frontend ถ้า `!idToken || !kyc.nationalId` ฟังก์ชัน `submitKyc` แอบตั้ง `payeeVerified: true` ใน state ให้อีกด้วย

### 2.4 [HIGH] Race Condition หักเครดิตผู้ขายติดลบได้ใน `acceptOrder`
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L743-L764)
- **ปัญหา**: ตรวจ `order.seller.credits < 1` จากค่าที่อ่านมาก่อน แล้วค่อย `tx.user.update({ data: { credits: { decrement: 1 } } })` โดยไม่มี `where: { id: sellerId, credits: { gte: 1 } }` หากผู้ขายมี 1 เครดิตแล้วกดรับ 2 ออเดอร์พร้อมกัน จะผ่านเช็กทั้งคู่และเครดิตติดลบเป็น `-1`

### 2.5 [HIGH] Anti-Replay Race Condition ใน `processTopupSlip` และส่งรูปเดิมซ้ำได้
- **ไฟล์**: [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L285-L311)
- **ปัญหา**: เช็ก `paymentSlip.findUnique({ where: { transRef } })` **นอก** `$transaction` หากยิงซ้ำพร้อมกันจะชน `P2002` เป็น HTTP 500 และหากไม่ส่ง `transRef` ระบบสุ่ม `TOPUP_...` ใหม่ให้เรื่อยๆ ทำให้ส่ง URL รูปสลิปเดิมซ้ำได้ไม่จำกัด

### 2.6 [HIGH] Backend ขาด Validation & Contact-Leak Guard ใน Shop, Meetup Point และ KYC
- **ไฟล์**: [shopService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/shopService.ts#L96-L290)
- **ปัญหา**:
  - `upsertMyShop` และ `addMeetupPoint` ไม่เรียก `maskSensitiveData` หรือกรองเบอร์/LINE ID จาก `shopName`, `description`, `meetupPoint.name` (ตรวจเฉพาะฝั่ง Frontend เท่านั้น)
  - ไม่ตรวจ type/range ของ `lat` (`-90..90`), `lng` (`-180..180`), `shipMode`, `shipWithinDays` (`SmallInt`), URL scheme ของ `avatarUrl` -> ยิงค่าผิดๆ ทำให้ Prisma crash 500
  - `addMeetupPoint` มี Race Condition ตอนสร้าง `ShopProfile` อัตโนมัติเมื่อร้านยังไม่มีโปรไฟล์

### 2.7 [HIGH] หน้า `/seller/setup?step=1` แครช & เขียนทับ `shipMode`/`shipWithinDays` + หน้าร้านสาธารณะ Error เมื่อไม่มีสินค้า
- **ไฟล์**: [seller/setup/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/setup/page.tsx#L68-L146), [seller/setup/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/setup/page.tsx#L305), [seller/[sellerId]/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/[sellerId]/page.tsx#L275-L290)
- **ปัญหา**:
  - `STEP_HEADINGS` มีแค่ Step `2, 3, 4` แต่ query parser ยอมรับ `requested >= 1 && requested <= 4` ทำให้เปิด `/seller/setup?step=1` แล้ว Crash `Cannot read properties of undefined (reading 'title')`
  - หน้า Edit ตั้งค่า `shipMode = 'AFTER_ACCEPT'` และ `shipWithinDays = 2` ทับค่าจริงทุกครั้งที่บันทึก
  - [seller/[sellerId]/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/[sellerId]/page.tsx#L288): ปุ่ม "รายงานร้านนี้" เป็นแค่ Toast หลอก (ไม่มี API) และหากร้านมี 0 เล่ม + `shop.shopName` ว่าง จะ crash ที่ `sellerInfo.sellerName`

### 2.8 [MEDIUM] Credit Ledger แสดงเหตุผลผิด (`ORDER_ACCEPT` / `REFUND_CANCEL` กลายเป็น `"เติมเครดิต"`)
- **ไฟล์**: [mappers.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/mappers.ts#L675-L697), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L771), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L988), [auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L132-L178)
- **ปัญหา**: Backend บันทึก `type` เป็น `'ORDER_ACCEPT'` และ `'REFUND_CANCEL'` แต่ Frontend `mapBackendCreditLedgerRow` รู้จักแค่ `'ACCEPT_ORDER'` และ `'NO_SHOW_REFUND'` จึง fallback ทุกอย่างเป็น `'TOPUP'` ทำให้รายการหักเครดิต `-1` แสดงเป็น `"เติมเครดิต"` และรายการ `SIGNUP_BONUS` จาก middleware ไม่ได้ใส่ `balanceAfter` จึงโชว์ `"คงเหลือ 0"`

### 2.9 [MEDIUM-LOW] อื่นๆ ใน Seller / Credits / PromptPay
- [promptPayService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/promptPayService.ts#L8-L36): โยน `new Error` (500 แทน 400) และไม่เช็ก Mod-11 สำหรับบัตร 13 หลัก ส่วน `getTopupPaymentQr` fallback เป็น `'0800000000'` เมื่อ `NODE_ENV !== 'production'`
- [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L280-L319): `processTopupSlip` โหมด default เอา `displayName` มาเขียนทับ `verifiedName` เดิมของ KYC
- [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L354): `getCreditLedger` พัง `500` เมื่อ `?limit=abc` (`NaN`)
- [seller/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/page.tsx#L144), [seller/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/page.tsx#L253): Hardcode คะแนนร้าน `4.9` และตรวจ Empty state โดยไม่เช็ก `pendingRequestListings.length` ทำให้ขึ้นทั้งรายการคำขอและข้อความ "ยังไม่มีประกาศขาย" พร้อมกัน

---

## 3. Addresses Management (จัดการที่อยู่จัดส่ง)

### 3.1 [CRITICAL] หน้า `/addresses` และ `/addresses/edit` อ่าน-เขียนไม่ตรงกับ Backend ใช้งานไม่ได้จริง
- **ไฟล์**: [addresses/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/addresses/page.tsx#L27-L57), [addresses/edit/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/addresses/edit/page.tsx#L40-L94), [addressService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/addressService.ts#L7-L138), [users.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/users.ts#L213-L267)
- **ปัญหา (พัง 2 ชั้น)**:
  1. **ฝั่งอ่าน (`GET /api/users/me/addresses`)**: Backend คืน Array โดยตรง (ผ่าน `apiRequest` unwrap `data`) แต่ทั้ง 2 หน้าคาดหวัง `{ addresses: BackendAddress[] }` และอ่าน `res.addresses` ซึ่งได้ `undefined` เสมอ -> **รายการที่อยู่ว่างเปล่าตลอด**
  2. **ฝั่งเขียน (`POST` / `PATCH`)**: Frontend ส่ง `snake_case` (`full_name`, `postal_code`, `is_default`) แต่ `addressService.ts` อ่าน `camelCase` (`fullName`, `postalCode`, `isDefault`) -> **เพิ่มที่อยู่ใหม่ Fail 400 ทุกครั้ง**, **แก้ที่อยู่/ตั้งค่าเริ่มต้น เงียบไม่เกิดผล**

### 3.2 [HIGH] Open Redirect ผ่าน `?next=` ในหน้าแก้ไขที่อยู่
- **ไฟล์**: [addresses/edit/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/addresses/edit/page.tsx#L34-L35), [addresses/edit/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/addresses/edit/page.tsx#L97)
- **ปัญหา**: รับค่า `next` จาก URL query parameter แล้ว `router.push(nextPath)` ทันทีโดยไม่ตรวจว่าขึ้นต้นด้วย `/` (และไม่ใช่ `//`)

### 3.3 [MEDIUM-LOW] Validation & UX Gaps ในที่อยู่
- [addressService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/addressService.ts#L31-L138): ไม่มีตรวจโควต้า 5 ที่อยู่, ไม่ตรวจรหัสไปรษณีย์ 5 หลัก (`VarChar(10)` -> crash 500 ถ้าพิมพ์ยาว), `updateUserAddress` ยอมบันทึก string ว่างเมื่อส่ง whitespace
- [addresses/edit/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/addresses/edit/page.tsx#L59-L64): ตัวเลือกพื้นที่ใน UI มี Hardcode แค่ 4 ตำบล/แขวง (เชียงใหม่ 2, กทม 1, นนทบุรี 1) ไม่มีช่องพิมพ์จังหวัด/อำเภอ/ตำบลเอง ทำให้คนจังหวัดอื่นเพิ่มที่อยู่ใน UI ไม่ได้

---

## 4. Book Discovery, Search, Wishlist & Notifications

### 4.1 [CRITICAL] หน้าแจ้งเตือน (`/notifications`) แสดงว่างเปล่าตลอด เพราะอ่านผิด Key
- **ไฟล์**: [notifications/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/notifications/page.tsx#L25-L28), [notificationService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/notificationService.ts#L54-L78)
- **ปัญหา**: Backend คืน `{ items, unreadCount }` แต่ Frontend อ่าน `res.notifications` ทำให้ได้ `undefined` และแสดง Empty State ตลอดเวลา
- *(ปัญหาต่อเนื่อง [MEDIUM])*: `markAllAsRead` (`notifications/page.tsx:43`) ยิง `PATCH /api/notifications/read-all` โดยไม่ส่ง `?role=${view}` ทำให้กดอ่านฝั่ง Buyer แล้วฝั่ง Seller โดน Mark Read ไปด้วย

### 4.2 [CRITICAL] หน้า Search (`/search`) ส่ง Enum เกรดผิด ทำให้กรองเกรด B, C, D ไม่เจอหนังสือเลย
- **ไฟล์**: [search/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/search/page.tsx#L41-L44), [gradingService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/gradingService.ts#L3-L8), [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L116-L118)
- **ปัญหา**: Frontend map `{ A: 'LIKE_NEW', B: 'GOOD', C: 'READABLE', D: 'ACCEPTABLE' }` แต่ Backend ใช้ `'LIKE_NEW' | 'GENTLY_READ' | 'WELL_LOVED' | 'WORN_BUT_READABLE'`

### 4.3 [HIGH] `GET /api/books/:id` เปิดเผยประกาศที่ถูกซ่อน (`HIDDEN`) และพิกัดนัดรับ
- **ไฟล์**: [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L186-L254)
- **ปัญหา**: ดึง `findUnique({ where: { id } })` โดยไม่เช็กว่า `status === 'HIDDEN'` หรือเป็นเจ้าของหรือไม่ ทำให้คนทั่วไปดูประกาศที่ซ่อนอยู่ได้ด้วย ID

### 4.4 [HIGH] `/wishlist` ไม่มี Backend API, Hardcode `matchCount: 0` และลิงก์ไป `/search?q=...` ที่ไม่ทำงาน
- **ไฟล์**: [wishlist/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/wishlist/page.tsx#L19-L74), [wishlist/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/wishlist/page.tsx#L143), [search/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/search/page.tsx#L17)
- **ปัญหา**: เก็บข้อมูลแค่ใน `localStorage`, ไม่มี API/ตาราง DB สำหรับแจ้งเตือนเมื่อมีหนังสือตรงความต้องการ, ฮาร์ดโค้ด `href="/search?q=เจ้าชายน้อย"` ทั้งที่หน้า `/search` ไม่อ่าน `?q=` จาก URL, และฮาร์ดโค้ด `<BottomTab orderBadge={1} />`

### 4.5 [MEDIUM] บั๊กหน้าแรก (`page.tsx`), Search Client-Only Filter และ `NaN` 500
- [page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/page.tsx#L52-L68): ตัวกรองหมวด `'self-help'` เช็กคำว่า `'พัฒนา'` ซึ่งไม่มีใน `BOOK_CATEGORIES` (มีแค่ นิยาย/วิชาการ/การ์ตูน/หนังสือเรียน/วารสาร/อื่น ๆ), SearchBar ส่ง prop `disabled` ทำให้กด Enter ไม่ได้และสีจาง, และจุดแดงกระดิ่ง (`line 102`) ถูกฮาร์ดโค้ดให้แสดงตลอด
- [search/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/search/page.tsx#L39-L101): ตัวกรองราคา, ประเภท (`SINGLE`/`SET`) และโซน (ฮาร์ดโค้ดแค่ 3 จุดใน มช.) กรองเฉพาะใน Client บนผลลัพธ์ 50 เล่มล่าสุดเท่านั้น
- [books.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/books.ts#L96), [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L164): `?limit=abc` ได้ `NaN` -> Prisma crash 500
- [googleBooksService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/googleBooksService.ts#L37-L43): `sanitizeIsbn` โยน `Error` ธรรมดาแทน `AppError(..., 400)` ทำให้ ISBN ผิดรูปแบบคืน `500`

---

## 5. Seller Listing Create/Edit & Image Upload

### 5.1 [CRITICAL] ผู้ขายคนใดก็ได้สามารถเขียนทับข้อมูล Master ของ `BookCatalog` ร่วมของ ISBN ทั้งระบบ
- **ไฟล์**: [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L311-L330)
- **ปัญหา**: `createBookListing` ใช้ `tx.bookCatalog.upsert({ where: { isbn }, update: { title, author, publisher, coverUrl, originalPrice } })` เมื่อผู้ขายลงขาย ISBN ที่มีอยู่แล้ว ข้อมูลที่กรอกใหม่จะไปทับข้อมูลกลางใน `BookCatalog` ของร้านอื่นทั้งหมด

### 5.2 [CRITICAL] ข้ามการตรวจ KYC ผู้ขายเมื่อลงขาย/แก้ไขแบบส่งพัสดุ (`allowDelivery: true`)
- **ไฟล์**: [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L354), [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L427), [edit/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/listings/[id]/edit/page.tsx#L174-L195)
- **ปัญหา**: Backend ไม่ตรวจ `isVerifiedSeller` และ `shopProfile.supportsParcel` ก่อนอนุญาต `allowDelivery: true` (และหน้าแก้ไขประกาศใน FE ก็ไม่ซ่อน/บล็อกตัวเลือกส่งพัสดุสำหรับร้านที่ยังไม่ยืนยันด้วย) ทำให้ผู้ซื้อกดขอซื้อแบบพัสดุได้ แต่ผู้ขายจะกดรับออเดอร์ไม่ผ่าน (`SELLER_NOT_VERIFIED`)

### 5.3 [CRITICAL] สูตรคำนวณเกรดและราคาแนะนำ Frontend vs Backend ไม่ตรงกัน
- **ไฟล์**: [ConditionChecklist.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/ui/ConditionChecklist.tsx#L49-L65), [gradingService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/gradingService.ts#L35-L57)
- **ปัญหา**: Frontend นับแค่จำนวนข้อ (`1 ข้อ -> เกรด B / 60%`) แต่ Backend ถ่วงน้ำหนัก (`หน้ากระดาษหลุด/ขาด -> D ทันที`, `คราบน้ำ หรือ รอยขีดเขียน อย่างเดียว -> C`) ทำให้หน้าตั้งราคาแนะนำแสดงเกรด B (60%) แต่พอ Submit ขึ้น Backend ถูกบันทึกเป็นเกรด C หรือ D

### 5.4 [HIGH] Validation Gaps ใน `bookService.ts` (`price: 0`, `NaN`, `conditionAnswers` null, URL รูป)
- **ไฟล์**: [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L269-L297), [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L413-L428)
- **ปัญหา**:
  - เช็ก `typeof input.price !== 'number' || input.price < 0` ซึ่งปล่อยผ่าน `price: 0`, `NaN`, `Infinity`
  - Destructure `conditionAnswers` โดยไม่เช็กว่าส่งมาครบหรือไม่ -> 500 `TypeError`
  - ไม่เช็ก `title` ว่าง, ไม่ตรวจ URL รูปใน `images`, และ `updateBookListing` ยอมให้ตั้ง `allowPickup: false` คู่กับ `allowDelivery: false` จนสั่งซื้อไม่ได้

### 5.5 [HIGH] หน้าแก้ไขประกาศ (`/seller/listings/[id]/edit`) พังเมื่อ Refresh และขาดฟิลด์สำคัญจาก Backend
- **ไฟล์**: [edit/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/listings/[id]/edit/page.tsx#L38-L52), [edit/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/listings/[id]/edit/page.tsx#L208-L224), [bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts#L477-L491), [mappers.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/mappers.ts#L415)
- **ปัญหา**:
  - State `price`, `meetup`, `parcel` init ครั้งเดียวตอน mount (ไม่มี `useEffect` sync หลัง `useSeller` โหลดเสร็จ)
  - `getUserBookListings` (`GET /api/users/me/books`) ไม่คืน `allowPickup`, `allowDelivery`, `totalVolumes`, `description`, `codEnabled` ทำให้หน้า Seller แสดง `"ยกชุด undefined เล่ม"` และดึง `deliveryMethods` จากร้านแทนจากตัวหนังสือ
  - ปุ่ม "แสดงประกาศอีกครั้ง" ไม่ใส่ `disabled={locked}` และข้อความแจ้งผู้ขายว่า "เปลี่ยนราคาแล้วผู้ซื้อที่ขออยู่จะเห็นราคาใหม่" **ไม่จริง** เพราะ `OrderItem` snapshot ราคาไว้ตอนสร้างออเดอร์

### 5.6 [HIGH] จับคู่ออเดอร์ที่ค้าง/ใช้งานอยู่ด้วย `book.title` แทน `book.id`
- **ไฟล์**: [edit/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/listings/[id]/edit/page.tsx#L34), [seller/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/page.tsx#L62-L75)
- **ปัญหา**: หากผู้ขายมีหนังสือชื่อเดียวกัน 2 เล่ม ระบบจะล็อกและซ่อนอีกเล่มที่ไม่ได้ติดออเดอร์ไปด้วย

### 5.7 [HIGH] Upload Endpoint เชื่อ MIME Header จาก Client + 500 เมื่อไฟล์ใหญ่ + Signed URL หมดอายุใน 7 วัน
- **ไฟล์**: [upload.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/upload.ts#L9-L50), [uploadService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/uploadService.ts#L61-L158), [errorHandler.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/errorHandler.ts#L11)
- **ปัญหา**:
  - ตรวจแค่ `file.mimetype` ไม่ตรวจ magic bytes (สามารถอัปโหลด HTML/SVG/JS โดยปลอม header เป็น `image/png`)
  - `MulterError` (`LIMIT_FILE_SIZE`) ไม่มี `statusCode` จึงคืน `500` แทน `400/413`
  - รูปใน bucket `slips` / `disputes` เก็บเป็น Signed URL อายุ 7 วันลง DB โดยไม่มี Endpoint สำหรับ re-sign เมื่อหมดอายุ

### 5.8 [MEDIUM] บั๊กใน Wizard ลงขาย (`/seller/list/*`) & Mock/Figma Strings ค้างอยู่
- [useListing.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useListing.tsx#L103-L107): `removeDefect` ลบรายการออกแต่ไม่ลบ URL รูปใน `photos.defects`
- [seller/list/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/list/page.tsx#L39-L93), [seller/list/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/list/page.tsx#L368-L403): โหมด `SET` เก็บเล่มใน state ท้องถิ่น (หายเมื่อเปลี่ยนหน้า), ปลอม ISBN, key ซ้ำตอนลบแล้วเพิ่มใหม่, แปลงค่าแถบพิมพ์มือจนตัด `'X'` ใน ISBN-10, และลิงก์สำเร็จใน `success/page.tsx` ยัง hardcode `https://liff.line.me/mock-liff-id/book/listing-01`
- [seller/list/details/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/list/details/page.tsx#L17-L18): ล็อกช่องกรอก `originalPrice` เมื่อ ISBN lookup ได้ชื่อผู้แต่งแม้ `originalPrice === 0`
- [useSeller.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useSeller.tsx#L316-L333): `publishListing` อ่าน `listings` จาก stale closure จึงคืน object ปลอมเกรด `'B'`
- [PriceSuggest.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/ui/PriceSuggest.tsx#L32): ปัดเศษราคาหลัก 5 บาท ต่างจาก Backend ที่ปัดทศนิยม 2 ตำแหน่ง
- ป้าย Screen ID จาก Figma (`(B4)`, `(B4OK)`, `(S2M)`, `(TMISSING)`, `(TPRICE)`, `(TSHARE)`, `(S6RS)`) และข้อมูล mock (`วันนี้ลงขายแล้ว 2 / 10 รายการ`, `RP-2569-0148`) ยังแสดงอยู่บนหน้าเว็บจริง

---

## 6. Post-Order State Machine, Chat, Handover, No-Show, Dispute & Review

### 6.1 [CRITICAL] Double-Credit Refund Race & Non-Atomic State Transitions (TOCTOU)
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L946-L1010), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1110-L1526)
- **ปัญหา**:
  1. `cancelOrder` เช็ก `status` (`ACCEPTED`/`SCHEDULED`) แล้ว update โดยไม่มีเงื่อนไข `status` หรือ row lock (`FOR UPDATE`) หากผู้ซื้อยิง `POST /api/orders/:id/cancel` 2 ครั้งพร้อมกัน ระบบจะคืน `+1 เครดิต` ให้ผู้ขาย **ซ้ำ 2 รอบ**
  2. `verifyOrderPaymentSlip`, `shipOrder`, `completeDeliveryOrder`, และ `receiveOrder` เรียก `loadAndAuthorizeOrder(db, ...)` **นอก** `$transaction` แล้วจึงไปอัปเดตสถานะใน `$transaction` ทำให้จังหวะซ้อนกับ `cancelOrder` หรือ `openDispute` สามารถเขียนทับออเดอร์ที่ถูกยกเลิก/ร้องเรียนไปแล้วกลับมาเป็น `COMPLETED` + `SOLD` ได้

### 6.2 [CRITICAL] ข้ามการตรวจสลิปออเดอร์ใน `verifyOrderPaymentSlip` & ไม่ตรวจ `paymentMethod === 'TRANSFER'`
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1098-L1188), [orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts#L467-L495)
- **ปัญหา**: เชื่อ `amount`, `transRef`, `receiverName` จาก `req.body` โดยไม่เรียก SlipOK; ถ้าไม่ส่ง `amount` จะตีว่าตรง `totalPrice` อัตโนมัติ, ถ้าไม่ส่ง `receiverName` จะข้ามการเช็กชื่อผู้รับ, และไม่ตรวจว่า `order.paymentMethod === 'TRANSFER'` (สามารถส่งสลิปเปลี่ยนออเดอร์ `COD` เป็น `PAID` ได้)

### 6.3 [CRITICAL] ข้ามการตรวจรหัสส่งมอบ 6 หลัก (Handover Code Bypass) & `HandoverCode.tsx` ไม่ได้ใช้งาน
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1313-L1438), [useV4Orders.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useV4Orders.tsx#L431-L464), [orders/[id]/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/page.tsx#L140-L143), [HandoverCode.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/HandoverCode.tsx)
- **ปัญหา**: ปุ่ม `"ยืนยันส่งมอบแล้ว"` ใน `/orders/[id]` เรียก `POST /api/orders/:id/complete-meetup` ซึ่งปิดงานได้เลยทั้ง `ACCEPTED` และ `SCHEDULED` โดยไม่ต้องกรอกรหัส 6 หลัก (`POST /api/orders/:id/handover` และ `<HandoverCode />` ไม่ได้ถูกเรียกใช้ในหน้าใดเลย)

### 6.4 [HIGH] State Machine นัดรับ (`ACCEPTED` vs `SCHEDULED`) ขัดแย้งกันจนกดยืนยันต่อไม่ได้
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1585-L1644), [orders/[id]/schedule/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/schedule/page.tsx#L65-L68), [orders/[id]/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/page.tsx#L284-L294)
- **ปัญหา**: ทันทีที่ผู้ขายเสนอนัดใหม่ Backend เปลี่ยนออเดอร์เป็น `SCHEDULED` (`scheduleConfirmedByBuyer = false`) แต่ฝั่ง Frontend หน้า `/schedule` และ `/orders/[id]` แสดงปุ่มยืนยัน/แก้ไขเฉพาะเมื่อ `status === 'ACCEPTED'` ทำให้ผู้ซื้อกดยืนยันและผู้ขายปรับนัดต่อไม่ได้

### 6.5 [HIGH] State Machine พัสดุ `PAID` / `SHIPPED` ตีความสลับกันระหว่าง Frontend และ Backend
- **ไฟล์**: [orderStateMachine.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/orderStateMachine.ts#L47-L113), [orders/[id]/tracking/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/tracking/page.tsx#L54), [orders/[id]/receive/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/receive/page.tsx#L48)
- **ปัญหา**: Backend ใช้ `PAID` = จ่ายเงินแล้วรอผู้ขายส่งของ (`PAID -> SHIPPED -> COMPLETED`) แต่ `orderStateMachine.ts` และ `tracking/page.tsx` ตีความว่า `PAID` = ส่งของแล้ว! ส่งผลให้สำหรับออเดอร์โอนเงิน (`PAID`) ผู้ขายจะถูกซ่อนฟอร์มกรอกเลขพัสดุ และผู้ซื้อจะเห็นปุ่ม "ได้รับของแล้ว" ที่พอกดแล้วพัง 400 (`INVALID_ORDER_STATUS`)

### 6.6 [HIGH] Flow แจ้งเบี้ยวนัด (No-Show) & ชี้แจงฝั่งผู้ซื้อ พังทั้งฝั่งส่งและฝั่งตอบโต้
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1443-L1580), [orders/[id]/no-show/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/no-show/page.tsx#L56-L225), [seller/report/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/report/page.tsx#L53-L57)
- **ปัญหา**:
  - `reportMissedMeeting` แค่บันทึก timestamp โดยไม่เปลี่ยนเป็น `DISPUTED` และ `getOrderDetail` ไม่ได้ส่งค่า `missedMeetingReportedAt` กลับมา หน้า `/no-show` ของผู้ซื้อเช็ก `order.status === 'DISPUTED'` จึงไม่ขึ้นฟอร์มชี้แจงให้เลย
  - ใน `disputeMissedMeeting` ไปเรียก `openDispute` ที่ไม่รองรับสถานะ `DISPUTED` (ถ้าเปลี่ยนเป็น `DISPUTED` ก็จะ error 400 อยู่ดี)
  - หน้า `/seller/report` เรียก `reportMissedMeeting(orderId)` โดยทิ้งคำอธิบายและรูปหลักฐานทั้งหมด และให้เลือกออเดอร์ `REQUESTED` หรือจบแล้วมาแจ้งได้

### 6.7 [HIGH] `GET /api/orders/:id` ไม่คืนข้อมูล Review + รีวิวซ้ำได้ + ไม่ Mask ข้อมูลติดต่อในรีวิว
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L538-L649), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1333-L1354), [reviewService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/reviewService.ts#L51-L103), [schema.prisma](file:///D:/Project/GongDong-Hack-DII/backend/prisma/schema.prisma#L350-L368)
- **ปัญหา**:
  - รีวิวเสร็จแล้วเมื่อโหลดออเดอร์ใหม่ `order.review` จะหายไปตลอด ทำให้ผู้ซื้อเห็นปุ่ม "ให้คะแนนและรีวิว" ซ้ำ (กดแล้ว error `400 ALREADY_REVIEWED`) และผู้ขายเห็น "ผู้ซื้อยังไม่ได้รีวิว" ตลอด
  - ตาราง `Review` ไม่มี `@@unique([orderId, reviewerId])` จึงยิงสร้างรีวิวซ้ำได้ด้วย concurrent requests และไม่มีการเรียก `maskSensitiveData` บน `comment`

### 6.8 [HIGH] PDPA Leak ใน `GET /api/orders/:id`
- **ไฟล์**: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L570-L591), [orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts#L259-L278)
- **ปัญหา**: คืนเบอร์โทรผู้ซื้อ (`buyer.phone_number` และ `delivery_details.recipient_phone`) แบบ plaintext ให้ผู้ขายในสถานะ `PAID` / `SHIPPED` / `ACCEPTED`+`COD` รวมถึงเปิดเผยชื่อ-รูปผู้ซื้อตั้งแต่สถานะ `REQUESTED` (ขัดกับคำสัญญา "ระบบซ่อนตัวตนผู้ซื้อ" และ "ไม่มีเบอร์โทรให้อีกฝ่ายเห็น" ใน UI)

### 6.9 [MEDIUM-LOW] บั๊กอื่นๆ ใน Post-Order / Chat / UI
- **Role Spoofing จาก URL Query**: [schedule/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/schedule/page.tsx#L41-L44), [tracking/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/tracking/page.tsx#L37-L40), [no-show/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/no-show/page.tsx#L40-L43), [review/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/review/page.tsx#L19-L82) อ่านบทบาทจาก `?role=` และ fallback เป็น `'SELLER'` แทนการดูจาก `isMineAsBuyer(order)`
- **Chat Masking & Display**: [dataMaskingService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/dataMaskingService.ts#L3-L50) ไม่บล็อก Email, IG/FB/TikTok และคำชวนโอนตรงเหมือน [masking.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/masking.ts#L16-L25); [ChatRoom.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/ChatRoom.tsx#L53) ซ่อนประวัติแชทออเดอร์ `CANCELLED`; [mappers.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/mappers.ts#L640) แปลง `SCHEDULE_CARD` เป็น `SYSTEM`
- **Missing UUID Check**: [orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts#L216-L778) ไม่ validate `:id` เป็น UUID ก่อนส่งให้ Prisma -> `500 P2023`
- **UI State & Double Submit**: หน้า [tracking/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/tracking/page.tsx#L125-L147) มีปุ่ม Submit ซ้ำ 2 ปุ่ม และปุ่มส่งใน `receive`, `review`, `schedule`, `tracking`, `no-show` ไม่ได้ส่ง `disabled={submitting}` ทำให้กดเบิ้ลได้; [no-show/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/no-show/page.tsx#L162-L168) มีปุ่มข้ามเวลาเดโม (`devBypass`) เปิดค้างอยู่ใน Production
- **DateTimePicker Timezone Bug**: [DateTimePicker.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/DateTimePicker.tsx#L41) ใช้ `toISOString().slice(0, 10)` ทำให้วันที่เพี้ยนย้อนหลัง 1 วันช่วง `00:00–06:59` น. ตามเวลาไทย
- **Hook Bugs**: [useV4Orders.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useV4Orders.tsx#L177-L227) `refreshOrders` ยิง N+1 requests, `isMineAsBuyer` คืน `false` ช่วงโหลด LIFF (ทำให้เห็นออเดอร์ซื้อเป็นฝั่งขายชั่วคราว)

---

## แผนลำดับการแก้ไขที่แนะนำ (Priority Roadmap)

1. **Sprint A — Critical Security & Broken Core Features (แก้ด่วนก่อนเปิดใช้งานจริง)**
   - บังคับตรวจ `LINE_CHANNEL_SECRET`, ลบ mock auth fallback ที่ไม่เช็ก dev mode, ล็อก SlipOK verification ใน `processTopupSlip` / `verifyOrderPaymentSlip`, ล็อก KYC + ห้าม `allowDelivery` ถ้าร้านยังไม่ผ่าน KYC
   - แก้หน้า `/addresses` (shape response + `camelCase` + safe `next` redirect) และ `/notifications` (`items` + `?role=`) และ `/search` (grade enum map)
   - ป้องกัน `createBookListing` เขียนทับ `BookCatalog` ของผู้อื่น และแก้ `GET /api/books/:id` ไม่ให้เปิดประกาศ `HIDDEN`

2. **Sprint B — Concurrency, PDPA & Post-Order State Machine**
   - ทำ Atomic conditional updates + `credits: { gte: 1 }` / `status` guard ใน `acceptOrder`, `cancelOrder`, `verifyOrderPaymentSlip`, `shipOrder`, `completeDeliveryOrder`, `receiveOrder` และ unique constraint บน `Review`
   - ปรับ State Machine ให้ตรงกันระหว่าง FE/BE: `ACCEPTED <-> SCHEDULED` การนัดรับ, `PAID -> SHIPPED -> COMPLETED` สำหรับพัสดุ, บังคับ `handoverCode` ในนัดรับ, ซ่อม No-Show + `GET /api/orders/:id` คืน `review` & `missedMeetingReportedAt`
   - ลบการส่งเบอร์โทร plaintext ออกให้ตรงตามกติกา PDPA v4 และเพิ่ม Backend `maskSensitiveData` ให้ครบทั้งโปรไฟล์ ร้านค้า แชท และรีวิว

3. **Sprint C — Listing UX, Seller Setup & Cleanup**
   - รวมสูตรเกรดให้ตรงกันระหว่าง `ConditionChecklist.tsx` และ `gradingService.ts`
   - ใช้ `book.id` แทน `book.title` ในการล็อก/ซ่อนประกาศ, ซ่อม `/seller/setup?step=1` และ `/seller/listings/[id]/edit`, ลบ Figma ID / Mock data / Credit mock flow และเพิ่ม validation (`UUID`, `NaN`, magic bytes upload, `DateTimePicker` timezone)
