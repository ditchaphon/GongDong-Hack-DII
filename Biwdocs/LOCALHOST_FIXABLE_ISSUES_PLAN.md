# แผนแก้ไขปัญหาและช่องโหว่ที่ทำได้ทันทีบนเครื่อง Localhost (ก่อนเชื่อม LINE Dev)

> **อ้างอิงข้อมูลจาก**: [FULL_SYSTEM_FLOW_AUDIT.md](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md)  
> **เงื่อนไขขอบเขตที่ตกลงร่วมกัน**:
> 1. รวมปัญหาที่แก้ไขได้บนเครื่องทั้งหมด โดยแยกชัดเจนระหว่าง **Code-Only (ไม่ต้อง Migrate DB)** กับ **จุดที่แตะ Prisma Schema**
> 2. **บังคับใช้ Handover Code 6 หลัก** ปิดงานนัดรับ (แสดงรหัสฝั่งผู้ซื้อ + ผู้ขายกรอกรหัสจริง) และ **ต่อหน้าเติมเครดิตเข้า Backend Dev Mode** เพื่อบันทึกลง Postgres จริงบนเครื่อง
> 3. **บังคับ PDPA แบบไม่สร้างภาระซ้ำซ้อน (แนวทาง A)** (ฝั่งผู้ซื้อใช้ข้อมูล LINE ได้เลยไม่ต้องเด้ง `/setup`; ฝั่งผู้ขายใน `/seller/setup` ใช้ **ชื่อร้าน + รูปโปรไฟล์ร้าน** แทนชื่อ/รูป LINE จริง และกดยินยอม PDPA รวมในขั้นตอนเปิดร้านทีเดียวจบ; ห้ามนำชื่อ/รูป LINE จริงมาบันทึกทับโปรไฟล์ร้าน/ผู้ขายสาธารณะ) และ **ซ่อน/แจ้งเตือนชัดเจน** สำหรับปุ่มที่ยังไม่มี Backend จริง (รายงานร้าน, Wishlist LINE Alert) แทน Toast หลอก

---

## สรุปภาพรวม: อะไรแก้ได้ทันที vs อะไรชะลอไว้ช่วง LINE Dev / Prod

| หมวด | สถานะบนเครื่อง Localhost | แนวทางจัดการ |
|---|---|---|
| **หน้าพัง ใช้งานไม่ได้** (`addresses`, `notifications`, `search`, `seller/setup`, `edit`, `orders/*`) | แก้ได้ **100%** ทันที | แก้ API Contract, State Machine, Routes, และ UI Logic |
| **Concurrency, PDPA, Validation & API 500** | แก้ได้ **100%** ทันที | ใส่ Atomic update, `maskSensitiveData`, UUID/NaN guard, ถอดเบอร์โทรออกจาก API |
| **Handover Code & Credit Top-Up DB Persistence** | แก้ได้ **100%** ทันที | ต่อ `<HandoverCode />` เข้า `/handover` และต่อ `/seller/credits/pay` เข้า Backend Dev Mode |
| **Unique DB Constraints** (`Review` ซ้ำ, `KYC ID` ซ้ำ) | แก้ได้บน Postgres เครื่อง | แยกอยู่ในหมวด **Prisma Schema** (รัน `prisma db push` หรือ `migrate dev`) |
| **Mock LIFF / Token Dev (`x-user-id`, `Bearer mock_...`)** | **คงไว้ใช้เทส 2 ฝั่งบนเครื่อง** | แก้บั๊ก `logout()`/`login()` ใน `useLiff` และใส่ Gate ปิดอัตโนมัติเมื่อ `NODE_ENV === 'production'` |
| **SlipOK จริง, LINE Push/Webhook จริง, Supabase จริง** | **ชะลอได้** (รอต่อ LINE Dev / Prod) | เก็บ Backend Dev Mode ไว้เทสบนเครื่อง แต่ใส่ Security Guard (`LINE_CHANNEL_SECRET`, Webhook dedup) รอไว้ในโค้ด |

---

## กลุ่มที่ 1: รายการแก้ไขระดับ Code-Only (ไม่ต้อง Migrate Database — แก้ได้ทันที)

### หมวด A: หน้าที่พังใช้งานจริงไม่ได้ (Broken Screens & API Contracts) — ✅ แก้ไขครบแล้ว

| # | อ้างอิง Audit | ไฟล์หลักที่ต้องแก้ | ปัญหาปัจจุบัน (Before) | ผลลัพธ์หลังแก้ไข (After) |
|---|---|---|---|---|
| ✅ **A1** | [3.1, 3.2, 3.3](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#3-addresses-management-จัดการที่อยู่จัดส่ง) | `frontend/src/app/addresses/page.tsx`<br>`frontend/src/app/addresses/edit/page.tsx`<br>`backend/src/services/addressService.ts` | อ่าน `res.addresses` (ได้ `undefined` ตลอด), ส่ง `snake_case` แต่ BE รับ `camelCase` (เพิ่ม/แก้พัง 400), UI มีแค่ 4 ตำบล, มีช่องโหว่ Open Redirect ผ่าน `?next=` | อ่าน Array ได้จริง, เพิ่ม/แก้ไข/ตั้งค่าเริ่มต้นที่อยู่ลง DB สำเร็จ (รองรับทั้ง camelCase/snake_case), Dropdown 77 จังหวัด + พิมพ์อำเภอ/ตำบลทั่วไทย + ปุ่มทางลัด, ตรวจรหัสไปรษณีย์ 5 หลัก + โควต้า 5 ที่อยู่, และบังคับ `?next=` เป็น Relative Path เท่านั้น |
| ✅ **A2** | [4.1, 4.5](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#4-book-discovery-search-wishlist--notifications) | `frontend/src/app/notifications/page.tsx`<br>`frontend/src/app/page.tsx`<br>`backend/src/routes/notifications.ts` | อ่าน `res.notifications` ขณะที่ BE คืน `{ items, unreadCount }` (หน้าแจ้งเตือนว่างเปล่าตลอด), กดอ่านทั้งหมดไม่ส่ง `?role=`, จุดแดงกระดิ่งหน้าแรก Hardcode ขึ้นตลอด | แสดงรายการแจ้งเตือนจริงแยกฝั่ง Buyer/Seller, กด "อ่านทั้งหมด" ล้างเฉพาะ Tab ที่เปิดอยู่ (`?role=`), Badge กระดิ่งหน้าแรกแสดงตาม `unreadCount` จริง |
| ✅ **A3** | [4.2, 4.5](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#4-book-discovery-search-wishlist--notifications) | `frontend/src/app/search/page.tsx`<br>`frontend/src/app/page.tsx`<br>`frontend/src/components/ui/SearchBar.tsx` | ค้นหาเกรด B/C/D ส่ง Enum ผิด (`GOOD`/`READABLE`/`ACCEPTABLE`) จนไม่เจอหนังสือ, หน้าแรก Filter `'self-help'` ไม่ตรงหมวดหมู่จริง, SearchBar ใส่ `disabled` | กรองเกรด A/B/C/D ผ่าน `toV4Grade` คืนหนังสือครบตรงฐานข้อมูล, อ่าน `?q=`/`?grade=`/`?shipping=` จาก URL ได้, SearchBar หน้าแรกพิมพ์/กด Enter ไป `/search?q=...` ได้ทันที, หมวดหมู่หน้าแรกใช้หมวดฮิตตรงฐานข้อมูล (`นิยาย`, `วิชาการ`, `การ์ตูน`, `หนังสือเรียน`) |
| ✅ **A4** | [2.8](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#2-seller-kyc-credits-top-up--shop-management) | `frontend/src/lib/mappers.ts`<br>`frontend/src/lib/creditLedger.ts`<br>`frontend/src/types/v4.ts`<br>`backend/src/middlewares/auth.ts` | ประวัติเครดิต (`ORDER_ACCEPT`, `REFUND_CANCEL`) แสดงเป็น `"เติมเครดิต"` หมด และโบนัสแรกเข้า `SIGNUP_BONUS` แสดงคงเหลือ `0` | ประวัติเครดิตแสดงหัวข้อถูกต้อง (`รับออเดอร์ -1`, `คืนเครดิต (ยกเลิกคำสั่งซื้อ) +1`, `เครดิตฟรีสำหรับผู้ใช้ใหม่ +1`, `เติมเครดิต`) พร้อมยอด `balanceAfter` ที่ตรงความเป็นจริง |

---

### หมวด B: Auth, First-Login Race Condition, PDPA & Profile — ✅ แก้ไขครบแล้ว

| # | อ้างอิง Audit | ไฟล์หลักที่ต้องแก้ | ปัญหาปัจจุบัน (Before) | ผลลัพธ์หลังแก้ไข (After) |
|---|---|---|---|---|
| ✅ **B1** | [1.4](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#1-auth-onboarding-profile--pdpa-consent) | `backend/src/middlewares/auth.ts` | ล็อกอินครั้งแรกพร้อมกันหลาย API ชน `P2002` (500 Error) เพราะ `findUnique` + `create` ไม่ atomic | ใช้ helper `findOrCreateFirstLoginUser` catch `P2002` แล้ว `findUnique` ซ้ำ — ยิง API พร้อมกันกี่เส้นตอนเข้าเว็บครั้งแรกก็ไม่ Error 500 |
| ✅ **B2** | [1.5](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#1-auth-onboarding-profile--pdpa-consent) | `frontend/src/app/seller/setup/page.tsx`<br>`frontend/src/hooks/useProfile.tsx` | `/seller/setup` เอา `user.displayName` + `pictureUrl` ของ LINE จริงไปเรียก `profile.saveProfile(...)` ทับ `nickname`/`avatar` และตั้ง `consent: true` โดยไม่ถาม | **แนวทาง A**: ฝั่งผู้ขายใน `/seller/setup` **เลิกเรียก** `profile.saveProfile({ nickname: user.displayName, ... })` ทับโปรไฟล์สาธารณะ ใช้ **ชื่อร้าน (`shopName`) + รูป Avatar ของร้าน** และยืนยัน PDPA/KYC ในขั้นตอนเปิดร้านทีเดียวจบ; ส่วนฝั่งผู้ซื้อใช้โปรไฟล์ LINE ได้เลยโดยไม่เด้งไป `/setup` หรือ popup กวนใจ |
| ✅ **B3** | [1.6, 1.9](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#1-auth-onboarding-profile--pdpa-consent) | `frontend/src/hooks/useLiff.tsx`<br>`frontend/src/hooks/useProfile.tsx`<br>`frontend/src/app/profile/page.tsx`<br>`frontend/src/app/api/auth/line/route.ts` | State เริ่มต้นใช้ `MOCK_USER` (`credits: 5`) ค้างเมื่อ Token/Backend fail, `logout()` ไม่เคลียร์ `user`, `login()` mock ไม่คืน token, หน้า `/profile` มีปุ่ม Logout ทั้งที่ใช้บน LINE LIFF, `/api/auth/line` คืน 200 แม้ backend พัง | เริ่มต้น `user` เป็น `EMPTY_USER`, ถอดปุ่มออกจากระบบใน `/profile` (เก็บ `login`/`logout` ไว้เฉพาะ `/debug`), `logout()`/`login()` คืนและล้าง Token/User สะอาด, `/api/auth/line` เช็ก `NODE_ENV !== 'production'` และไม่คืน success ปลอมเมื่อ Backend พัง |
| ✅ **B4** | [1.7, 1.9](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#1-auth-onboarding-profile--pdpa-consent) | `backend/src/routes/users.ts`<br>`backend/src/services/userService.ts` | `GET /api/users/:id/reviews` อยู่ก่อน `/me` ทำให้ `/me/reviews` ทะลุ Auth, `PATCH /api/users/me` ลบเบอร์/พร้อมเพย์ไม่ได้ และไม่กรองเบอร์โทร/LINE ใน `nickname` | ย้าย `use('/me', authMiddleware)` และ `/me/*` ขึ้นบนสุดก่อน `/:id/reviews`, ล้างค่า `phone_number`/`promptpay_id` ด้วย `null` หรือ `""` ได้, และกันการใส่ข้อมูลติดต่อลง `nickname` ด้วย `maskSensitiveData` บน Backend |

---

### หมวด C: Seller Credits, KYC, Setup & Storefront — ✅ แก้ไขครบแล้ว

| # | อ้างอิง Audit | ไฟล์หลักที่ต้องแก้ | ปัญหาปัจจุบัน (Before) | ผลลัพธ์หลังแก้ไข (After) |
|---|---|---|---|---|
| **✅ C1** | [2.2, 2.5, 2.9](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#2-seller-kyc-credits-top-up--shop-management) | `frontend/src/app/seller/credits/pay/page.tsx`<br>`frontend/src/app/seller/credits/success/page.tsx`<br>`frontend/src/app/seller/credits/page.tsx`<br>`frontend/src/components/v4/QrPayCard.tsx`<br>`frontend/src/hooks/useSeller.tsx`<br>`backend/src/services/userService.ts`<br>`backend/src/services/promptPayService.ts` | หน้าซื้อเครดิตเป็น Mock React State (รีเฟรชแล้วหาย), `processTopupSlip` เช็กสลิปซ้ำนอก `$transaction` และเอา `displayName` มาทับ `verifiedName` ของ KYC | หน้า `/seller/credits/pay` ดึง QR จาก `GET /api/users/me/topup-qr` มาแสดงใน `<QrPayCard />` และส่งสลิปเข้า `POST /api/users/me/topup-slip` (ใช้ Backend Dev Mode เมื่อ `NODE_ENV !== 'production'` และปฏิเสธใน Production หากขาด `SLIPOK_API_KEY`, ลบปุ่มจำลองการอนุมัติใน `/success` ออก) **เครดิตและ Ledger บันทึกลง Postgres จริง**, กันสลิปซ้ำจาก `transRef + slipImageUrl` ใน `$transaction`, ไม่เขียนทับ `verifiedName`, `getCreditLedger` กัน `NaN`, และ `promptPayService` คืน `400 AppError` |
| **✅ C2** | [2.3, 2.6](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#2-seller-kyc-credits-top-up--shop-management) | `backend/src/services/shopService.ts`<br>`backend/src/routes/seller.ts`<br>`frontend/src/hooks/useSeller.tsx` | KYC ไม่ตรวจ `isValidPersonName` หรือความยาวชื่อบน BE, หากไม่มี `idToken` FE แอบตั้ง `payeeVerified: true` เอง, `upsertMyShop`/`addMeetupPoint` ไม่กรองเบอร์/LINE ID และไม่ตรวจ `lat`/`lng`/`shipMode` | Backend ตรวจ `isValidPersonName`, Mod-11, กันเลขบัตรซ้ำข้ามบัญชีแบบ composite `(kycFirstName + kycLastName + kycNationalIdMasked)` เพื่อไม่เก็บเลขบัตรดิบ, กรอง contact leak ในชื่อร้าน/คำอธิบาย/จุดนัดรับ, ตรวจ `lat/lng` และ `shipMode`/`shipWithinDays`, ไม่ fallback ใช้ `user.displayName` ตอนสร้างร้าน, validate `:id`/`:pointId` UUID ใน route, และ FE ไม่ปลอม `payeeVerified` เมื่อ API fail |
| **✅ C3** | [2.7, 2.9](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#2-seller-kyc-credits-top-up--shop-management) | `frontend/src/app/seller/setup/page.tsx`<br>`frontend/src/app/seller/page.tsx`<br>`frontend/src/app/seller/[sellerId]/page.tsx`<br>`frontend/src/app/wishlist/page.tsx`<br>`frontend/src/lib/mappers.ts`<br>`backend/src/services/shopService.ts` | `/seller/setup?step=1` แครช, แก้ร้านแล้วทับ `shipMode`/`shipWithinDays` กลับเป็นค่าเริ่มต้น, หน้าร้านว่าง crash `sellerInfo.sellerName`, คะแนนร้าน 0 รีวิวคืน `5.0`, ปุ่ม "รายงานร้าน" เป็น Toast หลอก | `/seller/setup` clamp step ไม่แครช + โหลดและให้เลือก `shipMode` (`DAILY`/`AFTER_ACCEPT`) และ `shipWithinDays` ได้จริง, `/seller` แสดง Empty State เฉพาะเมื่อไม่มีประกาศทั้ง 3 กลุ่มและไม่ fallback รูป LINE, `/seller/[sellerId]` คืน `rating: 0` เมื่อ 0 รีวิว (แสดง `"ยังไม่มีคะแนน"`), แก้ crash เมื่อร้านยังไม่มีประกาศ, และปรับปุ่ม "รายงานร้าน" กับ "Wishlist LINE Alert" ให้แจ้งตรงๆ ว่ากำลังพัฒนา/พาไป `/help` |

---

### หมวด D: Book Discovery, Listing Create/Edit & Image Upload ✅

| # | อ้างอิง Audit | ไฟล์หลักที่ต้องแก้ | ปัญหาปัจจุบัน (Before) | ผลลัพธ์หลังแก้ไข (After) |
|---|---|---|---|---|
| **✅ D1** | [5.1, 5.2, 5.4, 4.3](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#5-seller-listing-createedit--image-upload) | `backend/src/services/bookService.ts`<br>`backend/src/services/gradingService.ts`<br>`backend/src/services/googleBooksService.ts`<br>`backend/src/routes/books.ts`<br>`backend/src/types/services.ts` | `createBookListing` เขียนทับ `BookCatalog` ของ ISBN เดิมทั้งระบบ, ยอมให้ร้านไม่ verified ตั้ง `allowDelivery: true`, `price: 0`/`NaN`/ขาด `conditionAnswers` ทำ API 500, `GET /api/books/:id` เปิดประกาศ `HIDDEN`, `GET /api/users/me/books` ขาด fields ส่งมอบ/รายละเอียด, `sanitizeIsbn`/`?limit=abc` คืน `500` | `createBookListing` ใช้ `update: {}` ไม่เขียนทับ `BookCatalog` เดิม, บังคับร้านต้อง verified + `supportsParcel` ก่อนเปิดส่งพัสดุ (ทั้งตอนสร้างและแก้ไข), validate `price > 0` (`Number.isFinite`), `title`, `conditionAnswers`, URL รูป และช่องทางส่งมอบ ≥ 1, ซ่อน `HIDDEN` จากคนอื่น (404), ปัดราคาแนะนำเป็นจำนวนเต็มบาทตรง FE/BE, เพิ่ม fields ใน `getUserBookListings`, และ `sanitizeIsbn`/pagination/filter คืน `400` แทน `500` |
| **✅ D2** | [5.3, 5.5, 5.6, 5.8](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#5-seller-listing-createedit--image-upload) | `frontend/src/components/ui/ConditionChecklist.tsx`<br>`frontend/src/components/ui/PriceSuggest.tsx`<br>`frontend/src/lib/mappers.ts`<br>`frontend/src/hooks/useListing.tsx`<br>`frontend/src/hooks/useSeller.tsx`<br>`frontend/src/app/seller/listings/[id]/edit/page.tsx`<br>`frontend/src/app/seller/page.tsx`<br>`frontend/src/app/seller/list/*`<br>`frontend/src/app/seller/report/sent/page.tsx`<br>`frontend/src/app/wishlist/page.tsx` | สูตรเกรด FE (`0/1/2/3`) ไม่ตรงกับ BE (`pages->D`, `stains/markings->C`) และราคาแนะนำปัดคนละแบบ, หน้าแก้ไข state ค้างตอน Refresh & ห้ามส่งพัสดุไม่ได้, ล็อกประกาศด้วย `book.title` แทน `book.id`, ลบ defect แล้วรูปยังค้างส่ง, `SET` mode สุ่ม ISBN ปลอม & key ชน, ปุ่มใส่ ISBN เองตัดตัว `X` ออก, ล็อกราคาปกแม้เป็น `0`, ลิงก์แชร์ success ชี้ `mock-liff-id/listing-01`, ป้าย mock 2/10 + `4.9` + Figma IDs ค้าง | เกรดและราคาแนะนำจำนวนเต็มบาทหน้า FE ตรงกับ DB 100%, หน้าแก้ไข hydrate หลัง Refresh และบล็อกส่งพัสดุตามสิทธิ์ KYC+parcel, ล็อกประกาศรายเล่มด้วย `book.id`, ลบ defect รูปหลุดออกจริง, โหมด `SET` ปรับใช้ `totalVolumes` + `missingVolumes` โดยไม่สร้าง ISBN ปลอม, คงตัว `X` ใน ISBN-10, แก้ `originalPrice` ที่ยังว่างได้, ลิงก์แชร์ชี้ `/book/{created.id}` จริง, ลบโควต้าปลอม 2/10 (`ลงขายฟรี · ไม่จำกัดจำนวน`), ลบ `4.9`/`0 วิว` และป้าย Figma (`(S2M)`, `(TMISSING)`, `(TPRICE)`, `(TSHARE)`, `(S6RS)`, `(B4)`, `(B4OK)`) ออกทั้งหมด |
| **✅ D3** | [5.7](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#5-seller-listing-createedit--image-upload) | `backend/src/services/uploadService.ts`<br>`backend/src/middlewares/errorHandler.ts` | เชื่อแค่ `file.mimetype` จาก client และไฟล์ใหญ่เกิน `LIMIT_FILE_SIZE` คืน `500` | ตรวจ Magic Bytes ของไฟล์ภาพจริง (JPEG/PNG/WEBP) กันไฟล์ปลอมที่สวม `mimetype` และแปลง `MulterError` เป็น `413 Payload Too Large` (`FILE_TOO_LARGE`) / `400` |

---

### หมวด E: Post-Order State Machine, Concurrency, Handover & PDPA — ✅ แก้ไขครบแล้ว

| # | อ้างอิง Audit | ไฟล์หลักที่ต้องแก้ | ปัญหาปัจจุบัน (Before) | ผลลัพธ์หลังแก้ไข (After) |
|---|---|---|---|---|
| **✅ E1** | [6.1, 2.4](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#6-post-order-state-machine-chat-handover-no-show-dispute--review) | `backend/src/services/orderService.ts` | `acceptOrder` หักเครดิตติดลบได้, `cancelOrder` คืนเครดิตซ้ำ 2 รอบได้, `shipOrder`/`receiveOrder`/`completeDeliveryOrder`/`verifyOrderPaymentSlip` เช็กสถานะนอก `$transaction` | ทุก state transition ใช้เงื่อนไข `where: { id, status }` (หรือ `credits: { gte: 1 }`) ภายใน `$transaction` — กดพร้อมกันกี่รอบก็ไม่หักเครดิตติดลบ ไม่คืนเครดิตเบิ้ล และไม่เขียนทับสถานะที่ยกเลิก/ร้องเรียนแล้ว |
| **✅ E2** | [6.3](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#6-post-order-state-machine-chat-handover-no-show-dispute--review) | `backend/src/services/orderService.ts`<br>`frontend/src/app/orders/[id]/page.tsx`<br>`frontend/src/components/v4/HandoverCode.tsx` | ปุ่มผู้ขายเรียก `complete-meetup` ปิดงานนัดรับได้โดยไม่ต้องกรอกรหัส 6 หลัก, `<HandoverCode />` ไม่ได้ใช้เลย | ในสถานะ `SCHEDULED` **ฝั่งผู้ซื้อเห็น `<HandoverCode />` 6 หลัก** และ **ฝั่งผู้ขายต้องกรอกรหัส 6 หลักส่ง `POST /api/orders/:id/handover` เพื่อปิดงาน** (ปิดช่องทางข้ามรหัสใน `complete-meetup` และ `receiveOrder` สำหรับนัดรับ) |
| **✅ E3** | [6.4, 6.5, 6.6](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#6-post-order-state-machine-chat-handover-no-show-dispute--review) | `frontend/src/lib/orderStateMachine.ts`<br>`frontend/src/app/orders/[id]/schedule/page.tsx`<br>`frontend/src/app/orders/[id]/tracking/page.tsx`<br>`frontend/src/app/orders/[id]/receive/page.tsx`<br>`frontend/src/app/orders/[id]/no-show/page.tsx`<br>`frontend/src/app/seller/report/page.tsx`<br>`backend/src/services/orderService.ts` | ผู้ซื้อ/ผู้ขายยืนยันหรือปรับนัดต่อไม่ได้เมื่อเป็น `SCHEDULED`, พัสดุสับสน `PAID` กับ `SHIPPED` จนกรอกเลขพัสดุ/กดรับของพัง, Flow `no-show` ผู้ซื้อชี้แจงไม่ได้และ `/seller/report` ทิ้งหลักฐาน | 1. นัดรับ (`ACCEPTED`/`SCHEDULED`): ปรับเวลาและกดยืนยันกันสองฝั่งได้ลื่นไหล<br>2. พัสดุ: แยกชัด `PAID` = รอผู้ขายกรอกเลขพัสดุ ➔ `SHIPPED` = รอผู้ซื้อถ่ายรูปยืนยันรับของ (`orderStateMachine.ts` ตรง BE 100%)<br>3. No-Show: `GET /api/orders/:id` คืน `missedMeetingReportedAt`, ผู้ซื้อเห็นปุ่ม/ฟอร์มชี้แจงใน `/no-show`, `/seller/report` ส่งคำอธิบาย+หลักฐานได้และกรองเฉพาะออเดอร์ที่แจ้งได้ |
| **✅ E4** | [6.7, 6.8, 6.9](file:///D:/Project/GongDong-Hack-DII/Biwdocs/FULL_SYSTEM_FLOW_AUDIT.md#6-post-order-state-machine-chat-handover-no-show-dispute--review) | `backend/src/services/orderService.ts`<br>`backend/src/routes/orders.ts`<br>`backend/src/services/dataMaskingService.ts`<br>`backend/src/services/reviewService.ts`<br>`frontend/src/lib/mappers.ts`<br>`frontend/src/app/orders/[id]/*`<br>`frontend/src/components/v4/DateTimePicker.tsx`<br>`frontend/src/components/v4/ChatRoom.tsx`<br>`frontend/src/hooks/useV4Orders.tsx` | `GET /api/orders/:id` ไม่คืน `review` (รีวิวหายหลังโหลดใหม่) และส่งเบอร์โทรผู้ซื้อ + ชื่อ/รูปผู้ซื้อตอน `REQUESTED` (หลุด PDPA), Backend ไม่ mask IG/FB/Email/คำชวนโอนตรง, `CANCELLED` ซ่อนประวัติแชท, URL `?role=` fallback ผิดฝั่ง, ปุ่ม Submit กดเบิ้ลได้และ Tracking มี 2 ปุ่ม, DateTimePicker วันที่เพี้ยนหลังเที่ยงคืน, ไม่ validate `:id` UUID | คืน `review` ในออเดอร์, ตัดเบอร์โทรและข้อมูลตัวตนตอน `REQUESTED` ตามกติกา PDPA v4 100%, Backend `maskSensitiveData` ครบทั้งแชท+รีวิว, เห็นประวัติแชทอ่านอย่างเดียวเมื่อ `CANCELLED`, `SCHEDULE_CARD` แสดงการ์ดนัดรับสวย, แยกบทบาทจาก `isMineAsBuyer(order)` แทน URL param, ลบปุ่มซ้ำ + ใส่ `disabled={submitting}`, วันที่ไทยถูกต้องทุกเวลา, ป้องกัน 500 จาก `:id` ที่ไม่ใช่ UUID, ซ่อนปุ่ม `devBypass` นอก Dev Flag |

---

## กลุ่มที่ 2: รายการที่ควรแก้ใน Prisma Schema (รัน `prisma db push` / `migrate dev` บนเครื่อง) ✅ *(แก้ไข Schema, Backend/Frontend, Unit Tests, ERD และ `prisma db push` ลง Postgres เรียบร้อยแล้ว)*

จุดเหล่านี้อยู่ใน [schema.prisma](file:///D:/Project/GongDong-Hack-DII/backend/prisma/schema.prisma) — อัปเดต Schema, โค้ด Backend/Frontend, Unit Tests, [DATABASE_ERD.md](file:///D:/Project/GongDong-Hack-DII/docs/DATABASE_ERD.md) และรัน `npx prisma db push` ลง Docker PostgreSQL (`gongdong-postgres` บน `localhost:5434`) พร้อม `npx prisma generate` เรียบร้อยแล้ว:

| # | Model / Column | เหตุผลที่ต้องแก้ใน Schema | ผลลัพธ์หลัง Migration |
|---|---|---|---|
| ✅ **DB1** | `Review`: เพิ่ม `@@unique([orderId, reviewerId])` | ปัจจุบันเช็กซ้ำแค่ใน `createOrderReview` (`findFirst`) ซึ่งโดน Race Condition ยิงรีวิวเบิ้ลได้ | เพิ่ม `@@unique([orderId, reviewerId])` ใน `schema.prisma` + `uq_reviews_order_reviewer` ใน ERD เพื่อการันตีระดับ Database ว่า 1 ผู้ใช้รีวิวต่อ 1 ออเดอร์ได้ไม่เกิน 1 ครั้ง (คู่กับ catch `P2002` -> `400 ALREADY_REVIEWED` ใน `reviewService`) |
| ✅ **DB2** | `User`: เพิ่ม `kycNationalIdHash String? @unique` | ปัจจุบันเก็บแค่ `kycNationalIdMasked` (`x-xxxx-xxxx1-23-4`) ทำให้ตรวจเลขบัตรซ้ำข้ามบัญชีแบบแม่นยำไม่ได้ | เพิ่ม `User.kycNationalIdHash` (`VarChar(64) @unique`) และใช้ HMAC-SHA256 + `KYC_HASH_PEPPER` (fallback เฉพาะ dev/test; production บังคับตั้งค่า) พร้อมเช็ก `findUnique` + catch `P2002` -> `409 DUPLICATE_KYC_IDENTITY` ใน `shopService` |
| ✅ **DB3** | `User`: เพิ่ม `pdpaConsentAt DateTime?` | ปัจจุบันเก็บ PDPA Consent แค่ใน `localStorage` ซึ่งหายเมื่อเปลี่ยนเครื่องหรือเข้าผ่าน LIFF ใหม่ | เพิ่ม `User.pdpaConsentAt` + ส่งผ่าน `GET/PATCH /api/users/me` และ `POST /api/seller/kyc` เพื่อบันทึกหลักฐาน PDPA ลง DB และ hydrate state ใน `useProfile` / `useLiff` / `/seller/setup` (ไม่บล็อกผู้ซื้อที่ไม่ได้ผ่าน `/setup` ตามแนวทาง A) |
| ✅ **DB4** | `Order.idempotencyKey` & `PaymentSlip.storagePath` | `Order`: เดิมกันซ้ำแค่ใน memory (`runWithIdempotency`) และ `PaymentSlip`: ไม่เก็บ path ทำให้ re-sign รูปสลิปหลัง 7 วันไม่ได้ | เพิ่ม `Order.idempotencyKey` (`VarChar(128) @unique`, scope `${buyerId}:${mode}:${rawKey}:${sellerId}`) พร้อม DB recovery ใน `orderService`, และเพิ่ม `PaymentSlip.storagePath` เพื่อดึง signed URL ใหม่ใน `getOrderDetail` ผ่าน `resolveSignedStorageUrl` |

---

## กลุ่มที่ 3: สิ่งที่ยัง "คงโหมด Dev/Mock" ไว้เทสบนเครื่อง (เปลี่ยนเป็นของจริงช่วง LINE Dev / Prod)

1. **Mock Auth (`useLiff.tsx` + `auth.ts` `Bearer mock_...` / `x-user-id`)**:
   - **เหตุผล**: บนเครื่องที่ยังไม่เชื่อม LINE Dev ต้องใช้ตัวนี้เพื่อสลับเทส 2 บทบาท (ผู้ซื้อ ↔ ผู้ขาย) ได้รวดเร็ว
   - **สิ่งที่จะทำทันที**: คงไว้เฉพาะเมื่อ `NODE_ENV !== 'production'` และใส่ Guard ปิดตายใน Production สำหรับ `LINE_CHANNEL_SECRET` และ `LINE_LIFF_CHANNEL_ID`
2. **SlipOK Real API (`SLIPOK_API_KEY`) ใน `processTopupSlip` & `verifyOrderPaymentSlip`**:
   - **เหตุผล**: ยังไม่มี API Key ของ SlipOK จริงบนเครื่อง
   - **สิ่งที่จะทำทันที**: ให้ Frontend เรียก API Backend จริงใน **Dev Mode** (เฉพาะ `NODE_ENV !== 'production'` + บังคับ `paymentMethod === 'TRANSFER'` ในออเดอร์) เมื่อมี SlipOK Key ค่อยเสียบ Verifier จริงโดยไม่ต้องแก้ Flow Frontend ซ้ำ
3. **LINE Push Notification & LINE Webhook (`webhooks.ts`, `lineNotifyService.ts`)**:
   - **เหตุผล**: Webhook และแจ้งเตือนเข้าแชท LINE ต้องใช้ ngrok/โดเมนจริงและ Channel Secret ของ LINE Dev
   - **สิ่งที่จะทำทันที**: ใส่ Deduplication (`webhookEventId`) + error handling ราย event + Fail-closed signature check ใน Production รอไว้ในโค้ด
4. **Supabase Storage & Camera Desktop Fallback (`uploadService.ts`, `CameraCapture.tsx`)**:
   - **เหตุผล**: หากบนเครื่องยังไม่ได้ต่อ Supabase หรือคอมไม่มีกล้อง ยังต้องมีรูปทดสอบสำหรับ Flow ลงขาย
   - **หมายเหตุ**: ยังสามารถเทส Flow ลงขายจนจบได้ แต่เมื่อเปิดดูรูปในหน้าต่างๆ แนะนำต่อ Supabase Dev bucket เพื่อให้พรีวิวรูปขึ้นจริง (แทน `mock-storage.gongdong.local`)

---

## ภาพรวมผลลัพธ์ที่จะเกิดขึ้นหลังแก้ไขครบ (เมื่อทดสอบบนเครื่อง Localhost)

เมื่อดำเนินการแก้ไขกลุ่มที่ 1 (และกลุ่มที่ 2 บน Postgres ในเครื่อง) เรียบร้อยแล้ว **ประสบการณ์การทดสอบ End-to-End บนเครื่อง Localhost** จะเปลี่ยนจากเดิมดังนี้:

1. **✅ เริ่มต้นใช้งาน & PDPA ถูกต้องตั้งแต่ก้าวแรก (หมวด B แก้ไขแล้ว)**:
   - เข้าเว็บครั้งแรกด้วยบัญชีใหม่ ไม่มีอาการ 500 `P2002` จากการยิงหลาย API พร้อมกัน
   - ผู้ซื้อใช้บัญชี LINE ได้เลยไม่ต้องเด้งไป `/setup` กวนใจ ส่วนผู้ขายใน `/seller/setup` ใช้ **ชื่อร้าน + รูป Avatar ร้าน** และกดยินยอม PDPA ในหน้าเดียวจบ โดย **ชื่อ-รูป LINE จริงไม่หลุดไปบันทึกทับโปรไฟล์สาธารณะฝั่งผู้ขาย**
2. **✅ ค้นหา & เลือกซื้อแม่นยำขึ้นทุกหน้า (หมวด A แก้ไขแล้ว)**:
   - หน้าแรกและหน้าค้นหากรองเกรด A/B/C/D, หมวดหมู่, ราคา และคำค้น `?q=` ได้จริง ไม่เจอหน้าว่างผิดพลาด
   - กดเพิ่มที่อยู่/แก้ไข/ตั้งค่าเริ่มต้นที่ `/addresses` ได้ทุกจังหวัดทั่วไทย แล้วนำไปใช้สั่งซื้อแบบส่งพัสดุหลายร้านใน `/cart` ได้ทันที
   - หน้าแจ้งเตือน `/notifications` และจุดแดงบนไอคอนกระดิ่งแสดงข้อมูลจริงจาก Database แยกฝั่ง Buyer/Seller ชัดเจน
3. **✅ ฝั่งผู้ขาย (ลงขาย, แก้ไขประกาศ, อัปโหลดรูป, ตั้งค่าร้าน & เติมเครดิต — หมวด C & D แก้ไขแล้ว)**:
   - ลงขายหนังสือใน `/seller/list` แสดงเกรดและราคาแนะนำจำนวนเต็มบาทตรงกับ Backend 100%, ไม่ไปทับข้อมูล `BookCatalog` ของร้านอื่น, ร้านที่ยังไม่ KYC+`supportsParcel` ไม่สามารถเปิดขายส่งพัสดุได้
   - หน้าแก้ไข `/seller/listings/[id]/edit` รีเฟรชแล้วไม่หาย ไม่ล็อกผิดเล่มเมื่อชื่อหนังสือซ้ำกัน อัปโหลดรูปตรวจ magic bytes จริง และไม่แสดงป้าย Figma/ข้อมูล mock หลอกสายตา
   - หน้าเติมเครดิต `/seller/credits/pay` กดชำระทดสอบแล้วบันทึกเครดิต + ประวัติ Ledger ลง Database จริง (รีเฟรชไม่หาย และแสดงชื่อรายการรับ/คืนเครดิตถูกต้อง)
4. **✅ Post-Order State Machine ปิดลูปครบไม่มีจุดตัน (หมวด E แก้ไขแล้ว)**:
   - **โหมดนัดรับ**: ผู้ซื้อ/ผู้ขายสลับเสนอนัดและยืนยันกันได้ทั้งใน `ACCEPTED` และ `SCHEDULED` -> ผู้ซื้อได้ **รหัส 6 หลัก** -> ผู้ขายกรอกรหัสปิดงานจริง (ข้ามรหัสไม่ได้) -> แจ้งเบี้ยวนัด/ชี้แจงใน `/no-show` ใช้งานได้จริง
   - **โหมดพัสดุ**: สถานะไหลตรงกันทั้งระบบ (`ACCEPTED` ➔ `PAID` ➔ ผู้ขายใส่ Tracking เป็น `SHIPPED` ➔ ผู้ซื้อถ่ายรูปยืนยันรับของเป็น `COMPLETED`)
   - **หลังจบออเดอร์ & ความปลอดภัย**: รีวิวบันทึกแล้วไม่หายเมื่อโหลดใหม่, ไม่มีเบอร์โทรผู้ซื้อหลุดใน API, แชทและรีวิวบล็อกช่องทางติดต่อนอกแอปครบถ้วน, กดเบิ้ลหรือยิงพร้อมกันไม่ทำให้เครดิตติดลบหรือคืนเครดิตซ้ำ

---

> **พร้อมลงมือแก้ไขเป็น Phase ย่อยได้เลย**: หากต้องการเริ่มแก้ชุด Code-Only ทันที สามารถสั่งทำทีละหมวด (เช่น `หมวด A+B` ก่อน, ต่อด้วย `หมวด C+D` และปิดด้วย `หมวด E`) แล้วรันเทสตรวจสอบบนเครื่องไปพร้อมกันได้เลยครับ
