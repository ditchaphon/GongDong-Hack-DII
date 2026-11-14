# คู่มือ Manual Test ระบบ GongDong (กองดอง) — Localhost E2E Checklist

> คู่มือทดสอบการใช้งานทั้งระบบบนเครื่องพัฒนา (`localhost:3000` + `localhost:8000` + โหมด Mock LIFF)  
> ครอบคลุม **Happy Path, Edge/Negative Cases, Validation, Contact Masking, Chat Polling (8 วินาที)** พร้อมคำสั่ง **PowerShell** จำลองอีกฝั่ง (ผู้ขาย/ผู้ซื้อคนที่ 2) และระบุขอบเขตส่วนที่ยกยอดไป **Phase 4**  
> อัปเดตล่าสุด: 2026-11-14

---

## ส่วนที่ 0: การเตรียมสภาพแวดล้อมก่อนทดสอบ (Pre-flight Setup)

### 0.1 ตั้งค่า Environment & รัน Backend (`D:\Project\GongDong-Hack-DII\backend`)
1. ตรวจสอบไฟล์ `backend/.env` ว่ามีค่า `DATABASE_URL` (และ `DIRECT_URL` ถ้าต่อ Supabase PostgreSQL) รวมถึง `FRONTEND_URL="http://localhost:3000"` และ `NODE_ENV="development"`
2. รันคำสั่งใน PowerShell:
```powershell
cd D:\Project\GongDong-Hack-DII\backend
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
```
3. ตรวจสอบ Health Check (เปิดในเบราว์เซอร์หรือ PowerShell):
```powershell
Invoke-RestMethod "http://localhost:8000/api/health"
```
**Expected:** ได้ HTTP `200` และ JSON `{ success: true, ... }`  
*(หมายเหตุ: ถ้า `NODE_ENV=development` และยังไม่ได้ตั้ง `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` ฟังก์ชันอัปโหลดรูป `POST /api/upload` จะคืน URL จำลอง `https://mock-storage.gongdong.local/...` แทน)*

---

### 0.2 ตั้งค่า Environment & รัน Frontend (`D:\Project\GongDong-Hack-DII\frontend`)
1. ตรวจสอบไฟล์ `frontend/.env.local` ให้มีค่าสำหรับทดสอบในเครื่อง:
```env
NEXT_PUBLIC_LIFF_MOCK=true
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_LINE_OA_ID=848xkfsj
```
2. รันเซิร์ฟเวอร์ Frontend:
```powershell
cd D:\Project\GongDong-Hack-DII\frontend
npm run dev
```
3. เปิดเบราว์เซอร์ไปที่ `http://localhost:3000/debug`
   - **Expected:** เห็นสถานะ `LIFF Ready`, `isMock: true`, และ User `usr_mock_01` ที่ถูก auto-create ใน DB (ได้ `1` เครดิตเริ่มต้น)

---

### 0.3 บัญชีจำลองจาก Seed สำหรับทดสอบ 2 ฝั่ง (Buyer <-> Seller)
ในโหมด Mock LIFF (`NEXT_PUBLIC_LIFF_MOCK=true`) หน้าเว็บจะล็อกอินเป็น **`usr_mock_01`** ตลอดเวลา ส่วนบัญชีจาก [seed.ts](file:///D:/Project/GongDong-Hack-DII/backend/prisma/seed.ts) ที่ใช้จำลองอีกฝั่งผ่าน PowerShell มีดังนี้:

| บทบาทจำลอง | ชื่อในระบบ | Token Header (`Authorization`) | ข้อมูลที่มีใน Seed |
| :--- | :--- | :--- | :--- |
| **ผู้ขายคนที่ 1 (นนท์)** | `ร้านนนท์ กองดอง` | `Bearer mock_U_LINE_NONT_001` | 9 เครดิต, ยืนยันตัวตนแล้ว, นัดรับ มช. + ส่งพัสดุ, มีประกาศ เช่น `f1a10001-...` (Atomic Habits ฿220), `f1a10002-...` |
| **ผู้ขายคนที่ 2 (มายด์)** | `มายด์บุ๊คส์ มช.` | `Bearer mock_U_LINE_MIND_002` | 3 เครดิต, ยืนยันตัวตนแล้ว, นัดรับ + ส่งพัสดุ, มีประกาศ `f1a10003-...` |
| **ผู้ซื้อจำลอง (กานต์)** | `กานต์` | `Bearer mock_U_LINE_KARN_003` | ใช้สวมรอยเป็นผู้ซื้อมากดขอซื้อหนังสือที่คุณลงขายเองในส่วนที่ 6 |

---

## ส่วนที่ 1: โปรไฟล์, Validation & Contact Masking

| รหัส | กรณีทดสอบ | ขั้นตอนการทำ | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC-1.1** | ตั้งโปรไฟล์ไม่ผ่าน Validation (Negative) | 1. เปิด `/setup`<br>2. กรอกชื่อเล่น 1 ตัวอักษร (เช่น `ก`) -> กดบันทึก<br>3. ลองกรอกชื่อที่มีเบอร์โทร/LINE (เช่น `บิว 0812345678` หรือ `line: biw123`) -> กดบันทึก<br>4. ลองกรอกชื่อปกติแต่ **ไม่ติ๊ก** ยอมรับ PDPA -> กดบันทึก | • แต่ละเคสต้องขึ้นข้อความ Error ภาษาไทยชัดเจนและไม่ส่ง API<br>• กรณีเบอร์/LINE ต้องถูก `findContactLeaks` บล็อกห้ามบันทึก |
| **TC-1.2** | ตั้งโปรไฟล์สำเร็จและค้างข้ามการรีเฟรช | 1. เปิด `/setup` กรอกชื่อเล่น (เช่น `นักอ่าน มช.`), เลือก Avatar, ติ๊กยอมรับ PDPA -> กดบันทึก<br>2. รอ redirect แล้วกด `F5` รีเฟรชหน้า `/profile` | • Toast "บันทึกโปรไฟล์แล้ว"<br>• รีเฟรชหน้าแล้วยังเห็นชื่อเล่นและรูปที่ตั้งไว้ (ดึงจาก `GET /api/users/me`) และสถานะ PDPA ค้างอยู่ |
| **TC-1.3** | ตรวจสอบหน้าช่วยเหลือ & Onboarding | เปิด `/onboarding` และ `/help` ผ่านเมนูใน `/profile` หรือ `...` ที่ Header หน้าแรก | • แสดงเนื้อหาครบ ไม่ขึ้น 404 หรือ Console Error |

---

## ส่วนที่ 2: Discovery, Search, Book Detail & Public Shop

| รหัส | กรณีทดสอบ | ขั้นตอนการทำ | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC-2.1** | หน้าแรกโหลดข้อมูลจริงจาก Backend | 1. เปิด `/` สังเกตแบนเนอร์แนะนำด้านบนและ Grid หนังสือด้านล่าง<br>2. ลองกด Chip ตัวกรอง (`ทั้งหมด`, `นัดรับ มช. ฿0`, `ส่งพัสดุ`, `พัฒนาตนเอง`, `การ์ตูนยกชุด`) | • แสดงรายการหนังสือจาก DB (`GET /api/books` & `GET /api/books/recommended`) ไม่มีคำว่า `MOCK_BOOKS` ค้าง<br>• จำนวนเล่มที่พบเปลี่ยนตามตัวกรอง<br>• *(Negative)* ลองปิด Backend ชั่วคราวแล้วรีเฟรช `/` -> ต้องขึ้น EmptyState "โหลดรายการหนังสือไม่สำเร็จ" พร้อมปุ่ม "ลองใหม่" (ไม่ fallback เป็น mock) |
| **TC-2.2** | ค้นหาและตัวกรองหลายเงื่อนไข | 1. เปิด `/search`<br>2. พิมพ์คำค้นหา เช่น `Atomic`, `Clean`, หรือเลข ISBN `9786161829029`<br>3. ลองกดเลือก **โซนนัดรับ**, **งบประมาณ**, **เกรด (A/B/C/D)**, **เล่มเดียว/ยกชุด**, **นัดรับ/พัสดุ**<br>4. ลองพิมพ์คำที่ไม่มีในระบบ เช่น `zzzznotfound` | • รายการอัปเดตตาม API + client filters (debounce ~250ms)<br>• กรณีไม่พบข้อมูล ต้องแสดง EmptyState "ไม่พบหนังสือที่ตรงกับเงื่อนไข" |
| **TC-2.3** | รายละเอียดหนังสือ & 404 | 1. กดเข้าหนังสือ 1 เล่มจาก `/` (ไป `/book/[id]`)<br>2. กดดูรูป Gallery, กดปุ่มเกณฑ์เกรด 4 ระดับ, กดแชร์ลิงก์<br>3. ลองเข้า URL มั่ว `/book/00000000-0000-0000-0000-000000000000` | • เห็นรูปครบ, Checklist ตำหนิ 5 ข้อตรงกับ Backend (`conditionAnswers`), ชื่อร้าน, จุดนัดรับ, ปุ่มใส่ตะกร้า/ส่งคำขอซื้อ<br>• ลิงก์ที่ไม่มีอยู่จริง ต้องแสดง EmptyState "ไม่พบหนังสือเล่มนี้" พร้อมปุ่มกลับหน้าหลัก |
| **TC-2.4** | หน้าร้านค้าสาธารณะ | 1. จาก `/book/[id]` กดการ์ดร้านค้าเพื่อเปิด `/seller/[sellerId]`<br>2. ลองกดปุ่ม "รายงานร้านนี้" และลองเปิด `/seller/00000000-0000-0000-0000-000000000000` | • เห็น badge ยืนยันตัวตน, จำนวนขาย, จุดนัดรับ, รายการหนังสือของร้าน และรีวิวจากผู้ซื้อ (`GET /api/users/:id/reviews`)<br>• รหัสร้านมั่วต้องขึ้น "ไม่พบร้านค้านี้" |

---

## ส่วนที่ 3: ที่อยู่จัดส่ง, ตะกร้าสินค้า และกฎ 1 ร้านต่อ 1 คำขอ

| รหัส | กรณีทดสอบ | ขั้นตอนการทำ | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC-3.1** | CRUD ที่อยู่จัดส่ง | 1. เปิด `/addresses` -> กด "เพิ่มที่อยู่จัดส่งใหม่" (`/addresses/edit`)<br>2. *(Negative)* เว้นชื่อผู้รับหรือรายละเอียดว่าง -> กดบันทึก<br>3. กรอกให้ครบ เลือกจังหวัด เช่น `เชียงใหม่` และกดบันทึก<br>4. กลับมาที่ `/addresses` กดเพิ่มอีก 1 ที่อยู่ (เช่น `กรุงเทพมหานคร`)<br>5. กดแก้ไข 1 รายการ, ทดลองตั้งค่าเริ่มต้น, และทดลองลบ 1 รายการ | • เคสกรอกไม่ครบต้องเตือนและไม่บันทึก<br>• สร้าง/แก้/ตั้งเริ่มต้น/ลบ ทำงานจริงกับ `/api/users/me/addresses` และรีเฟรชหน้าแล้วยังอยู่ครบ |
| **TC-3.2** | กฎ 1 ร้านต่อ 1 ตะกร้า & ป้องกันเล่มซ้ำ | 1. เปิดหนังสือของ **ร้านนนท์** -> กด `ใส่ตะกร้า` -> กดซ้ำอีกครั้ง<br>2. ไปเปิดหนังสือของ **มายด์บุ๊คส์ มช.** -> กด `ใส่ตะกร้า` | • กดซ้ำเล่มเดิมขึ้น Sheet แจ้งมีอยู่ในตะกร้าแล้ว (ไม่ซ้ำ)<br>• กดต่างร้านต้องขึ้น Sheet `OTHER_SHOP` ถามยืนยันว่าจะล้างตะกร้าเดิมเพื่อเปลี่ยนเป็นร้านใหม่หรือไม่ |
| **TC-3.3** | ตะกร้า — กรณีไม่มีที่อยู่ตอนเลือกส่งพัสดุ (Negative) | 1. ลบที่อยู่ทั้งหมดใน `/addresses` ออกชั่วคราว (หรือเช็กตอนยังไม่มี)<br>2. เปิด `/cart` แล้วสลับเป็นวิธีรับ `ส่งพัสดุ` | • ช่องที่อยู่แสดงกล่องเส้นประ "ยังไม่มีที่อยู่จัดส่ง" ลิงก์ไป `/addresses/edit?next=/cart`<br>• ปุ่ม `ส่งคำขอซื้อ` ต้องถูก Disable จนกว่าจะมีที่อยู่ |

---

## ส่วนที่ 4: Flow ออเดอร์แบบ "นัดรับ (MEETUP + COD)" + Chat Polling + Edge Cases

> **เตรียมตัว:** เพิ่มหนังสือที่เปิดนัดรับของ **ร้านนนท์** (`f1a10001-1111-4000-8000-000000000001`) ลงตะกร้า

| รหัส | กรณีทดสอบ | ขั้นตอนการทำ | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC-4.1** | ส่งคำขอซื้อนัดรับ (Buyer UI) | 1. ใน `/cart` เลือก `นัดรับ`, เลือกจุดนัดรับของร้านนนท์, วันที่, ช่วงเวลา -> กด `ส่งคำขอซื้อ`<br>2. ตรวจหน้า `/cart/success?id=...` แล้วกด `ดูสถานะออเดอร์` | • ได้ Order ID จริง, ตะกร้าถูกล้าง, พาไป `/orders/<orderId>`<br>• สถานะเป็น `REQUESTED`, ช่องแชทยังล็อก (ยังไม่เปิดจนกว่าผู้ขายจะรับ), พิกัด/จุดนัดยังไม่โชว์จนกว่าจะรับคำขอ<br>• **จด `<ORDER_ID>` ไว้ใช้ต่อ** |
| **TC-4.2** | ผู้ซื้อกดยกเลิกก่อนผู้ขายรับ (Optional Test) | สร้างออเดอร์ทดสอบอีก 1 รายการ -> เข้า `/orders/<tempId>` -> กด `ยกเลิกคำขอนี้` | • สถานะเปลี่ยนเป็น `CANCELLED`, หนังสือกลับมาค้นเจอ/ซื้อได้ตามปกติ |
| **TC-4.3** | ผู้ขายกดรับคำขอ (PowerShell จำลองร้านนนท์) | รันคำสั่งใน PowerShell (เปลี่ยน `<ORDER_ID>`):<br>`Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/orders/<ORDER_ID>/accept" -Headers @{ Authorization = "Bearer mock_U_LINE_NONT_001" }` | • Backend ตัด 1 เครดิตของร้านนนท์และเปลี่ยนสถานะออเดอร์เป็น `SCHEDULED` (สำหรับ Pickup) |
| **TC-4.4** | แชทในออเดอร์ & Real-time Polling 8 วินาที | 1. เปิดหน้า `/orders/<ORDER_ID>` ทิ้งไว้ (หลัง TC-4.3)<br>2. พิมพ์ข้อความจากฝั่งผู้ซื้อในหน้าเว็บ (เช่น `สวัสดีครับ เจอกันตามจุดนัดนะครับ`) -> ส่ง<br>3. **ไม่กดรีเฟรชหน้า** ให้รัน PowerShell ส่งข้อความจากฝั่งร้านนนท์:<br>`Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/orders/<ORDER_ID>/messages" -Headers @{ Authorization = "Bearer mock_U_LINE_NONT_001"; "Content-Type" = "application/json" } -Body '{"text":"รับทราบครับ เจอกันหน้าหอสมุดนะ"}'`<br>4. รอไม่เกิน **8–10 วินาที** บนหน้าเว็บ | • ข้อความของผู้ซื้อขึ้นทันที<br>• ภายใน ~8 วินาที ข้อความจากร้านนนท์ต้องเด้งขึ้นมาเองในแชทโดยไม่ต้องรีเฟรชหน้า |
| **TC-4.5** | ปิดการขายนัดรับ (Meetup Complete) & รีวิว | 1. รัน PowerShell ให้ร้านนนท์ยืนยันส่งมอบ:<br>`Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/orders/<ORDER_ID>/complete-meetup" -Headers @{ Authorization = "Bearer mock_U_LINE_NONT_001" }`<br>2. รีเฟรช `/orders/<ORDER_ID>` บนหน้าเว็บ -> กด `ให้คะแนนและรีวิว` (`/orders/<ORDER_ID>/review`)<br>3. ให้ดาว 5 ดาว, เลือก `✓ ตรงเกรด`, ติ๊ก Tag, พิมพ์คอมเมนต์ -> กดส่ง | • สถานะเปลี่ยนเป็น `COMPLETED`<br>• ส่งรีวิวแล้วหน้า `/orders/<ORDER_ID>` แสดงบล็อกรีวิว และหน้าสาธารณะร้านนนท์ (`/seller/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`) ต้องแสดงรีวิวใหม่นี้ |
| **TC-4.6** | เคสผู้ซื้อไม่มาตามนัด (No-Show) & คำชี้แจง | 1. สร้างออเดอร์นัดรับใหม่อีก 1 รายการ ให้ร้านนนท์ `accept` เป็น `SCHEDULED`<br>2. แจ้ง No-Show จากฝั่งร้านนนท์:<br>`Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/orders/<ORDER_ID_2>/report-missed-meeting" -Headers @{ Authorization = "Bearer mock_U_LINE_NONT_001" }`<br>3. เปิด `/orders/<ORDER_ID_2>/no-show?role=buyer` บนหน้าเว็บ -> ลองส่งคำชี้แจง (`disputeMissedMeeting`) | • ระบบบันทึกรายงานและให้ผู้ซื้อส่งคำชี้แจงได้โดยไม่ error (ถ้ากรอกสั้นกว่า 5 ตัวอักษรต้องแจ้งเตือนก่อน) |

---

## ส่วนที่ 5: Flow ออเดอร์แบบ "ส่งพัสดุ (PARCEL + COD)"

> **เตรียมตัว:** มีที่อยู่จัดส่งอย่างน้อย 1 รายการใน `/addresses` และเลือกหนังสือที่รองรับ `ส่งพัสดุ` (เช่น ของร้านนนท์หรือร้านมายด์)

| รหัส | กรณีทดสอบ | ขั้นตอนการทำ | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC-5.1** | ส่งคำขอส่งพัสดุ & ตรวจค่าส่ง | 1. เข้า `/cart` เลือกวิธีรับ `ส่งพัสดุ`<br>2. ตรวจค่าส่ง (เช่น 1 เล่ม จังหวัดเดียวกัน vs ข้ามจังหวัด: `35` vs `35+15=50`, เพิ่มเล่มละ `+10`)<br>3. กด `ส่งคำขอซื้อ` -> จด `<PARCEL_ORDER_ID>` | • สร้างออเดอร์สำเร็จด้วย `payment_method: 'COD'`<br>• หน้า `/orders/<PARCEL_ORDER_ID>` สถานะเป็น `REQUESTED` |
| **TC-5.2** | ผู้ขายรับ + แจ้งเลขพัสดุ (PowerShell) | 1. ร้านรับออเดอร์:<br>`Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/orders/<PARCEL_ORDER_ID>/accept" -Headers @{ Authorization = "Bearer mock_U_LINE_NONT_001" }`<br>2. ร้านส่งเลขพัสดุ:<br>`Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/orders/<PARCEL_ORDER_ID>/ship" -Headers @{ Authorization = "Bearer mock_U_LINE_NONT_001"; "Content-Type" = "application/json" } -Body '{"courier_name":"Flash Express","tracking_number":"TH1234567890","parcel_image_url":"https://images.unsplash.com/photo-1589998059171-988d887df646?w=600"}'` | • ภายใน 8 วินาที (หรือรีเฟรช) หน้า `/orders/<PARCEL_ORDER_ID>` ต้องเปลี่ยนเป็น `SHIPPED` และแสดงชื่อขนส่ง + เลข Tracking + ปุ่มคัดลอก/เปิดเว็บติดตามพัสดุ |
| **TC-5.3** | ผู้ซื้อถ่ายรูปยืนยันรับของ & รีวิว | 1. บนหน้า `/orders/<PARCEL_ORDER_ID>` กด `ได้รับของแล้ว · ถ่ายรูปยืนยัน` (`/orders/<PARCEL_ORDER_ID>/receive`)<br>2. *(Negative)* ลองกดส่งโดยยังไม่แนบรูป / ยังไม่เลือกดาว / ยังไม่เลือกตรงเกรด<br>3. ถ่าย/เลือกรูป, ให้ดาว, เลือกตรงเกรด -> กดยืนยัน | • Validation กันไว้ครบถ้าข้อมูลขาด<br>• เมื่อส่งสำเร็จ สถานะเปลี่ยนเป็น `COMPLETED`, รูปยืนยันรับของและรีวิวแสดงบนหน้ารายละเอียดออเดอร์ |
| **TC-5.4** | แจ้งปัญหา / ข้อพิพาทในออเดอร์ | ระหว่างออเดอร์อยู่ในสถานะ `ACCEPTED` หรือ `SHIPPED` กดปุ่ม `แจ้งปัญหาออเดอร์นี้` เลือก 1 เหตุผล | • ออเดอร์เปลี่ยนสถานะเป็น `DISPUTED` และแสดงกล่องแจ้งเตือนแอดมินกำลังตรวจสอบ |

---

## ส่วนที่ 6: ฝั่งผู้ขาย (เปิดร้าน, KYC, ลงขาย, จัดการประกาศ & รายงานปัญหา)

> ส่วนนี้ทดสอบทั้งหมดผ่านบัญชี `usr_mock_01` บนหน้าเว็บได้เลย และใช้ PowerShell `mock_U_LINE_KARN_003` เพื่อสวมรอยเป็นผู้ซื้อมาขอซื้อหนังสือของเรา!

| รหัส | กรณีทดสอบ | ขั้นตอนการทำ | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC-6.1** | เปิดร้าน & ตรวจ KYC (Thai ID 13 หลัก) | 1. เข้า `/profile` สลับเป็น `โหมดผู้ขาย · เปิดร้าน` (ไป `/seller/setup`)<br>2. Step 2: ทดสอบใส่เบอร์โทร/LINE ในชื่อร้านหรือรายละเอียด -> กดถัดไป<br>3. กรอกข้อมูลร้านปกติ -> Step 3: ปักหมุด/ตั้งจุดนัดรับ, วัน-เวลา, เปิดรับส่งพัสดุ -> Step 4: **ลองใส่เลขบัตร 13 หลักปลอม** (เช่น `1111111111111`) -> กดถัดไป<br>4. ใส่เลขบัตรประชาชนที่ **ผ่าน Checksum 13 หลัก** + ชื่อ-นามสกุล + ติ๊กยินยอม -> กดยืนยันและเปิดร้าน | • Step 2 บล็อกเบอร์โทร/LINE<br>• Step 4 บล็อกเลขบัตรที่ Checksum ไม่ผ่าน<br>• เมื่อผ่าน พาไป `/seller`, รีเฟรชหน้าแล้วข้อมูลร้านและสถานะยืนยันตัวตนยังอยู่ครบ (ดึงจาก `GET /api/seller/shop`) |
| **TC-6.2** | ลงขายหนังสือครบ 5 ขั้น + ISBN Lookup + คำนวณเกรด | 1. ใน `/seller` กด `ลงขายหนังสือ` (`/seller/list`)<br>2. ทดสอบพิมพ์ ISBN ที่มีในระบบ เช่น `9786161829029` หรือสแกน ISBN เพื่อตรวจ Auto-fill แล้วลองกรอกหนังสือใหม่เอง 1 เล่ม (`/seller/list/details`)<br>3. Step 2 (`/seller/list/step-2`): แนบรูปให้ครบ 4 มุม (ปกหน้า, ปกหลัง, สัน, หน้าใน) + ลองเพิ่มรูปตำหนิ 1 รูป<br>4. Step 3 (`/seller/list/step-3`): ทดสอบติ๊ก `มีตำหนิ` 1–3 จุด สังเกตเกรดเปลี่ยน (A 75% / B 60% / C 45% / D 30%)<br>5. Step 4 (`/seller/list/step-4`): ตั้งราคา, เลือกวิธีรับ -> กด `ลงประกาศขาย` | • หาก ISBN มีข้อมูล ระบบดึงชื่อ/ผู้แต่ง/สำนักพิมพ์/ราคาปกมาให้ (และล็อกช่องที่ดึงได้)<br>• อัปโหลดรูปผ่าน `POST /api/upload` และบันทึกเข้า DB ผ่าน `POST /api/books` (เช็ก Condition Grading mapping กับ Backend ถูกต้อง)<br>• หนังสือใหม่แสดงในแท็บ `กำลังขาย` ของ `/seller` และค้นหาเจอใน `/` และ `/search` (**จด `<MY_BOOK_ID>` และ `<MY_SELLER_ID>` ไว้**) |
| **TC-6.3** | แก้ไข / ซ่อน / แสดงประกาศอีกครั้ง | 1. ใน `/seller` กด `แก้ไข` บนหนังสือที่ลงขาย -> เปลี่ยนราคา -> บันทึก<br>2. กด `ซ่อน` -> ตรวจว่าหายไปจาก `/` และ `/search` และย้ายไปอยู่หมวด `ซ่อนอยู่`<br>3. กด `แสดงอีกครั้ง` | • ราคาอัปเดตจริงใน DB (`PATCH /api/books/:id`)<br>• ตอนซ่อน ผู้ซื้อทั่วไปต้องค้นไม่เจอ; กดแสดงอีกครั้งกลับมาเจอ |
| **TC-6.4** | ทดสอบรับคำขอซื้อ & ปิดการขายใน UI ผู้ขาย | 1. รัน PowerShell ให้กานต์ (`mock_U_LINE_KARN_003`) ส่งคำขอซื้อหนังสือของคุณ (`<MY_BOOK_ID>`):<br>*(แทนที่ `<MY_SELLER_ID>` = `user.id` จาก `/debug` และ `<MY_BOOK_ID>`)*<br>`Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/orders" -Headers @{ Authorization = "Bearer mock_U_LINE_KARN_003"; "Content-Type" = "application/json" } -Body '{"seller_id":"<MY_SELLER_ID>","book_ids":["<MY_BOOK_ID>"],"shipping_method":"PICKUP","payment_method":"COD","pickup_location_name":"หน้าหอสมุดกลาง มช."}'`<br>2. เปิด `/seller` แท็บงานระหว่างทำ หรือ `/orders` (ในโหมดผู้ขาย) -> กดเข้าออเดอร์ -> ทดสอบกด **รับออเดอร์** (หัก 1 เครดิต), ส่งข้อความในแชท, หรือทดสอบ **ปฏิเสธ** กับอีกออเดอร์ | • มี Badge แจ้งเตือนงานใหม่ใน `/seller` และ `/orders`<br>• กดรับออเดอร์แล้วเครดิตลดลง 1 เครดิตจริง (`usr_mock_01` เหลือ 0 ถ้ามีแค่ 1) และแชทเปิดใช้งานได้<br>• ขณะมีออเดอร์ค้าง หนังสือเล่มนั้นต้องถูกล็อกปุ่มแก้ไข/ซ่อนใน `/seller/listings/[id]/edit` |
| **TC-6.5** | หน้า Seller Report (`/seller/report`) | 1. เปิด `/seller/report` (เข้าจากเมนูโหมดผู้ขายใน `/profile`)<br>2. เลือกออเดอร์, เลือกเหตุผล (ทดสอบทั้ง `ผู้ซื้อไม่มาตามนัด` บนออเดอร์นัดรับ และเหตุผลอื่น), กรอกคำอธิบาย >= 10 ตัวอักษร -> กดส่ง | • พาไป `/seller/report/sent` และสถานะออเดอร์ฝั่ง Backend ถูกบันทึกจริง (`reportMissedMeeting` หรือ `openDispute`) |

---

## ส่วนที่ 7: แจ้งเตือน, Wishlist & ขอบเขตที่ยกยอดไป Phase 4

| รหัส | กรณีทดสอบ | ขั้นตอนการทำ | ผลลัพธ์ที่คาดหวัง / หมายเหตุ |
| :--- | :--- | :--- | :--- |
| **TC-7.1** | ศูนย์แจ้งเตือน (`/notifications`) | 1. เปิด `/notifications` สลับแท็บ `ผู้ซื้อ` และ `ผู้ขาย`<br>2. กดอ่าน 1 รายการ และกด `อ่านทั้งหมด` | • ดึงข้อมูลจาก `GET /api/notifications?role=...`, จุดสีน้ำตาลหายเมื่ออ่าน (`PATCH .../read` / `read-all`) และคงอยู่หลังรีเฟรช |
| **TC-7.2** | Wishlist (`/wishlist`) — Stopgap | 1. เปิด `/wishlist` กด `+ ตามหาเล่มใหม่` เพิ่มรายการ, กดรีเฟรช, กดลบ | • บันทึกและลบผ่าน `localStorage` (`gongdong.wishlist.v1`) ได้ปกติ *(ยังไม่มี Backend Wishlist API)* |
| **TC-7.3** | หน้าเครดิต (`/seller/credits`) *(Partial Phase 3 / รอ Phase 4)* | เปิด `/seller/credits` ตรวจยอดเครดิตคงเหลือและตาราง `ประวัติเครดิต` | • แสดงยอดเครดิตจริง + ประวัติ `SIGNUP_BONUS` / `ACCEPT_ORDER` จาก `GET /api/users/me/credits/history`<br>• ⚠️ **หมายเหตุรอ Phase 4:** หน้า `/seller/credits/pay` (QR + ตรวจสลิป SlipOK) และ `/seller/credits/success` (อนุมัติจำลอง) รวมถึง Flow โอนเงินค่าหนังสือ `TRANSFER` **ยังเป็นตัวจำลองสำหรับ Phase 4** ยังไม่ต้องนำผลตรงจุดนี้มาตัดสินบั๊ก Phase 3 |

---

## ส่วนที่ 8: สรุปผลการทดสอบ (Manual Test Sign-off)

| ส่วนที่ทดสอบ | ผ่าน (Pass) | ไม่ผ่าน (Fail) | หมายเหตุ / Error ที่พบ |
| :--- | :---: | :---: | :--- |
| ส่วนที่ 0: Setup DB / Seed / Backend & Frontend | [ ] | [ ] | |
| ส่วนที่ 1: โปรไฟล์, Validation & Contact Masking | [ ] | [ ] | |
| ส่วนที่ 2: หน้าแรก, Search, Book Detail & Public Shop | [ ] | [ ] | |
| ส่วนที่ 3: ที่อยู่จัดส่ง, ตะกร้า & กฎ 1 ร้าน | [ ] | [ ] | |
| ส่วนที่ 4: Meetup Order, Chat Polling 8s, No-Show & Review | [ ] | [ ] | |
| ส่วนที่ 5: Parcel COD Order, Ship Tracking, Receive & Dispute | [ ] | [ ] | |
| ส่วนที่ 6: Seller Setup/KYC, List Book 5 Steps & Report | [ ] | [ ] | |
| ส่วนที่ 7: Notifications, Wishlist & Credit History | [ ] | [ ] | |
