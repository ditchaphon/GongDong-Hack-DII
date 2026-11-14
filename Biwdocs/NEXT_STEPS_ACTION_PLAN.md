# แผนปฏิบัติการและคำแนะนำขั้นตอนถัดไป (Next Steps Action Plan)
## กองดอง (GongDong) — C2C Second-hand Book Marketplace on LINE LIFF

> **วันที่จัดทำ:** 12 พฤศจิกายน 2569  
> **เป้าหมาย:** สรุปแนวทางดำเนินงานที่ชัดเจน เพื่อให้ทีมพัฒนาและนำเสนอผลงานได้ทันตามกำหนดการ Hackathon  
> **ผู้ร่วมจัดทำ:** ทีมพัฒนากองดอง (Biw - Backend, Frame - Frontend, Ditchaphon - PM)

---

## 1. ภาพรวมสถานะปัจจุบันของระบบ (Current System Baseline)

ปัจจุบันระบบกองดองทั้งสองฝั่งมีความพร้อมสูงมากในระดับรากฐาน:

| ส่วนงาน | สถานะความพร้อม | รายละเอียดสิ่งที่เสร็จสมบูรณ์แล้ว |
|---|:---:|---|
| **Backend API** | 🟢 **90%** | • Core Business Logic ครบถ้วน (Grading 4 ระดับ, PromptPay QR, Data Masking, Review System)<br>• Order State Machine (ACID Transactions, Handover Code, Anti-replay Slip)<br>• ชุดทดสอบ Vitest ผ่านครบ **117/117 Tests (10 Test Suites)**<br>• มี Seed Data จำลอง 4 ผู้ใช้, 6 เล่มหนังสือ, 26 รูปภาพใน `prisma/seed.ts` |
| **Frontend UI (LIFF)** | 🟢 **97.2%** | • หน้าจอครบถ้วนตาม User Flow v4 ทั้งฝั่งผู้ซื้อ (B1–B6) และผู้ขาย (S1–S5)<br>• เชื่อมต่อแผนที่จริง **Leaflet + OpenStreetMap** รองรับการปักหมุดและดึง GPS อัตโนมัติ<br>• มีปุ่มลัด **"เปิดนำทางใน Google Maps"** และ **"คัดลอกพิกัด"** ให้ผู้ซื้อใช้งานทันที<br>• ปรับปรุงปุ่มแจ้งเทนัดล็อกเวลา 15 นาที และปุ่มแจ้งปัญหา/รีวิวเด่นชัด<br>• Production Build ผ่าน 100% (`npm run build` ผ่านครบทั้ง 31 หน้า) |
| **เอกสารระบบ (Docs)** | 🟢 **100%** | • [docs/FRONTEND_UI_AUDIT_V4.md](file:///D:/Project/GongDong-Hack-DII/docs/FRONTEND_UI_AUDIT_V4.md): รายงานประเมินหน้าจอละเอียดทุก Flow<br>• [docs/API.md](file:///D:/Project/GongDong-Hack-DII/docs/API.md): สัญญา API Contract ฉบับสมบูรณ์<br>• [docs/DATABASE_ERD.md](file:///D:/Project/GongDong-Hack-DII/docs/DATABASE_ERD.md): ผังฐานข้อมูล PostgreSQL 9 ตาราง<br>• [Backend-doc/TECH_STACK.md](file:///D:/Project/GongDong-Hack-DII/Backend-doc/TECH_STACK.md): สถาปัตยกรรมและเครื่องมือของโครงการ |

---

## 2. ขั้นตอนที่ 1: Deploy Frontend ขึ้น Vercel ทันที (Day 1 - Quick Win)

**เหตุผล:** เพื่อให้ได้ **HTTPS URL จริง** สำหรับนำไปผูกใน LINE Developers Console ทันที ทำให้ทีมและกรรมการสามารถเปิดทดสอบเล่นบนแอป LINE ในมือถือจริงได้ตั้งแต่คืนนี้

### ขั้นตอนการทำ:
1. นำโฟลเดอร์ `frontend/` เชื่อมต่อเข้ากับ [Vercel](https://vercel.com/):
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
2. ตั้งค่า Environment Variables ใน Vercel:
   ```env
   NEXT_PUBLIC_LIFF_ID=2000000000-xxxxxxxx  # นำมาจาก LINE Developers
   NEXT_PUBLIC_LIFF_MOCK=true              # เปิดโหมดจำลองเพื่อให้เปิดเล่นใน Browser ได้ทุกที่
   NEXT_PUBLIC_LINE_OA_ID=848xkfsj          # Basic ID ของ LINE OA
   NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>.vercel.app
   ```
3. เมื่อ Deploy สำเร็จ จะได้ URL เช่น `https://gongdong-app.vercel.app`
4. เข้าไปที่ **LINE Developers Console** ➔ เลือก Channel LINE Login ➔ แท็บ **LIFF**:
   - นำ URL ของ Vercel ไปใส่ในช่อง **Endpoint URL**
5. คัดลอก **LIFF URL** (`https://liff.line.me/{LIFF_ID}`) ส่งเข้าห้องแชท LINE เพื่อเปิดเล่นบนมือถือจริงได้ทันที

---

## 3. ขั้นตอนที่ 2: เตรียม Backend และฐานข้อมูลให้พร้อมสมบูรณ์ (Day 2 - Morning)

ก่อนที่จะเริ่มเชื่อมต่อ API เข้ากับ Frontend ต้องเตรียมสภาพแวดล้อมหลังบ้านให้พร้อมรับข้อมูลจริง:

1. **เชื่อมต่อฐานข้อมูล Supabase จริง:**
   - นำ Connection String จริงจาก Supabase Dashboard มาใส่ใน `backend/.env`:
     ```env
     DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require"
     DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require"
     ```
2. **รัน Migration และ Seed Data:**
   ```bash
   cd backend
   npm run prisma:push    # สร้างตารางจริง 9 ตารางบน Supabase
   npm run prisma:seed    # หยอดข้อมูลผู้ใช้และหนังสือทดสอบเข้าฐานข้อมูล
   ```
3. **พัฒนา File Upload API (`POST /api/upload`):**
   - ติดตั้ง Multer ใน Backend: `npm install multer @types/multer`
   - เขียน Route รับไฟล์รูปภาพแล้วอัปโหลดขึ้น **Supabase Storage**:
     - ถัง `book-listings` (Public) สำหรับรูปหนังสือ 4 ด้าน
     - ถัง `avatars` (Public) สำหรับรูปโปรไฟล์
     - ถัง `slips` (**Private Bucket**) สำหรับรูปสลิปโอนเงิน (เข้าถึงผ่าน Signed URL อายุสั้น)
4. **Deploy Backend ขึ้น Cloud:**
   - Deploy ขึ้น **Render** หรือ **Railway** เพื่อให้ได้ HTTPS Base URL สำหรับ API

---

## 4. ขั้นตอนที่ 3: แผนเชื่อมต่อ Frontend ↔ Backend (Incremental Integration)

แนะนำให้ทยอยเชื่อมต่อทีละโมดูลตามลำดับความสำคัญ (ไม่ควรเชื่อมพร้อมกันหมดในคราวเดียว เพื่อป้องกันบั๊กกระทบหน้าจอเดโม):

```mermaid
flowchart LR
    M1["Sprint 1<br>Auth & Users"] --> M2["Sprint 2<br>Marketplace Feed"]
    M2 --> M3["Sprint 3<br>Book Listing"]
    M3 --> M4["Sprint 4<br>Order Lifecycle"]
    M4 --> M5["Sprint 5<br>Payments & Slip"]
```

| ลำดับ Sprint | หน้าจอ Frontend | API Endpoint หลังบ้าน | สิ่งที่ทำ |
|:---:|---|---|---|
| **Sprint 1** | `/setup`<br>`/onboarding` | `GET /api/users/me`<br>`PATCH /api/users/profile` | เมื่อผู้ใช้เปิด LIFF ให้ส่ง Token ไปยืนยันตัวตน และบันทึกชื่อเล่น/รูป Avatar เข้าระบบจริง |
| **Sprint 2** | `/`<br>`/book/[id]` | `GET /api/books`<br>`GET /api/books/:id` | เปลี่ยนหน้าแรกและหน้ารายละเอียดหนังสือจาก Mock Data มาดึงหนังสือจริงจาก Supabase |
| **Sprint 3** | `/seller/list` | `GET /api/books/isbn/:isbn`<br>`POST /api/books` | สแกน ISBN ดึงข้อมูลหนังสืออัตโนมัติ และอัปโหลดรูป 4 ด้านขึ้น Supabase Storage พร้อมให้ Backend ตัดเกรด |
| **Sprint 4** | `/cart`<br>`/orders` | `POST /api/orders`<br>`POST /api/orders/:id/accept` | ส่งคำขอซื้อจริง และให้ผู้ขายกดรับออเดอร์เพื่อหัก 1 เครดิตในฐานข้อมูล |
| **Sprint 5** | `/orders/[id]/pay`<br>`/orders/[id]/handover` | `GET /api/orders/:id/payment-qr`<br>`POST /api/orders/:id/verify-slip`<br>`POST /api/orders/:id/handover` | แสดง QR พร้อมเพย์ผู้ขายจริง, ตรวจสลิปด้วย SlipOK, และปิดการขายด้วยรหัส 6 หลัก |

---

## 5. ขั้นตอนที่ 4: กลยุทธ์การนำเสนอและพิตช์ (Pitching Day Strategy)

ในวันพิตช์ (18 พ.ย. 2569) เวลาการนำเสนอมีจำกัด ควรเตรียมความพร้อมตาม Checklist นี้:

1. **เตรียมเครื่องสาธิต 2 เครื่อง (Live Dual-Device Demo):**
   - **เครื่องที่ 1 (ผู้ซื้อ):** แสดงการเข้า LINE OA ➔ กด Rich Menu ➔ หาหนังสือ ➔ สั่งซื้อแบบนัดรับ ➔ โชว์รหัส 6 หลัก
   - **เครื่องที่ 2 (ผู้ขาย):** แสดงการได้รับแจ้งเตือนใน LINE ➔ กดใช้ 1 เครดิตรับออเดอร์ ➔ นัดพบด้วยแผนที่ ➔ กรอกรหัส 6 หลักเพื่อปิดงาน
2. **เตรียมวิดีโอเดโมสำรอง (Backup Demo Video):**
   - อัดคลิปหน้าจอมือถือความยาว 1.5–2 นาที แสดง Flow การซื้อขายจนจบแบบ 100% เผื่อกรณีเน็ตในห้องพิตช์มีปัญหา
3. **เน้นย้ำจุดเด่น 3 ข้อต่อหน้าคณะกรรมการ:**
   - **Zero-Cost Architecture:** ใช้ Supabase Free + OpenStreetMap + Vercel ไม่มีต้นทุนคงที่
   - **Zero Contact Leak:** ไม่ปล่อยให้คนหลุดไปคุยข้างนอก ทุกอย่างจบในระบบ
   - **Frictionless KYC:** คนขายลงขายได้ทันที แล้วค่อยดึงชื่อยืนยันจากสลิปตอนมีออเดอร์แรก
