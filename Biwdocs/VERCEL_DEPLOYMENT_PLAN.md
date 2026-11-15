# แผนขั้นตอนการ Deploy ระบบ GongDong (Backend + Frontend) ลง Vercel

> **โครงสร้างที่เลือก:** แยก **2 Vercel Projects** จาก GitHub Repo เดียวกัน (`Root Directory: backend` และ `Root Directory: frontend`)  
> **การสื่อสาร:** Frontend ใช้ **Single-Origin Next.js Proxy** (`NEXT_PUBLIC_USE_API_PROXY=true` + `BACKEND_INTERNAL_URL`) และ **LINE Webhook** ยิงตรงเข้า Backend (`https://<backend>.vercel.app/api/webhooks/line`)  
> **บริการภายนอก:** Supabase (PostgreSQL + Storage 5 Buckets), SlipOK Production API, LINE Login (LIFF) + Messaging API

---

## 1. ภาพรวมสถาปัตยกรรมบน Vercel

```mermaid
flowchart LR
    User["LINE App (LIFF WebView) / Browser"] -->|"HTTPS"| FE["Vercel Project 1: Frontend (Next.js 16)<br/>Root: frontend"]
    FE -->|"/api/auth/line (App Router)"| BE["Vercel Project 2: Backend (Express)<br/>Root: backend"]
    FE -->|"Rewrites /api/* (afterFiles)<br/>BACKEND_INTERNAL_URL"| BE
    LINE["LINE Platform (Webhook)"] -->|"HTTPS POST /api/webhooks/line<br/>(ยิงตรงเพื่อรักษา Raw Body Signature)"| BE
    BE -->|"Prisma (pgbouncer=true :6543)"| PG["Supabase PostgreSQL"]
    BE -->|"Upload & Signed URLs (5 Buckets)"| Storage["Supabase Storage"]
    BE -->|"Verify Slip"| SlipOK["SlipOK API"]
    BE -->|"Push / Reply Flex Card & Verify ID Token"| LINE
```

### เหตุผลที่ออกแบบโครงสร้างนี้
1. **Frontend Proxy (`/api/*`):** ลดปัญหา CORS และ Mixed Content ใน LIFF WebView โดย Browser ยิงหาโดเมน Frontend เดียวกัน แล้ว Next.js ส่งต่อไปที่ `BACKEND_INTERNAL_URL` ตาม [next.config.ts](file:///D:/Project/GongDong-Hack-DII/frontend/next.config.ts#L7-L14) และ [api.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/api.ts#L42-L49)
2. **LINE Webhook ยิงตรงเข้า Backend:** Endpoint `/api/webhooks/line` ใน [webhooks.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/webhooks.ts#L13-L29) ต้องใช้ `express.raw({ type: 'application/json' })` เพื่อตรวจ `x-line-signature` จาก Raw Body การชี้ LINE Webhook ตรงไปที่ Backend Vercel ช่วยลดความเสี่ยงที่ Proxy จะแปลง body และลด latency

---

## 2. การเตรียมโค้ดใน Repo ก่อน Deploy (ดำเนินการให้แล้ว)

ไฟล์ที่ปรับให้รองรับ Vercel Serverless Runtime แล้ว:
- [backend/src/index.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/index.ts#L68-L80): Guard `app.listen()` ด้วย `if (!process.env.VERCEL)` เพื่อไม่ให้เปิดพอร์ตค้างบน Vercel Serverless (Vercel ใช้ Zero-Config Express ผ่าน `export default app` ใน `src/index.ts`) โดยยังรัน local / Docker ได้ตามปกติ
- [backend/src/config/prisma.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/config/prisma.ts#L8-L15): เก็บ `global.prisma = prisma` ทั้งใน `development` และ `production` เพื่อ reuse connection pool ระหว่าง warm lambda invocations
- [backend/package.json](file:///D:/Project/GongDong-Hack-DII/backend/package.json#L6-L10): เพิ่ม `"postinstall": "prisma generate"` และปรับ `"build": "prisma generate && tsc"` เพื่อให้ Vercel สร้าง Prisma Client สำหรับ Linux runtime ทุกครั้งที่ install/build
- [frontend/.env.example](file:///D:/Project/GongDong-Hack-DII/frontend/.env.example): เพิ่มตัวอย่างตัวแปร `NEXT_PUBLIC_USE_API_PROXY` และ `BACKEND_INTERNAL_URL`

> **หมายเหตุ:** ไม่สร้าง `backend/vercel.json` ที่กำหนด `"builds"` แบบ legacy เพราะจะไปปิดโหมด Express Zero-Config / Fluid Compute ของ Vercel (ให้ตั้งค่า `Root Directory` ใน Vercel Dashboard แทน)

---

## 3. Step 0 — เตรียม Supabase Database & Storage (ก่อน Deploy)

แม้จะมี Supabase Project และ 5 Buckets (`book-listings`, `avatars`, `order-receives`, `slips`, `disputes`) อยู่แล้ว ให้ตรวจสอบ 3 จุดนี้ก่อนนำค่าไปใส่ใน Vercel:

1. **แยก Connection String 2 เส้นสำหรับ Prisma ([schema.prisma](file:///D:/Project/GongDong-Hack-DII/backend/prisma/schema.prisma#L11-L15)):**
   - **`DATABASE_URL` (Transaction Pooler — Port `6543`):** ใช้สำหรับรันแอปบน Vercel Serverless **ต้องต่อท้าย `?pgbouncer=true&connection_limit=1`** เพื่อป้องกัน connection pool เต็มเวลา Serverless Scale
     ```text
     postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
   - **`DIRECT_URL` (Direct / Session Connection — Port `5432`):** ใช้สำหรับสั่ง `prisma db push` / migrate
     ```text
     postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
     ```
2. **Push Schema ขึ้น Supabase Production DB (รันจากเครื่อง Local ครั้งแรกหรือเมื่อแก้ schema):**
   ```powershell
   cd D:\Project\GongDong-Hack-DII\backend
   # ตั้งค่า DATABASE_URL และ DIRECT_URL ใน .env ชี้ไป Supabase Production ชั่วคราว หรือส่งผ่าน shell
   npx prisma db push
   # (Optional) ถ้าต้องการ seed ข้อมูลตั้งต้น:
   # npm run prisma:seed
   ```
3. **ตรวจสิทธิ์ Buckets ใน Supabase Storage:**
   - Public Buckets (3): `book-listings`, `avatars`, `order-receives` (เปิด Public Read)
   - Private Buckets (2): `slips`, `disputes` (ปิด Public Read — Backend จะออก Signed URL ผ่าน `SUPABASE_SERVICE_ROLE_KEY`)

---

## 4. Step 1 — Deploy Backend Project บน Vercel

> **ต้อง Deploy Backend ก่อน Frontend** เพื่อนำ URL ของ Backend ไปใส่ใน `BACKEND_INTERNAL_URL` ของ Frontend

1. เข้า [Vercel Dashboard](https://vercel.com) ➔ **Add New...** ➔ **Project** ➔ เลือก GitHub Repo `GongDong-Hack-DII`
2. ตั้งค่าโปรเจกต์ Backend:
   - **Project Name:** เช่น `gongdong-backend`
   - **Root Directory:** คลิก Edit แล้วเลือก `backend`
   - **Framework Preset:** `Express` (หากระบบตรวจเจออัตโนมัติ) หรือ `Other`
   - **Build Command:** ปล่อย Default (`npm run build` ซึ่งรัน `prisma generate && tsc`) หรือ `Override` เป็น `prisma generate && tsc`
   - **Install Command:** ปล่อย Default (`npm install` ซึ่งจะรัน `postinstall: prisma generate`)
3. ใส่ **Environment Variables** (เลือก Scope: `Production`, และ `Preview` ถ้าต้องการทดสอบ Preview):

| Variable | ตัวอย่างค่า / แหล่งที่มา | หมายเหตุ |
|---|---|---|
| `NODE_ENV` | `production` | Vercel ตั้งให้อัตโนมัติ (ใส่ซ้ำได้) — ทำให้ [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L307) และ [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1330) บังคับ SlipOK จริง |
| `FRONTEND_URL` | `https://gongdong-frontend.vercel.app` | ใส่ค่าคาดการณ์ก่อน แล้วกลับมาอัปเดต+Redeploy หลัง Deploy Frontend เสร็จ |
| `DATABASE_URL` | `postgresql://...?pgbouncer=true&connection_limit=1` | Transaction Pooler (:6543) จาก Supabase |
| `DIRECT_URL` | `postgresql://...:5432/postgres?sslmode=require` | Direct Connection (:5432) จาก Supabase |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | Project URL จาก Supabase |
| `SUPABASE_ANON_KEY` | `eyJ...` | (Optional) Anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **จำเป็น** สำหรับอัปโหลดไฟล์และสร้าง Signed URL |
| `LINE_CHANNEL_ACCESS_TOKEN` | `<long-lived-token>` | Messaging API Channel Access Token |
| `LINE_CHANNEL_SECRET` | `<channel-secret>` | Messaging API Channel Secret (ตรวจ Webhook signature) |
| `LINE_LOGIN_CHANNEL_ID` | `200xxxxxxx` | Channel ID ของ LINE Login (LIFF) |
| `LINE_LIFF_CHANNEL_ID` | `200xxxxxxx` | ใส่ค่าเดียวกับ `LINE_LOGIN_CHANNEL_ID` |
| `LINE_LIFF_ID` | `200xxxxxxx-xxxxxxxx` | ใช้สร้าง Deep Link `https://liff.line.me/<id>/...` ใน Flex Card ([lineNotifyService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/lineNotifyService.ts#L132-L137)) |
| `SLIPOK_API_KEY` | `<slipok-api-key>` | **จำเป็นใน Production** |
| `SLIPOK_BRANCH_ID` | `<slipok-branch-id>` | **จำเป็นใน Production** |
| `PLATFORM_PROMPTPAY_ID` | `08xxxxxxxx` หรือ Tax ID | เลขพร้อมเพย์บัญชีกลางสำหรับรับค่าเติมเครดิต |
| `PLATFORM_RECIPIENT_NAME` | `กองดอง · บัญชีรับชำระ` | ชื่อบัญชีที่แสดงใต้ QR |
| `KYC_HASH_PEPPER` | `<random-hex-64-chars>` | สุ่มค่าปลอดภัยและห้ามเปลี่ยนหลังมีผู้ใช้ KYC แล้ว |
| `BLACKLISTSELLER_API_KEY` | `<your-blacklistseller-api-key>` | **จำเป็นใน Production** สำหรับตรวจเลขบัตรประชาชนใน `POST /api/seller/kyc` |
| `BLACKLISTSELLER_API_URL` | `https://api.blacklistseller.com/api/v1/queries/idcard-summary/` | (Optional) ใช้ค่า default ในโค้ดได้ |

4. กด **Deploy** แล้วรอจนได้ Production Domain เช่น `https://gongdong-backend.vercel.app`
5. **ตรวจสอบทันที:** เปิด `https://<backend>.vercel.app/api/health` ต้องได้ JSON:
   ```json
   { "success": true, "data": { "status": "healthy", ... } }
   ```
   > ⚠️ **สำคัญ:** ใน Backend Project Settings ➔ **Deployment Protection** ตรวจสอบให้แน่ใจว่า **Vercel Authentication ไม่ได้บล็อก Public Traffic ของ Production** มิฉะนั้น LINE Webhook และ Frontend Proxy จะติด `401 Unauthorized`

---

## 5. Step 2 — Deploy Frontend Project บน Vercel

1. กลับไป [Vercel Dashboard](https://vercel.com) ➔ **Add New...** ➔ **Project** ➔ เลือก GitHub Repo `GongDong-Hack-DII` อีกครั้ง
2. ตั้งค่าโปรเจกต์ Frontend:
   - **Project Name:** เช่น `gongdong-frontend`
   - **Root Directory:** คลิก Edit แล้วเลือก `frontend`
   - **Framework Preset:** `Next.js` (ตรวจจับอัตโนมัติ)
   - **Build Command:** ปล่อย Default (`npm run build` ซึ่งรัน `next build --webpack`)
3. **ตั้งค่า Environment Variables ให้ครบ *ก่อน* กด Deploy:**
   > ⚠️ **ข้อควรรู้สำคัญ:** `NEXT_PUBLIC_*` และ `BACKEND_INTERNAL_URL` ใน [next.config.ts](file:///D:/Project/GongDong-Hack-DII/frontend/next.config.ts#L7-L14) ถูกอ่าน **ตอน Build Time** (รวมเข้า `.next/routes-manifest.json` และ client bundle) หากเพิ่มหรือเปลี่ยนค่าภายหลัง **ต้องกด Redeploy Frontend ใหม่ทุกครั้ง**

| Variable | ค่าที่ต้องใส่ | หมายเหตุ |
|---|---|---|
| `NEXT_PUBLIC_LIFF_ID` | `200xxxxxxx-xxxxxxxx` | LIFF ID จาก LINE Developers |
| `NEXT_PUBLIC_LIFF_MOCK` | `false` | **ต้องเป็น `false`** เพื่อใช้ LINE จริง |
| `NEXT_PUBLIC_LINE_OA_ID` | `xxxxxxx` | Basic ID ของ LINE OA (ไม่ต้องใส่ `@`) |
| `NEXT_PUBLIC_APP_URL` | `https://gongdong-frontend.vercel.app` | URL จริงของ Frontend (ถ้ายังไม่มี ให้ใส่คาดการณ์ก่อน แล้วแก้+Redeploy หลังได้โดเมน) |
| `NEXT_PUBLIC_USE_API_PROXY` | `true` | บังคับให้ [api.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/api.ts#L45) ยิง same-origin `/api/*` |
| `NEXT_PUBLIC_API_URL` | *(เว้นว่าง หรือไม่ต้องใส่)* | ป้องกัน client ยิงตรงออกนอก proxy |
| `BACKEND_INTERNAL_URL` | `https://gongdong-backend.vercel.app` | **URL ของ Backend Vercel (ห้ามมี `/` ต่อท้าย)** ใช้ทั้ง `next.config.ts` rewrites และ [api/auth/line/route.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/api/auth/line/route.ts#L65-L69) |
| `LINE_CHANNEL_SECRET` | `<channel-secret>` | Server-only |
| `LINE_CHANNEL_ACCESS_TOKEN` | `<long-lived-token>` | Server-only |

4. กด **Deploy** แล้วจด Production Domain ที่ได้ เช่น `https://gongdong-frontend.vercel.app`

---

## 6. Step 3 — ซิงก์ค่า Domain กลับไปที่ Backend & LINE Developers

### 6.1 อัปเดต Backend `FRONTEND_URL`
1. เข้า **Backend Vercel Project** ➔ **Settings** ➔ **Environment Variables**
2. แก้ `FRONTEND_URL` ให้ตรงกับ Production Domain ของ Frontend แบบเป๊ะ ๆ (เช่น `https://gongdong-frontend.vercel.app` ไม่มี `/` ต่อท้าย)
3. เข้าแท็บ **Deployments** ➔ จุดสามจุดบน deployment ล่าสุด ➔ **Redeploy** (เพื่อให้ CORS และ fallback link อัปเดต)
*(หาก `NEXT_PUBLIC_APP_URL` ของ Frontend ที่ใส่ไว้ตอนแรกไม่ตรงกับโดเมนจริงที่ Vercel ออกให้ ให้แก้ใน Frontend Env Vars แล้ว **Redeploy Frontend** ด้วย)*

### 6.2 ตั้งค่า LINE Developers Console
> ตรวจสอบว่า **LINE Login Channel** และ **Messaging API Channel** อยู่ภายใต้ **Provider เดียวกัน** มิฉะนั้น `userId` จาก LIFF จะไม่ตรงกับ `userId` สำหรับส่ง Push Message

1. **LINE Login Channel (แท็บ LIFF):**
   - **Endpoint URL:** `https://<frontend>.vercel.app/`
   - **Size:** `Full`
   - **Scopes:** `profile`, `openid`
   - **Bot link feature:** `On (Aggressive)`
   - **แท็บ LINE Login ➔ Callback URL:** เพิ่ม `https://<frontend>.vercel.app/` (รองรับกรณีเปิดบน Browser นอก LINE App)
2. **Messaging API Channel (แท็บ Messaging API):**
   - **Webhook URL:** `https://<backend>.vercel.app/api/webhooks/line` *(ชี้ตรงไป Backend)*
   - เปิด **Use webhook** = `ON` ➔ กด **Verify** ➔ ต้องขึ้น **Success**
   - (แนะนำ) ปิด **Auto-reply messages** ใน LINE OA Manager เพื่อให้ Backend ตอบ event `follow` เอง

---

## 7. Step 4 — Post-Deploy Verification Checklist

ทดสอบตามลำดับหลัง Deploy ครบทั้งคู่:

1. **Backend Health & Direct Proxy:**
   - เปิด `https://<backend>.vercel.app/api/health` ➔ ได้ `200 OK`
   - เปิด `https://<frontend>.vercel.app/api/health` ➔ ต้องถูก Next.js proxy ไปยัง Backend และได้ `200 OK` เช่นเดียวกัน
2. **LINE Webhook:**
   - กด **Verify** ใน LINE Developers Console ➔ `Success`
   - ลอง Add Friend / Unblock LINE OA ➔ ต้องได้รับข้อความต้อนรับจาก Backend (`handleLineWebhookEvents`)
3. **LIFF Auth & Database Sync:**
   - เปิดลิงก์ `https://liff.line.me/<NEXT_PUBLIC_LIFF_ID>` ในแอป LINE บนมือถือ
   - ตรวจ Network ใน `/api/auth/line` ➔ ต้องได้ `200 OK` และบันทึก/ดึงข้อมูลผู้ใช้จาก Supabase PostgreSQL สำเร็จ
4. **Supabase Storage Upload (Vercel 4.5 MB Limit):**
   - ทดลองอัปโหลดรูปหนังสือ (`/seller/list`) ➔ Frontend บีบอัดเป็น WebP (~100–350 KB) ผ่าน [imageCompression.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/imageCompression.ts#L28-L45) ก่อนส่ง จึงไม่ชนเพดาน 4.5 MB ของ Vercel Serverless Function และรูปขึ้นจาก `*.supabase.co` จริง
5. **SlipOK Production Verification:**
   - ทดลองเติมเครดิตผู้ขาย (`/seller/credits/pay`) ด้วยสลิปโอนเงินจริง ➔ ตรวจว่า SlipOK API ยืนยันสำเร็จและกันสลิปซ้ำได้
6. **LINE Flex Notification & Deep Link:**
   - ทดสอบสั่งซื้อและกดรับออเดอร์ ➔ ผู้ซื้อได้รับ Flex Card ในแชท LINE OA และแตะปุ่ม *"ดูรายละเอียดคำสั่งซื้อ"* แล้วเปิดหน้า `/orders/[id]` ภายใน LIFF WebView ได้ทันที

---

## 8. ข้อควรระวังเฉพาะ Vercel Serverless

- **Vercel Request Body Limit (4.5 MB):** [uploadService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/uploadService.ts#L23) ตั้ง `MAX_UPLOAD_BYTES = 5 MB` แต่ Vercel Functions จำกัด payload สูงสุด **4.5 MB** (หากรูปไหนบีบอัดฝั่ง client ไม่ผ่านแล้ว fallback เกิน 4.5 MB จะโดน Vercel คืน `413 FUNCTION_PAYLOAD_TOO_LARGE` ก่อนถึง Express)
- **Serverless Function Timeout:** แผน Free (Hobby) มี timeout สูงสุด 10–60 วินาที (ขึ้นกับการตั้งค่า Fluid Compute) — การเรียก SlipOK + Supabase Upload ควรเร็วกว่าปกติ ไม่มีปัญหา
- **In-memory State ไม่คงอยู่ข้าม Instance:** ห้ามเก็บ session, cron job หรือ cache สำคัญไว้ใน memory ของ Express (ปัจจุบัน state สำคัญทั้งหมดเก็บใน Supabase PostgreSQL + Supabase Storage แล้ว จึงรองรับ Serverless ได้)
- **Vercel Preview Branches:** หากเปิด Preview Deployment บน Branch อื่น `BACKEND_INTERNAL_URL` จะยังชี้ไป Production Backend ตามค่าใน Env Vars และต้องระวังอย่าให้ Preview URL ไปเขียนข้อมูลปนกับ Production DB ถ้ายังใช้ `DATABASE_URL` เดียวกัน
