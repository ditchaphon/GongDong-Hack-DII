# Frontend Systems & Libraries Roadmap (สิ่งที่ต้องพัฒนาเพิ่มฝั่ง Frontend)

> เอกสารนี้สรุปจากการตรวจสอบโค้ดจริงใน `frontend/` เทียบกับ [Backend-doc/TECH_STACK.md](../Backend-doc/TECH_STACK.md) และ [mydocs/FRONTEND_INTEGRATION_CHECKLIST.md](../mydocs/FRONTEND_INTEGRATION_CHECKLIST.md) เพื่อใช้เป็นรายการงานพัฒนาฝั่ง Frontend ทั้งด้าน **ไลบรารี (Packages)** และ **ระบบเชื่อมต่อจริง**

---

## 1. สถานะไลบรารี (Packages) เทียบกับ `TECH_STACK.md`

### 1.1 ไลบรารีที่มีติดตั้งและใช้งานได้แล้วใน `frontend/package.json`
| แพ็กเกจ | เวอร์ชันปัจจุบัน | สถานะการใช้งานในโค้ดจริง |
|---|---|---|
| `next`, `react`, `react-dom` | `^16.3.8`, `^19.3.0` | พร้อมใช้งาน (App Router) |
| `tailwindcss`, `lucide-react`, `clsx`, `tailwind-merge` | พร้อมใช้งาน | UI Components & Styling ครบชุด |
| `@line/liff` | `^2.32.0` | เชื่อมแล้วใน `src/hooks/useLiff.tsx` (ต้องปิด Mock Mode เพื่อรันจริง) |
| `leaflet` | `^1.9.4` | เชื่อม OpenStreetMap Tile Server แล้วใน `LeafletMapInner.tsx` และ `MapPinPicker.tsx` (ไม่ได้ใช้ `react-leaflet` แต่ใช้งานแผนที่จริงได้แล้ว) |
| `@zxing/browser` + `@zxing/library` | `^0.2.1` / `^0.23.0` | เชื่อมกล้องสแกนบาร์โค้ด ISBN แล้วใน `src/components/v4/IsbnScanner.tsx` |

### 1.2 ไลบรารีที่ยังขาด / ควรติดตั้งเพิ่ม
| แพ็กเกจที่ต้องเพิ่ม | เหตุผลและหน้าที่ตาม `TECH_STACK.md` | หมายเหตุการใช้งาน |
|---|---|---|
| **`browser-image-compression`** | ย่อขนาดรูปถ่ายจากมือถือก่อนอัปโหลด (กว้างไม่เกิน `1080px`, แปลงเป็น `.webp` ~100–200 KB) | ช่วยประหยัดพื้นที่ Supabase Free Tier (1 GB) และไม่ให้เกิน Limit 5 MB ของ Backend (`POST /api/upload`) |
| **`jsqr`** (หรือเปลี่ยนไปใช้ **`html5-qrcode`**) | สแกนอ่าน **QR Code 2D บนรูปสลิปโอนเงินฝั่ง Client** เพื่อตรวจเบื้องต้นว่าเป็นรูปสลิปจริงก่อนส่งไป Backend (ช่วยประหยัดโควต้า SlipOK) | • **ทางเลือก A (แนะนำถ้าไม่อยากรื้อกล้องเดิม):** ลง `jsqr` เพิ่มสำหรับสแกนไฟล์รูปใน `SlipUploader.tsx` และคง `@zxing/browser` ไว้สำหรับสแกน ISBN<br>• **ทางเลือก B:** เปลี่ยนมาใช้ `html5-qrcode` ตัวเดียวทำทั้ง 1D Barcode (ISBN) และ 2D QR (สลิป) |
| **`@tanstack/react-query`** *(ทางเลือก)* | จัดการ Cache, Loading/Error State และ Refetching อัตโนมัติ (เช่น ห้องแชทออเดอร์, รายการหนังสือ, สถานะออเดอร์) | สามารถใช้ร่วมกับ Native `fetch` หรือเลือกใช้ Native `fetch` + React Context เดิมเพื่อลดการแก้โครงสร้างใหญ่ |

---

## 2. ระบบแกนกลางฝั่ง Frontend ที่ต้องพัฒนาเพิ่ม (Core Systems)

### 2.1 ระบบเชื่อมต่อ HTTP API กลาง (`src/lib/api.ts`) & Environment
* **เพิ่มตัวแปร `NEXT_PUBLIC_API_URL`** ลงใน `frontend/.env.local` และ `frontend/.env.example` (ปัจจุบันยังไม่มีค่า URL ชี้ไป Backend)
* **สร้าง `frontend/src/lib/api.ts`** (ปัจจุบันยังไม่มี API Client กลางใน `src/lib/`):
  * กำหนด Base URL จาก `process.env.NEXT_PUBLIC_API_URL`
  * แนบ Header `Authorization: Bearer <idToken>` จาก `useLiff().idToken` อัตโนมัติ
  * แกะโครงสร้าง response มาตรฐานของ Backend (`{ success, data, error }`) และโยน Error message ที่เข้าใจง่ายให้ UI แสดง Toast ได้ทันที

### 2.2 ระบบ Auth & LIFF Production Flow
* **`frontend/src/hooks/useLiff.tsx`:**
  * ปิด `NEXT_PUBLIC_LIFF_MOCK=true` บน production และเอา logic fallback ที่สลับกลับไปใช้ `MOCK_USER` (`usr_mock_01`) / `mock_id_token_...` เมื่อ `liff.init()` ล้มเหลวออก
  * เมื่อ `liff.init()` และ login สำเร็จ ให้ยิง `GET /api/users/me` เพื่อดึง `user.id`, `credits`, `isVerifiedSeller` และโปรไฟล์จริงจากฐานข้อมูล (แทนการแก้ `deductCredit` / `addCredits` แบบ state ลอยๆ ฝั่ง client)
* **`frontend/src/app/api/auth/line/route.ts`:**
  * ปัจจุบันยังมี mock branch และ `// 3. TODO: Supabase integration` โดยไม่ได้เชื่อม Express Backend — ให้ลบออกแล้วยิงตรงเข้า Backend ด้วย `Bearer <idToken>` หรือปรับให้ proxy ไป Backend

### 2.3 ระบบบีบอัดรูป + อัปโหลดไฟล์เข้า Supabase ผ่าน Backend
* **สร้าง Utility `frontend/src/lib/imageCompression.ts`:**
  * ใช้ `browser-image-compression` ย่อรูปเป็น `.webp` (ไม่เกิน 1080px / ไม่เกิน ~200 KB) ก่อนอัปโหลด
* **สร้างฟังก์ชัน Upload กลาง (`POST /api/upload`)** ส่ง `FormData` พร้อมระบุ `bucket` (`book-listings`, `avatars`, `order-receives`, `slips`, `disputes`) แล้วนำ `data.url` ที่ได้ไปบันทึกต่อ
* **แก้ไข 4 จุดที่ยังสร้างแค่ Local Blob / Base64 (`URL.createObjectURL` / `FileReader.readAsDataURL`):**
  1. `frontend/src/components/ui/PhotoUploader.tsx` (รูปหนังสือ 4 มุม + ตำหนิ)
  2. `frontend/src/components/v4/SlipUploader.tsx` (รูปสลิปโอนเงิน + เพิ่มระบบสแกน QR 2D เบื้องต้นฝั่ง Client)
  3. `frontend/src/components/v4/CameraCapture.tsx` (รูปถ่ายยืนยันการรับของ)
  4. `frontend/src/app/seller/setup/page.tsx` (รูปโปรไฟล์ร้านค้า)

### 2.4 ระบบ PromptPay QR จริง & Human Firewall
* ยกเลิก `buildQrCells` ใน `frontend/src/lib/qr.ts` (ซึ่งตอนนี้วาด Mock QR จาก hash) ใน `MockQr.tsx` และ `QrPayCard.tsx`
* เปลี่ยนมารับ QR / EMVCo Payload จริงจาก Backend (`promptPayService.ts`) หรือสร้างจาก `promptpay_id` จริง พร้อมแสดงชื่อบัญชีผู้รับที่ผ่านการยืนยันแล้ว (`verifiedName`) เพื่อเตือนผู้ซื้อก่อนโอนเงิน

### 2.5 ระบบแชทในออเดอร์แบบ Real-time Polling
* เนื่องจาก Backend มี REST Endpoint (`GET /api/orders/:id/messages`, `POST /api/orders/:id/messages`) แต่ยังไม่มี WebSocket
* ฝั่ง Frontend (`useV4Orders.tsx` / Chat UI) ต้องเพิ่มการ Auto-refetch / Polling (เช่น ทุก 5–10 วินาทีขณะเปิดหน้าแชทออเดอร์) และคงกติกา **ห้ามส่งรูปอิสระในแชท** (ปิด input file ในช่องแชทตามสเปก)

---

## 3. การรื้อ Mock Data และเชื่อมหน้าจอทั้งหมดเข้า Backend API

### 3.1 ย้ายค่าคงที่ UI ออกจากไฟล์ Mock ก่อนลบ `src/mocks/`
1. ย้าย `GRADE_CRITERIA`, `REPORT_REASONS`, `SELLER_MEETUP_ZONES` และรายการแพ็กเกจเครดิต ออกจาก `frontend/src/mocks/seller.ts` ไปไว้ใน `frontend/src/lib/catalog.ts` (หรือไฟล์ constants)
2. เมื่อหน้าจอทั้งหมดเชื่อม API ครบแล้ว ลบไฟล์ใน `frontend/src/mocks/` (`books.ts`, `shops.ts`, `seller.ts`, `v4.ts`)

### 3.2 ปรับปรุง Hooks / Context (`frontend/src/hooks/`)
* **`useProfile.tsx`:** เชื่อม `GET /api/users/me` และ `PATCH /api/users/me`
* **`useCart.tsx`:**
  * ลบค่าเริ่มต้น `MOCK_BOOKS[0]`, `MOCK_ADDRESSES[0]` และเก็บสินค้าในตะกร้าลง `localStorage`
  * **แก้สูตรคำนวณค่าส่ง** (บรรทัด 80–85) จากสูตรเก่า `40 + (items.length - 1) * 10` ให้ตรงกับ `calcParcelFee` (`35 + 10*(N-1) + 15`) และ Backend `shippingService.ts`
* **`useSeller.tsx`:** เชื่อม `GET/PUT /api/seller/shop`, `POST/DELETE /api/seller/meetup-points`, `POST /api/seller/kyc`, `GET /api/users/me/books`, `POST/PATCH/DELETE /api/books`, `GET /api/users/me/credits/history`, `POST /api/users/me/topup-slip`
* **`useV4Orders.tsx`:** แก้ `isMineAsBuyer` จากการเทียบ `nickname === MOCK_BUYER.nickname` เป็นเทียบ `order.buyer.id === user.id` และเชื่อมทุก action เข้า `/api/orders/*`

### 3.3 ปรับปรุง Pages (`frontend/src/app/`)
* **ดึงข้อมูลตลาด/ร้านค้าจริง:** `page.tsx`, `search/page.tsx`, `book/[id]/page.tsx`, `seller/[sellerId]/page.tsx`, `cart/page.tsx`
* **จัดการที่อยู่ & แจ้งเตือน:** `addresses/page.tsx`, `addresses/edit/page.tsx`, `notifications/page.tsx`
* **เชื่อมระบบสแกน ISBN:** `seller/list/page.tsx` (`applyLookup`) ให้เรียก `GET /api/books/isbn/:isbn` เพื่อเติมชื่อหนังสือ ผู้แต่ง สำนักพิมพ์ ราคาปกอัตโนมัติ (พร้อมเก็บปุ่ม **"ไม่มี ISBN · กรอกเอง"** ไว้เป็น Fallback ตามสเปก)
* **จัดการหน้า Dev-Only:** ซ่อนหรือตัดหน้า `/debug`, `/design-system`, `/line-preview` และ `V4Showcase.tsx` ออกก่อน build production
* **หน้า Status รอตัดสินใจ:**
  * `/wishlist` (`wishlist/page.tsx`): ปัจจุบันถูกซ่อนจากเมนูในแอป (`BottomTab` / `profile`) และ Backend ยังไม่มี Model/API รองรับ
  * `/seller/report` (`seller/report/page.tsx`): ปัจจุบันยังไม่มี endpoint รายงานทั่วไปฝั่ง Backend (มีเฉพาะรายงานไม่มาตามนัด `/report-missed-meeting` และแจ้งข้อพิพาท `/dispute` ที่ผูกกับออเดอร์)
