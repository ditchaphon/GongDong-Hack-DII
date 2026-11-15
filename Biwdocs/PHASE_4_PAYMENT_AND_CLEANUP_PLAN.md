# Phase 4 Plan: PromptPay QR, SlipOK Verification & Mock Cleanup

> เอกสารแผนงานสำหรับ **Phase 4** (ต่อจาก Phase 1–3 ที่เชื่อม Core Hooks, Book/Catalog, Cart, Orders, Chat Polling และ Seller Dashboard เข้ากับ Backend แล้ว)  
> จัดทำเมื่อ: 2026-11-14

---

## เป้าหมายของ Phase 4

1. เปลี่ยนระบบ QR ชำระเงินจากตาราง QR จำลอง (`src/lib/qr.ts`) เป็น **PromptPay QR จริง** ที่สร้างจาก Backend
2. เชื่อมระบบ **ตรวจสลิป (SlipOK / Real Topup & Order Payment Slip)** ทั้งฝั่งเติมเครดิตผู้ขายและฝั่งชำระค่าหนังสือแบบโอนเงิน (Transfer)
3. (ถ้าต้องการเปิดโหมดโอนเงินออนไลน์) เพิ่มทางเลือก `COD` vs `TRANSFER` ในหน้า Checkout (`/cart`) และหน้ารายละเอียดออเดอร์ (`/orders/[id]`)
4. ลบไฟล์จำลองที่ไม่ได้ใช้งานจริงออก (`frontend/src/mocks/*`, `frontend/src/lib/qr.ts` หรือแยกเฉพาะ `formatTHB` ออกมา) และจัดการหน้า Dev/Showcase ให้ปลอดภัยสำหรับ Production

---

## สถานะปัจจุบันหลังจบ Phase 3

### สิ่งที่ Backend มีพร้อมแล้ว
| Endpoint / Service | ไฟล์อ้างอิง | รายละเอียด |
| :--- | :--- | :--- |
| `GET /api/users/me/topup-qr` | [users.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/users.ts) | รับ `?pack_id=starter\|bookworm\|merchant` หรือ `?amount=20\|50\|100` คืน `{ pack_id, credits, amount, recipient_label, qr_data_url, payload }` |
| `POST /api/users/me/topup-slip` | [users.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/users.ts), [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts) | รับ `{ slip_image_url, transRef?, amount?, senderName? }` บันทึก `CREDIT_TOPUP`, เพิ่มเครดิต และตั้ง `is_verified_seller = true` *(หมายเหตุ: ปัจจุบัน `processTopupSlip` ยังใช้ Default/Mock Verifier เมื่อไม่ได้ส่ง `slipVerifier` เข้าไป)* |
| `GET /api/orders/:id/payment-qr` | [orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts) | ใช้กับออเดอร์ `DELIVERY` + `TRANSFER` + `ACCEPTED` คืน `{ order_id, amount, recipient_label, qr_data_url, payload }` จาก `seller.promptpayId` |
| `POST /api/orders/:id/payment-slip` | [orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts) | รับ `{ slip_image_url, trans_ref, amount, receiver_name }` ตรวจ Anti-Replay / ยอด / ชื่อผู้รับ แล้วเปลี่ยนสถานะออเดอร์เป็น `PAID` *(หมายเหตุ: ปัจจุบันตรวจจากค่าที่ส่งใน body ยังไม่ได้เรียก SlipOK API โดยตรง)* |
| `generatePromptPayQR` | [promptPayService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/promptPayService.ts) | สร้าง EMVCo payload + Base64 PNG Data URL |
| Env Vars | [env.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/config/env.ts) | มี schema รองรับ `SLIPOK_API_KEY`, `SLIPOK_BRANCH_ID`, `PLATFORM_PROMPTPAY_ID` แล้ว |

### สิ่งที่ Frontend ยังค้างไว้สำหรับ Phase 4
| ไฟล์ | สถานะปัจจุบัน |
| :--- | :--- |
| [QrPayCard.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/QrPayCard.tsx) | ใช้ `buildQrCells` จาก `src/lib/qr.ts` วาด SVG QR จำลอง (ยังไม่มี prop `qrDataUrl?: string`) |
| [seller/credits/pay/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/credits/pay/page.tsx) | ใช้ `setTimeout(..., 1600)` จำลองตรวจสลิป แล้วเรียก `submitTopUp()` ใน memory ของ `useSeller` |
| [seller/credits/success/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/credits/success/page.tsx) | มีปุ่ม `"อัปเดตสถานะ (จำลองการอนุมัติ)"` ที่เรียก `approveTopUp()` ใน memory |
| [useSeller.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useSeller.tsx) | `submitTopUp` และ `approveTopUp` ยังเป็น client-only state ยังไม่ได้ยิง `POST /api/users/me/topup-slip` และ refetch เครดิตจริง |
| [design-system/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/design-system/page.tsx), [V4Showcase.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/V4Showcase.tsx) | เป็น 2 ไฟล์สุดท้ายที่ยัง import `@/mocks/books` และ `@/mocks/v4` |

---

## ขั้นตอนการดำเนินงาน Phase 4 (Step-by-Step)

### Step 4.1 — เชื่อม SlipOK API จริงฝั่ง Backend (Security & Verification)
1. **สร้าง `backend/src/services/slipokService.ts`:**
   - อ่าน `env.SLIPOK_API_KEY` และ `env.SLIPOK_BRANCH_ID`
   - เรียก SlipOK API (`https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`) โดยส่งรูปสลิป (`url: slipImageUrl` หรือ `data: qrData`) พร้อม `log: true` และ `amount`
   - Parse ผลลัพธ์มาตรฐาน `{ transRef, amount, senderName, receiverName, sendingBank, receivingBank, transDate }`
   - รองรับโหมด dev fallback เฉพาะเมื่อไม่มี `SLIPOK_API_KEY` ใน non-production (พร้อม log แจ้งเตือนชัดเจน)
2. **ผูกเข้ากับ Topup & Order Payment:**
   - ใน `backend/src/routes/users.ts` (`POST /api/users/me/topup-slip`): ส่ง `slipokVerifier` เข้าเป็น parameter `slipVerifier` ของ `processTopupSlip(...)` พร้อมตรวจยอดขั้นต่ำ/ชื่อบัญชีผู้รับ (`PLATFORM_PROMPTPAY_ID` / ชื่อบัญชีกองดอง)
   - ใน `backend/src/services/orderService.ts` (`verifyOrderPaymentSlip`): หากเปิดใช้งาน SlipOK ให้ verify จากไฟล์สลิปจริงฝั่ง server แทนการเชื่อค่า `amount` / `trans_ref` ที่ส่งมาจาก Frontend เพียงอย่างเดียว
3. **ตั้งค่า `.env` ฝั่ง Backend:**
   - ใส่ `PLATFORM_PROMPTPAY_ID` (เบอร์พร้อมเพย์/เลขบัตร/Tax ID ของแพลตฟอร์มสำหรับรับค่าเติมเครดิต)
   - ใส่ `SLIPOK_API_KEY` และ `SLIPOK_BRANCH_ID` จากหลังบ้าน SlipOK

---

### Step 4.2 — อัปเกรด `QrPayCard` ให้แสดง QR จริงจาก Backend
* ไฟล์: [QrPayCard.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/QrPayCard.tsx)
* **สิ่งที่ต้องแก้:**
  1. เพิ่ม prop `qrDataUrl?: string` และ `errorMessage?: string`
  2. ถ้ามี `qrDataUrl` ให้เรนเดอร์ `<img src={qrDataUrl} alt="PromptPay QR" />` แทน `<svg>` จำลอง
  3. ลบคำเตือน `"คิวอาร์ตัวอย่างสำหรับเดโม · ไม่ใช่ข้อมูลพร้อมเพย์จริง"` เมื่อกำลังแสดง `qrDataUrl` จริง
  4. ย้าย `formatTHB` ไปไว้ใน `src/lib/format.ts` หรือ `src/lib/delivery.ts` เพื่อลดการพึ่งพา `src/lib/qr.ts`

---

### Step 4.3 — เชื่อม Flow เติมเครดิตผู้ขาย (`GET /topup-qr` + `POST /topup-slip`)
1. **[useSeller.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useSeller.tsx):**
   - เพิ่มฟังก์ชัน `fetchTopupQr(packId: string)` เรียก `GET /api/users/me/topup-qr?pack_id=${packId}`
   - แก้ `submitTopUp` ให้เป็น `async` เรียก `POST /api/users/me/topup-slip` โดยส่ง `{ slip_image_url, pack_id, amount }` (หลังอัปโหลดรูปผ่าน `SlipUploader` -> `POST /api/upload` bucket `slips` แล้ว)
   - เมื่อสำเร็จให้เรียก `await Promise.all([refreshUser(), refreshSellerData()])` เพื่ออัปเดต `credits`, `isVerifiedSeller` และ `ledger` จริงจาก Backend ทันที
2. **[seller/credits/pay/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/credits/pay/page.tsx):**
   - โหลด QR จริงจาก `fetchTopupQr(pkg.id)` ใน `useEffect` (แสดง loading state ระหว่างโหลด)
   - ส่ง `qrDataUrl` และ `recipientLabel` ที่ได้จาก API เข้า `<QrPayCard />`
   - ลบ `setTimeout(..., 1600)` ออก เปลี่ยนเป็น `await submitTopUp(...)` จริงและจัดการ error state (`SLIP_DUPLICATE`, `INVALID_AMOUNT`, ฯลฯ) ให้แสดงข้อความที่ผู้ใช้แก้ไข/แนบสลิปใหม่ได้
3. **[seller/credits/success/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/credits/success/page.tsx):**
   - ลบปุ่ม `"อัปเดตสถานะ (จำลองการอนุมัติ)"` และ `approveTopUp` ออก แสดงสถานะจริงหลังระบบตรวจสลิปและเติมเครดิตสำเร็จ (หรือสถานะรอตรวจสอบหากใช้โหมด manual review)

---

### Step 4.4 — เชื่อม Flow โอนเงินค่าหนังสือ (`TRANSFER`) และตรวจสอบ `PromptPay ID` ผู้ขาย *(Optional ตาม Decision ว่าจะเปิดคู่กับ COD หรือไม่)*
1. **ตั้งค่า PromptPay ID ผู้ขาย:**
   - เพิ่มช่องกรอก `promptpay_id` (และบันทึกลง `PATCH /api/users/me`) ใน [seller/setup/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/setup/page.tsx) หากต้องการให้ผู้ขายรับชำระแบบโอนตรงได้
2. **เลือกวิธีชำระเงินใน [cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx):**
   - เพิ่มตัวเลือก `COD` (เก็บเงินปลายทาง) vs `TRANSFER` (โอนพร้อมเพย์หลังผู้ขายรับออเดอร์) สำหรับจัดส่งพัสดุ (เฉพาะร้านที่ตั้งค่า PromptPay + ยืนยันตัวตนแล้ว)
3. **หน้าชำระเงินออเดอร์ใน [orders/[id]/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/page.tsx):**
   - เมื่อออเดอร์เป็น `DELIVERY` + `paymentMethod === 'TRANSFER'` + `status === 'ACCEPTED'`:
     - ผู้ซื้อเรียก `GET /api/orders/:id/payment-qr` แสดง `<QrPayCard qrDataUrl={...} />` + `<SlipUploader />`
     - เมื่อกดส่ง เรียก `POST /api/orders/:id/payment-slip` แล้วรีเฟรชออเดอร์เป็นสถานะ `PAID`
   - อัปเดต [mappers.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/mappers.ts) และ `V4Order` type ให้เก็บ `paymentMethod?: 'COD' | 'TRANSFER'` และ `promptpayId?: string | null`

---

### Step 4.5 — เก็บกวาด Mock Files & Production Guard
1. **ตรวจสอบ Showcase / Dev Pages:**
   - ย้ายข้อมูลตัวอย่างเฉพาะของ Showcase เข้าไว้ใน [V4Showcase.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/V4Showcase.tsx) / [design-system/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/design-system/page.tsx) หรือปรับ `/design-system`, `/debug`, `/line-preview` ให้เข้าถึงได้เฉพาะ `NODE_ENV !== 'production'`
2. **ลบไฟล์ Mock เดิมทั้งหมดใน `frontend/src/mocks/`:**
   - `frontend/src/mocks/books.ts`
   - `frontend/src/mocks/shops.ts`
   - `frontend/src/mocks/seller.ts`
   - `frontend/src/mocks/v4.ts`
   - *(เช็ก `frontend/src/lib/qr.ts` และ `frontend/src/lib/lineAssets.ts` ด้วยว่าไม่มีไฟล์ไหนใช้งานแล้วจึงลบออก)*
3. **ตรวจสอบคำสั่ง Verification สุดท้าย:**
   - ค้นหา `mocks/` ทั่วทั้ง `frontend/src/` ต้องไม่เหลือ import ใดๆ
   - รัน `npm run lint` (`tsc --noEmit`) และ `npm run build` (`next build --webpack`) ใน `frontend/` ต้องผ่านโดยไม่มี error
   - รันเทสต์ฝั่ง `backend/` (`npm test`) หลังเพิ่ม `slipokService.ts` เพื่อให้มั่นใจว่าเทสต์เดิมและเทสต์ใหม่ผ่านทั้งหมด
