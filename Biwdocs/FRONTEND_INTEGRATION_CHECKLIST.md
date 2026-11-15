# Frontend Integration Checklist: ลบ Mock Data และเชื่อม Backend จริง (v3.0.0)

> เอกสารนี้สรุปจากการตรวจสอบโค้ดฝั่ง Frontend (`frontend/src/`) เทียบกับ API และ Schema ล่าสุดของ Backend (`backend/src/` + `backend/prisma/schema.prisma` v3.0.0) เพื่อให้ทีมรู้ว่าต้อง **ลบ/แยกส่วนจำลองอะไรออก**, **แก้ไขจุดไหนบ้าง**, และมี **ช่องว่างระหว่าง Frontend–Backend** จุดใดที่ต้องแก้ควบคู่กัน

---

## ภาพรวม: สิ่งที่เกิดขึ้นตอนนี้
ปัจจุบันหน้าจอและ Context ฝั่ง Frontend เกือบทั้งหมดยังทำงานแบบ **Prototype In-Memory**:
* ดึงข้อมูลเริ่มต้นจากไฟล์ใน `frontend/src/mocks/` (`MOCK_BOOKS`, `MOCK_SHOPS`, `MOCK_V4_ORDERS`, `MOCK_SELLER_*` ฯลฯ)
* แก้ไขสถานะเฉพาะใน React `useState` (รีเฟรชหน้าแล้วข้อมูลหาย)
* ยังไม่มี HTTP API client กลาง และใน `frontend/.env.example` ยังไม่มีตัวแปร `NEXT_PUBLIC_API_URL`
* ระบบอัปโหลดรูปและสลิปยังใช้ `URL.createObjectURL(file)` / `FileReader.readAsDataURL(file)` บนเบราว์เซอร์แทนการอัปโหลดขึ้น `POST /api/upload`

---

## 1. Mock Data & Prototype Stubs ที่ต้องลบ (หรือแยกค่าคงที่ออกก่อนลบ)

### 1.1 ไฟล์ใน `frontend/src/mocks/` (ลบเมื่อเชื่อมหน้าจอครบ)
| ไฟล์ | ข้อมูล Mock ภายใน | คำอธิบาย / หมายเหตุ |
| :--- | :--- | :--- |
| `frontend/src/mocks/books.ts` | `MOCK_BOOKS`, `MOCK_ADDRESSES`, `MOCK_ORDERS`, `MOCK_WISHLIST`, `MOCK_NOTIFICATIONS` | ชุดข้อมูลจำลองหลักฝั่งผู้ซื้อ ตะกร้า ที่อยู่ แจ้งเตือน และ Wishlist |
| `frontend/src/mocks/shops.ts` | `MOCK_SHOPS`, `getShopById` | ข้อมูลร้านค้าสาธารณะ จุดนัดรับ และรีวิวจับคู่ตาม `sellerId` |
| `frontend/src/mocks/v4.ts` | `MOCK_BUYER`, `MOCK_BUYER_2`, `MOCK_SHOP`, `MOCK_SHOP_NEW`, `MOCK_V4_ORDERS`, `MOCK_V4_ORDER`, `MOCK_V4_CHAT`, `MOCK_V4_LEDGER` | ข้อมูลจำลองโฟลว์ v4 ทั้งออเดอร์ แชท และสมุดบัญชีเครดิต |
| `frontend/src/mocks/seller.ts` | `MOCK_SELLER_LISTINGS`, `MOCK_SELLER_ORDERS`, `MOCK_CREDIT_PACKAGES`, `SELLER_MEETUP_ZONES`, `REPORT_REASONS`, `GRADE_CRITERIA` | **ระวังก่อนลบ:** ไฟล์นี้มีค่าคงที่ UI ปนอยู่ด้วย (ดูข้อควรระวังด้านล่าง) |

> ⚠️ **ข้อควรระวังก่อนลบ `frontend/src/mocks/seller.ts`:**
> มีค่าคงที่ที่หน้าจอยัง import ไปใช้งานโดยตรง ได้แก่:
> * `GRADE_CRITERIA` → ใช้ใน `frontend/src/app/seller/list/step-3/page.tsx`
> * `REPORT_REASONS` → ใช้ใน `frontend/src/app/seller/report/page.tsx`
> * `MOCK_CREDIT_PACKAGES` → ใช้ใน `frontend/src/app/seller/credits/page.tsx`, `credits/pay/page.tsx`, `credits/success/page.tsx`
>
> **แนวทางแก้:** ให้ย้าย `GRADE_CRITERIA`, `REPORT_REASONS`, `SELLER_MEETUP_ZONES` และรายการแพ็กเกจเครดิตมาตรฐานไปไว้ใน `frontend/src/lib/` (เช่น `frontend/src/lib/catalog.ts`) ก่อนลบไฟล์ `mocks/seller.ts` มิฉะนั้น TypeScript build จะพัง

### 1.2 Stub จำลอง & หน้า Dev-Only
| ไฟล์ | สถานะปัจจุบัน | สิ่งที่ควรทำ |
| :--- | :--- | :--- |
| `frontend/src/lib/qr.ts` | `buildQrCells` สร้างตาราง QR ปลอมจาก hash ของข้อความ (ใช้ใน `MockQr.tsx`, `QrPayCard.tsx`) | เปลี่ยนไปใช้ PromptPay QR จริง และย้าย `formatTHB` ไป helper กลาง |
| `frontend/src/lib/lineAssets.ts` | `sendFlex` เป็น stub ที่ `console.log` และคืน `{ ok: true, mocked: true }` โดยไม่ยิง network | ใช้เฉพาะ preview หรือลบออกเมื่อ Backend เป็นคนส่ง LINE Flex จริง |
| `frontend/src/app/debug/page.tsx` | หน้าตรวจสอบสถานะ LIFF สำหรับ Dev/Staging | ซ่อนเมื่อ `NODE_ENV === 'production'` หรือลบออกก่อนขึ้นจริง |
| `frontend/src/app/design-system/page.tsx` | หน้าโชว์ UI components (import `MOCK_BOOKS` และ `V4Showcase`) | ซ่อน/ตัดออกใน production build |
| `frontend/src/app/line-preview/page.tsx` | หน้าทดลอง Flex templates (import `lib/lineAssets.ts`) | ซ่อน/ตัดออกใน production build |
| `frontend/src/components/v4/V4Showcase.tsx` | คอมโพเนนต์โชว์เคส (import `MOCK_BOOKS`, `MOCK_V4_*`) | ใช้คู่กับ `design-system/` เท่านั้น หรือลบพร้อมกัน |

---

## 2. โครงสร้างพื้นฐาน, Auth และ Hooks (จุดศูนย์กลางที่ต้องแก้)

### 2.1 Environment Variables & Shared HTTP Client
1. **เพิ่ม `NEXT_PUBLIC_API_URL`** ลงใน `frontend/.env.local` และ `frontend/.env.example` (เช่น `http://localhost:4000`) เพราะปัจจุบันใน `frontend/.env.example` ยังไม่มีตัวแปรชี้ไปยัง Backend
2. **สร้างไฟล์ `frontend/src/lib/api.ts`** (ปัจจุบันยังไม่มี API client กลางใน `src/lib/`):
   * แปะ `NEXT_PUBLIC_API_URL` อัตโนมัติ
   * แนบ Header `Authorization: Bearer <idToken>` จาก `useLiff().idToken` ทุกคำขอ
   * แปลง response รูปแบบ `{ success, data, error }` จาก Backend ให้จัดการ error ง่ายในทุก Hook

### 2.2 ระบบ Auth & LIFF
* **`frontend/src/hooks/useLiff.tsx`:**
  * ปิด `NEXT_PUBLIC_LIFF_MOCK=true` บน production และเอา logic fallback ที่สลับกลับเป็น `MOCK_USER` (`usr_mock_01`) / `mock_id_token_...` เมื่อ `liff.init()` ล้มเหลวออก
  * เมื่อ `liff.init()` สำเร็จและได้ `idToken` ให้เรียก `GET /api/users/me` เพื่อดึงข้อมูล user, `credits`, `isVerifiedSeller` และโปรไฟล์จริงจาก Backend (หมายเหตุ: Middleware ใน `backend/src/middlewares/auth.ts` ตรวจ LINE ID Token กับ LINE OAuth API และ auto-create user พร้อมแจก 1 เครดิตเริ่มต้นให้ทันที; ส่วนในโหมด dev ยังสามารถส่ง `Bearer mock_<id>` หรือ `x-user-id` เข้า Backend ได้)
  * ยกเลิก `deductCredit` / `addCredits` แบบแก้ไข state ลอยๆ ฝั่ง client แล้วให้ refetch จาก API หลังทำรายการจริง
* **`frontend/src/app/api/auth/line/route.ts`:**
  * ปัจจุบันยังมี mock branch (`usr_mock_01`) และคอมเมนต์ `// 3. TODO: Supabase integration` โดยไม่ได้เชื่อมกับ Express Backend
  * **คำแนะนำ:** หากให้ Frontend ยิงเข้า Express Backend โดยตรงพร้อม `Authorization: Bearer <idToken>` สามารถลบ Next.js API route นี้ทิ้งได้ (หรือปรับให้เป็นตัว proxy ไปยัง `/api/users/me` ของ Backend)

### 2.3 Hooks / Providers ที่ต้องเปลี่ยนจาก `useState(MOCK_...)` เป็น API จริง
| Hook File | สิ่งที่ต้องลบออก | Backend API ที่ต้องเชื่อมแทน & หมายเหตุ |
| :--- | :--- | :--- |
| `frontend/src/hooks/useProfile.tsx` | state ใน memory อย่างเดียว (`nickname`, `avatar`, `consent`) | `GET /api/users/me`, `PATCH /api/users/me` |
| `frontend/src/hooks/useCart.tsx` | `[MOCK_BOOKS[0]]` (L39), `MOCK_ADDRESSES[0]` (L44) | เก็บสินค้าในตะกร้าลง `localStorage` และดึงที่อยู่จาก `GET /api/users/me/addresses`<br>🐛 **บั๊กที่ต้องแก้:** บรรทัด 80–85 ยังคำนวณค่าส่งแบบเก่า `40 + (items.length - 1) * 10` ไม่ตรงกับ `cart/page.tsx` และ Backend `shippingService.ts` (`35 + 10*(N-1) + 15`) ต้องปรับให้ใช้ `calcParcelFee` ตัวเดียวกัน |
| `frontend/src/hooks/useSeller.tsx` | `MOCK_SELLER_ORDERS`, `MOCK_SELLER_LISTINGS`, `MOCK_V4_LEDGER` (L83–87) และ `approveTopUp()` แบบจำลอง | • ร้านค้า: `GET /api/seller/shop`, `PUT /api/seller/shop`, `POST/DELETE /api/seller/meetup-points`, `POST /api/seller/kyc`<br>• หนังสือของฉัน: `GET /api/users/me/books`, `POST /api/books`, `PATCH /api/books/:id`, `DELETE /api/books/:id`<br>• เครดิต: `GET /api/users/me/credits/history`, `POST /api/users/me/topup-slip` |
| `frontend/src/hooks/useV4Orders.tsx` | `MOCK_V4_ORDERS`, `MOCK_V4_CHAT`, `MOCK_BUYER` (L64–65, L89, L203) | • แก้ `isMineAsBuyer` (L88–89) จากการเทียบ `order.buyer.nickname === MOCK_BUYER.nickname` เป็นเทียบ `order.buyer.id === user.id`<br>• รายการ/สร้าง: `GET /api/orders/buying`, `GET /api/orders/selling`, `GET /api/orders/:id`, `POST /api/orders`<br>• เปลี่ยนสถานะ: `/accept`, `/reject`, `PATCH /:id/schedule`, `/handover`, `/payment-slip`, `/ship`, `/confirm-receipt` หรือ `/receive`, `/complete-meetup`, `/cancel`, `/dispute`, `/report-missed-meeting`, `/dispute-missed-meeting`, `/review`<br>• แชท: `GET /api/orders/:id/messages`, `POST /api/orders/:id/messages` (ต้อง polling หรือ refetch เพราะ Backend ยังไม่มี WebSocket) |

---

## 3. หน้าจอ (Pages) และระบบอัปโหลดไฟล์ที่ต้องแก้

### 3.1 หน้าจอที่ Import ข้อมูล Mock โดยตรง
| หน้าจอ / ไฟล์ | ของเดิมที่ใช้ | API ที่ต้องเชื่อมแทน |
| :--- | :--- | :--- |
| `frontend/src/app/page.tsx` | กรองจาก `MOCK_BOOKS` | `GET /api/books` และ `GET /api/books/recommended` |
| `frontend/src/app/search/page.tsx` | กรองจาก `MOCK_BOOKS` | `GET /api/books` (ส่ง query params เช่น search, grade, mode, delivery) |
| `frontend/src/app/book/[id]/page.tsx` | `MOCK_BOOKS.find(...)` + `getShopById(...)` | `GET /api/books/:id` และ `GET /api/shops/:id` |
| `frontend/src/app/seller/[sellerId]/page.tsx` | `getShopById(...)` + `MOCK_BOOKS.filter(...)` | `GET /api/shops/:id` และ `GET /api/users/:id/reviews` |
| `frontend/src/app/cart/page.tsx` | `MOCK_ADDRESSES` (L360) + `getShopById(...)` | ที่อยู่จาก `GET /api/users/me/addresses` และร้านจาก `GET /api/shops/:id` |
| `frontend/src/app/addresses/page.tsx` & `addresses/edit/page.tsx` | `MOCK_ADDRESSES` และค่าเริ่มต้น hardcode ใน `edit/page.tsx` | `GET`, `POST`, `PATCH`, `DELETE` ที่ `/api/users/me/addresses` |
| `frontend/src/app/notifications/page.tsx` | `MOCK_NOTIFICATIONS` | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` |
| `frontend/src/app/seller/list/page.tsx` | `applyLookup(isbn)` (L46–49) แค่เคลียร์ค่าว่าง และสร้าง ISBN จำลองสำหรับชุดหนังสือ | เรียก `GET /api/books/isbn/:isbn` เพื่อดึงชื่อหนังสือ ผู้แต่ง สำนักพิมพ์ ราคาปก จาก Backend |

### 3.2 ระบบอัปโหลดรูปภาพและสลิป (สำคัญ)
คอมโพเนนต์และหน้าจอต่อไปนี้ยังสร้างแค่ URL ชั่วคราวในเบราว์เซอร์ (`URL.createObjectURL(file)` หรือ `FileReader.readAsDataURL(file)`) ทำให้บันทึกลง DB แล้วเปิดดูข้ามเครื่องไม่ได้ ต้องแก้ให้ส่ง `FormData` ขึ้น **`POST /api/upload`** ก่อน (ระบุ `bucket` ให้ตรงประเภท: `book-listings`, `avatars`, `order-receives`, `slips`, `disputes`) แล้วนำ `data.url` ที่ได้ไปเก็บในฟอร์ม/ออเดอร์:
1. `frontend/src/components/ui/PhotoUploader.tsx` (บรรทัด 35)
2. `frontend/src/components/v4/SlipUploader.tsx` (บรรทัด 35)
3. `frontend/src/components/v4/CameraCapture.tsx` (บรรทัด 96)
4. `frontend/src/app/seller/setup/page.tsx` (บรรทัด 327 — รูปโปรไฟล์ร้าน)

---

## 4. ช่องว่าง / จุดที่ฝั่ง Backend ต้องปรับเพิ่มควบคู่กัน

จากการตรวจเปรียบเทียบฝั่ง Backend (`backend/src/` + `backend/prisma/schema.prisma`) พบ 4 จุดที่ยังไม่ตรงหรือยังไม่มี Endpoint รองรับหน้าจอ Frontend:

1. **`GET /api/orders/:id` ยัง Serialize ฟิลด์ส่งออกไม่ครบ (`backend/src/routes/orders.ts`)**
   * ใน `orderService.ts` (`getOrderDetail`, บรรทัด 400–445) คำนวณข้อมูลชุด v3/v4 ออกมาครบแล้ว ได้แก่ `scheduleDateIso`, `scheduleTimeLabel`, `scheduleProposedBy`, `scheduleConfirmedByBuyer`, `receivedPhotoUrl`, `receivedAt`, `cancelReason`, `dispute`, `buyer.noShowCount`, `seller.shopName`
   * แต่ใน route handler `backend/src/routes/orders.ts` (บรรทัด 159–202) ยังเขียน `res.json` ส่งออกเฉพาะฟิลด์ชุดเดิม ทำให้ฟิลด์ใหม่เหล่านี้ถูกตัดทิ้งก่อนถึง Frontend ➔ **ต้องเพิ่มฟิลด์เหล่านี้ใน response JSON ของ `GET /api/orders/:id`**
2. **หน้า Wishlist (`frontend/src/app/wishlist/page.tsx`) ยังไม่มี Backend รองรับ**
   * หน้าจอยังใช้ `MOCK_WISHLIST` แต่ใน `backend/prisma/schema.prisma` และ `backend/src/routes/` **ยังไม่มี Model หรือ Endpoint สำหรับ Wishlist**
   * **ทางเลือก:** เพิ่มตาราง `Wishlist` + CRUD API ใน Backend (เพื่อให้ระบบแจ้งเตือน wishlist-match ทำงานได้จริง) หรือเก็บไว้ใน `localStorage` ชั่วคราว
3. **หน้า Seller Report ทั่วไป (`frontend/src/app/seller/report/page.tsx`)**
   * ปัจจุบันกดส่งแล้ว `router.push('/seller/report/sent')` ทันทีโดยไม่ยิง API
   * Backend ตอนนี้มีเฉพาะ `POST /api/orders/:id/report-missed-meeting` (ผู้ซื้อไม่มาตามนัด) และ `POST /api/orders/:id/dispute` (แจ้งข้อพิพาทในออเดอร์) ยังไม่มี endpoint สำหรับ report เคสทั่วไปพร้อมแนบรูปหลักฐานแยกต่างหาก
4. **PromptPay QR จริง**
   * Backend มี `generatePromptPayQR` ใน `backend/src/services/promptPayService.ts` อยู่แล้ว แต่ใน route ยังไม่ได้เปิด endpoint หรือแนบ `qrDataUrl` ออกมากับออเดอร์ (ปัจจุบัน `GET /api/orders/:id` ส่งมาเฉพาะ `promptpay_id`)
   * หากต้องการเลิกใช้ `buildQrCells` ใน `frontend/src/lib/qr.ts` ต้องเลือกเพิ่ม field/endpoint ส่ง QR จริงจาก Backend หรือให้ Frontend generate จาก `promptpay_id` จริง
