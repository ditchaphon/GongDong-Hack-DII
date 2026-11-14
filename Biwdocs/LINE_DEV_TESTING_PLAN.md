# แผนเตรียมระบบ GongDong (กองดอง) เพื่อทดสอบบน LINE Developers (ไม่เชื่อม SlipOK API)

> **สถานะก่อนเริ่ม:** ระบบผ่านการแก้ไขช่องโหว่ระดับ Localhost ([LOCALHOST_FIXABLE_ISSUES_PLAN.md](file:///D:/Project/GongDong-Hack-DII/Biwdocs/LOCALHOST_FIXABLE_ISSUES_PLAN.md)) และ push Prisma Schema ลง PostgreSQL (`localhost:5434`) แล้ว  
> **เป้าหมายเอกสารนี้:** ทำให้เปิดใช้งานเว็บแอปผ่าน **LINE LIFF จริงบนมือถือ**, ใช้ **LINE ID Token จริง**, รับ-ส่ง **LINE OA Push Flex Message / Webhook**, และอัปโหลดรูปจริงบน **Supabase Storage** โดยยังคง **โหมดจำลองตรวจสลิปอัตโนมัติ (ยังไม่เชื่อม SlipOK API)**

---

## 1. ภาพรวมสถาปัตยกรรม (Single HTTPS Tunnel + Next.js API Proxy)

เนื่องจาก **LINE LIFF** และ **LINE Webhook** บังคับใช้ URL แบบ **HTTPS สาธารณะ** และมือถือที่เปิดผ่านแอป LINE ไม่สามารถเรียก `http://localhost:8000` ได้โดยตรง จึงใช้โครงสร้าง **Single HTTPS Tunnel** ชี้มาที่ Next.js (`:3000`) จุดเดียว:

```mermaid
flowchart LR
    Phone["LINE App (LIFF WebView บนมือถือ)"] -->|"HTTPS (cloudflared)"| Tunnel["HTTPS Tunnel (เช่น *.trycloudflare.com)"]
    LINE["LINE Platform (Webhook & OAuth)"] -->|"HTTPS POST /api/webhooks/line"| Tunnel
    Tunnel --> Next["Next.js Frontend (:3000) [NODE_ENV=development]"]
    Next -->|"/api/auth/line"| NextAuth["Next.js Route Handler"]
    Next -->|"Rewrites /api/* & /api/webhooks/*"| Express["Express Backend (:8000) [NODE_ENV=development]"]
    NextAuth -->|"BACKEND_INTERNAL_URL (127.0.0.1:8000)"| Express
    Express --> Postgres["Docker PostgreSQL (:5434)"]
    Express --> Supabase["Supabase Storage Dev (5 Buckets)"]
    Express -->|"Push / Reply Flex Message & Verify ID Token"| LINE
```

### สรุปข้อตกลงการออกแบบ (Design Decisions)
1. **Network & Tunnel:** รัน Frontend/Backend บนเครื่อง (`NODE_ENV=development`) + เปิด **1 HTTPS Tunnel (`cloudflared`)** ชี้มาที่ Next.js `:3000` และให้ Next.js Proxy `/api/*` ไปยัง Backend `:8000` (ยกเว้น `/api/auth/line` ที่ Next.js จัดการเอง)
2. **LINE Dev Scope:** เปิดทดสอบครบทั้ง **LIFF Login จริง (Auto-redirect `liff.login`) + Push Flex Message แจ้งเตือนออเดอร์ + LINE OA Webhook (`follow` + `x-line-signature` verify) + `shareTargetPicker`**
3. **No-SlipOK Behavior:** คงโหมด **Auto-Verify ทันทีใน Dev Mode** (แนบรูปสลิปใดก็ได้ใน `/seller/credits/pay` ➔ อนุมัติ `AUTO_VERIFIED` อัตโนมัติ, แสดงป้ายแจ้งว่า *"โหมดทดสอบ: ยังไม่เชื่อม SlipOK"*, และกันสลิปซ้ำด้วย `slipImageUrl`)
4. **Image Storage:** เชื่อม **Supabase Storage Dev Project** (5 Buckets) เพื่อให้มือถือใน LINE App แสดงรูปปกหนังสือ, รูปสลิป, รูปรับพัสดุ และ Re-sign Private URL ได้จริง
5. **Two-Role Testing:** ใช้ **2 บัญชี LINE จริง** (เพิ่ม Tester Roles ใน LINE Developers Console) คู่กับ **Dev Override Switcher ใน `/debug`** (เฉพาะ Dev Mode) เผื่อกรณีทดสอบคนเดียวบนคอมพิวเตอร์

---

## 2. สิ่งที่ต้องตั้งค่าบนบริการภายนอก (External Setup)

### 2.1 LINE Developers Console (สร้าง 2 Channels ภายใต้ **Provider เดียวกัน**)
> ⚠️ **สำคัญมาก:** `Messaging API Channel` และ `LINE Login Channel (LIFF)` **ต้องอยู่ภายใต้ Provider เดียวกัน** เพื่อให้ `userId` (`U...`) จาก LIFF ID Token ตรงกับ `userId` ที่ใช้ส่ง Push Message ผ่าน Messaging API

1. **Channel 1: LINE Login (สำหรับ LIFF App)**
   - สร้าง **LIFF App** ใหม่:
     - **Size:** `Full`
     - **Endpoint URL:** `https://<tunnel-domain>/` (ใส่ URL จาก `cloudflared` ทุกครั้งที่เปิด Tunnel ใหม่)
     - **Scopes:** ติ๊ก `profile`, `openid`
     - **Bot link feature:** `On (Aggressive)` (เพื่อเช็ก `liff.getFriendship()` และชวนเพิ่มเพื่อน LINE OA)
     - **Module mode / Scan QR:** เปิด `Scan QR` (หากต้องการทดสอบ `liff.scanCode()` สแกน ISBN ในอนาคต)
   - นำค่า **Channel ID** (เช่น `200xxxxxxx`) และ **LIFF ID** (`200xxxxxxx-xxxxxxxx`) มาเก็บไว้
   - **Roles / Testers:** หาก Channel ยังอยู่ในสถานะ `Developing` ให้เพิ่มอีเมลบัญชี LINE ของทีมทดสอบ 2 บัญชีในแท็บ **Roles**

2. **Channel 2: Messaging API (สำหรับ LINE OA & Push Notification)**
   - ออก **Channel access token (long-lived)** ➔ นำไปใส่ `LINE_CHANNEL_ACCESS_TOKEN`
   - คัดลอก **Channel secret** ➔ นำไปใส่ `LINE_CHANNEL_SECRET`
   - คัดลอก **Basic ID** ของ LINE OA (เช่น `@xxxxxxx` เอาเฉพาะชื่อหลัง `@`) ➔ นำไปใส่ `NEXT_PUBLIC_LINE_OA_ID`
   - ในแท็บ **Messaging API**:
     - ตั้ง **Webhook URL:** `https://<tunnel-domain>/api/webhooks/line`
     - เปิด **Use webhook:** `ON` และกด **Verify** (ต้องได้ `Success`)
     - ปิด **Auto-reply messages** ใน LINE OA Manager หากต้องการให้ Webhook ของ Backend ตอบกลับ `follow` event เอง

### 2.2 Supabase Storage Dev Project
สร้าง Project ฟรีบน Supabase แล้วสร้าง **5 Buckets** ให้ตรงกับ `ALLOWED_UPLOAD_BUCKETS` ใน [uploadService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/uploadService.ts#L6-L14):
- **Public Buckets (3):** `book-listings`, `avatars`, `order-receives`
- **Private Buckets (2):** `slips`, `disputes`
- นำ `Project URL`, `anon public key` และ `service_role secret key` มาใส่ใน [backend/.env](file:///D:/Project/GongDong-Hack-DII/backend/.env)

### 2.3 เปิด Single HTTPS Tunnel บนเครื่อง (แนะนำ `cloudflared`)
ใช้ Cloudflare Quick Tunnel (ไม่มีหน้า Interstitial Warning กวน LINE WebView และ Webhook):
```powershell
cloudflared tunnel --url http://localhost:3000
```
จะได้ URL เช่น `https://random-words-here.trycloudflare.com` (นำไปอัปเดตใน LIFF Endpoint URL, Messaging API Webhook URL และไฟล์ `.env`)

---

## 3. แผนแก้ไขโค้ด (แบ่ง 4 Phases)

### Phase 1: Single-Tunnel API Proxy & CORS Setup
| ลำดับ | ไฟล์เป้าหมาย | สิ่งที่ต้องแก้ไข |
|---|---|---|
| **1.1** | [next.config.ts](file:///D:/Project/GongDong-Hack-DII/frontend/next.config.ts) | เพิ่ม `async rewrites()` (`afterFiles`) ส่งต่อ `/api/:path*` ทั้งหมดไปยัง `${process.env.BACKEND_INTERNAL_URL \|\| 'http://127.0.0.1:8000'}/api/:path*` — การใช้ `afterFiles` ทำให้ App Router endpoint [api/auth/line/route.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/api/auth/line/route.ts) ทำงานก่อน ส่วน `/api/orders`, `/api/books`, `/api/users`, `/api/upload`, `/api/webhooks/line` ถูก forward ไป Express พร้อม Raw Body สำหรับ LINE Signature |
| **1.2** | [api.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/api.ts#L42-L46) | แก้ `getApiBaseUrl()` ให้รองรับ `NEXT_PUBLIC_USE_API_PROXY=true` (หรือเมื่อรันบนโดเมน HTTPS ที่ไม่ตั้ง `NEXT_PUBLIC_API_URL`) โดยคืน `""` (relative URL) เพื่อให้มือถือยิงไป `/api/...` บนโดเมน Tunnel เดียวกันโดยไม่ติด Mixed Content หรือ `localhost:8000` |
| **1.3** | [route.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/api/auth/line/route.ts#L65) | ใช้ `process.env.BACKEND_INTERNAL_URL \|\| process.env.NEXT_PUBLIC_API_URL \|\| 'http://127.0.0.1:8000'` เพื่อให้ Next.js server ยิง Express ภายในเครื่องได้ตรงๆ |
| **1.4** | [index.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/index.ts#L19-L24) | ตรวจสอบ CORS `origin` ให้รองรับ `env.FRONTEND_URL` (โดเมน HTTPS ของ Tunnel) รวมถึง `http://localhost:3000` |

### Phase 2: Real LIFF Login, Flex Message Deep-Link & LINE OA Webhook
| ลำดับ | ไฟล์เป้าหมาย | สิ่งที่ต้องแก้ไข |
|---|---|---|
| **2.1** | [auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L22) | อัปเดต `verifyLineToken` ให้เช็ก `channelId \|\| env.LINE_LIFF_CHANNEL_ID \|\| env.LINE_LOGIN_CHANNEL_ID \|\| process.env.LINE_CHANNEL_ID` ให้ตรงกับชื่อตัวแปรใน [env.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/config/env.ts#L24-L25) |
| **2.2** | [useLiff.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useLiff.tsx#L163-L220) | เมื่อ `!isMockEnv` และ `!liff.isLoggedIn()` ให้เรียก `liff.login({ redirectUri: window.location.href })` อัตโนมัติ (ใส่ `sessionStorage` loop-guard + เช็ก `?error=` เพื่อป้องกันการ redirect วนซ้ำหากผู้ใช้กด Cancel การอนุญาตสิทธิ์) และเก็บ `rawToken` ให้ `api.ts` ส่ง `Bearer <idToken>` ทุกคำขอ |
| **2.3** | [lineNotifyService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/lineNotifyService.ts#L130-L219) | 1. **LIFF Deep-Link ใน Flex Card:** ใน `notifyOrderEvent` หากมี `LINE_LIFF_ID` (หรือส่ง `NEXT_PUBLIC_LIFF_ID`) ให้ลิงก์ปุ่ม *"ดูรายละเอียดคำสั่งซื้อ"* ชี้ไปที่ `https://liff.line.me/${liffId}${linkPath}` เพื่อให้แตะจากแชท LINE แล้วเปิดใน LIFF WebView ทันที (fallback เป็น `env.FRONTEND_URL`)<br>2. **Webhook Deduplication:** กรอง `event.webhookEventId` ที่ประมวลผลแล้ว (ป้องกัน LINE Platform ยิง retry ซ้ำ)<br>3. รองรับ `event.type === 'follow'` (มีอยู่แล้ว) และ log/ignore `unfollow` อย่างปลอดภัย |
| **2.4** | [webhooks.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/webhooks.ts#L24-L29) | เพิ่ม Fail-Closed Guard: ถ้า `env.NODE_ENV === 'production'` และขาด `env.LINE_CHANNEL_SECRET` ให้คืน `503` (ส่วน Dev Mode จะตรวจสอบ Signature อัตโนมัติทันทีที่ใส่ `LINE_CHANNEL_SECRET` ใน `backend/.env`) |

### Phase 3: No-SlipOK Dev Mode & Duplicate Slip Guard
| ลำดับ | ไฟล์เป้าหมาย | สิ่งที่ต้องแก้ไข |
|---|---|---|
| **3.1** | [userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L300-L338) | คงการทำงานปัจจุบันไว้ (ทำงานถูกต้องแล้ว: เมื่อ `NODE_ENV !== 'production'` และไม่ตั้ง `SLIPOK_API_KEY` จะคำนวณราคาจาก `pack_id`, กัน `slipImageUrl` ซ้ำ และเติมเครดิตลง Postgres อัตโนมัติ) |
| **3.2** | [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1296-L1375) | ปรับ `verifyOrderPaymentSlip` ให้มี Guard สอดคล้องกับ `processTopupSlip`:<br>• ถ้า `NODE_ENV === 'production' && !env.SLIPOK_API_KEY` ให้โยน `503 SLIP_VERIFIER_NOT_CONFIGURED`<br>• ในโหมด Dev (No-SlipOK) ให้เช็กซ้ำด้วย `slipImageUrl` ด้วย (นอกเหนือจาก `transRef`) เพื่อกันส่งสลิปรูปเดิมซ้ำ |
| **3.3** | [seller/credits/pay/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/credits/pay/page.tsx) | เพิ่มแถบแจ้งเตือนชัดเจนในหน้าจ่ายเงินเมื่ออยู่ในโหมด Dev ไม่เชื่อม SlipOK (`"โหมดทดสอบ LINE Dev (ยังไม่เชื่อม SlipOK API): สลิปที่อัปโหลดจะได้รับการอนุมัติจำลองทันที"`) *(หมายเหตุ: ปัจจุบันคำสั่งซื้อส่งพัสดุฝั่งผู้ซื้อในหน้า `/orders/[id]` ใช้โหมด COD เก็บเงินปลายทาง จึงมีการอัปโหลดสลิปจริงอยู่ที่หน้าเติมเครดิตผู้ขายเป็นหลัก)* |

### Phase 4: Two-Role Testing Tools (`/debug` Dev Override Switcher)
| ลำดับ | ไฟล์เป้าหมาย | สิ่งที่ต้องแก้ไข |
|---|---|---|
| **4.1** | [useLiff.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useLiff.tsx) & [debug/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/debug/page.tsx) | เพิ่มฟังก์ชัน **Dev Role Override** (เปิดเฉพาะ `NODE_ENV !== 'production'`): เก็บ token แยกใน `sessionStorage` (เช่น `mock_usr_seller_dev` หรือ `mock_usr_buyer_dev`) เพื่อสลับบทบาททดสอบบนคอมพิวเตอร์คู่กับบัญชี LINE จริงบนมือถือได้ทันที และมีปุ่ม **"Clear Override (ใช้ LINE ID Token จริง)"** สำหรับกลับไปใช้สิทธิ์ LINE จริง |

---

## 4. Template ค่า Environment Variables สำหรับ LINE Dev (ไม่เชื่อม SlipOK)

### [backend/.env](file:///D:/Project/GongDong-Hack-DII/backend/.env)
```env
PORT=8000
NODE_ENV=development
FRONTEND_URL=https://<your-tunnel>.trycloudflare.com

# PostgreSQL (Docker gongdong-postgres)
DATABASE_URL="postgresql://gongdong:gongdong_dev@localhost:5434/gongdong?schema=public"
DIRECT_URL="postgresql://gongdong:gongdong_dev@localhost:5434/gongdong?schema=public"

# Supabase Storage Dev Project (สำหรับอัปโหลดรูปปก / สลิป / รับของ ให้มือถือเห็นจริง)
SUPABASE_URL="https://<your-project-ref>.supabase.co"
SUPABASE_ANON_KEY="<your-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# LINE Developers (Messaging API + LINE Login under same Provider)
LINE_CHANNEL_ACCESS_TOKEN="<messaging-api-long-lived-token>"
LINE_CHANNEL_SECRET="<messaging-api-channel-secret>"
LINE_LOGIN_CHANNEL_ID="<line-login-channel-id>"
LINE_LIFF_CHANNEL_ID="<line-login-channel-id>"
# (Optional สำหรับทำ Deep Link ใน Flex Card: เพิ่ม LINE_LIFF_ID ใน env.ts)
LINE_LIFF_ID="<your-liff-id>"

# SlipOK (เว้นว่างไว้เพื่อใช้ Dev Auto-Verify Mode)
SLIPOK_API_KEY=""
SLIPOK_BRANCH_ID=""

# Security Pepper (KYC Hash)
KYC_HASH_PEPPER="gongdong-line-dev-local-pepper"
```

### [frontend/.env.local](file:///D:/Project/GongDong-Hack-DII/frontend/.env.local)
```env
# --- LIFF (Real LINE Dev) ---
NEXT_PUBLIC_LIFF_ID=<your-liff-id>
NEXT_PUBLIC_LIFF_MOCK=false

# --- LINE Official Account ---
NEXT_PUBLIC_LINE_OA_ID=<oa-basic-id-without-at>

# --- App URL & Single-Tunnel API Proxy ---
NEXT_PUBLIC_APP_URL=https://<your-tunnel>.trycloudflare.com
NEXT_PUBLIC_USE_API_PROXY=true
NEXT_PUBLIC_API_URL=
BACKEND_INTERNAL_URL=http://127.0.0.1:8000

# --- LINE secrets (Server-only สำหรับ API Routes ถ้ามี) ---
LINE_CHANNEL_SECRET=<messaging-api-channel-secret>
LINE_CHANNEL_ACCESS_TOKEN=<messaging-api-long-lived-token>
```

---

## 5. Checklist การทดสอบ End-to-End บน LINE Dev

1. **ตรวจ Connectivity & Webhook:**
   - เปิด PostgreSQL (`localhost:5434`), Backend (`:8000`), Frontend (`:3000`) และ `cloudflared`
   - กด **Verify Webhook** ใน LINE Developers Console ➔ ได้ `200 OK`
   - ทดลองกด **Add Friend / Unblock LINE OA** ➔ ได้รับข้อความต้อนรับจาก Backend (`handleLineWebhookEvents`) และเห็น In-App Notification *"เชื่อมต่อ LINE OA สำเร็จ"*
2. **ตรวจ LIFF Auth & Profile Diagnostics:**
   - เปิดลิงก์ `https://liff.line.me/<your-liff-id>/debug` ในแชท LINE บนมือถือ
   - ยืนยันค่า: `LIFF Initialized: true`, `isInClient(): true`, `isLoggedIn(): true`, `Mock Mode` ปิดอยู่, และแสดง `lineUserId` จริง (ไม่ error 401/502 จาก Backend)
3. **ตรวจ Supabase Image Upload บนมือถือ:**
   - ถ่าย/เลือกรูปอัปโหลดใน `/seller/list` และเปิดดูจากเครื่องผู้ซื้อ ➔ รูปต้องขึ้นจริงจาก `*.supabase.co` (ไม่ใช่ `mock-storage.gongdong.local`)
4. **ตรวจ No-SlipOK Credit Top-Up:**
   - เข้า `/seller/credits` ➔ เลือกแพ็กเกจ ➔ หน้า `/seller/credits/pay` แสดง QR พร้อมแบนเนอร์โหมดทดสอบ ➔ แนบรูปสลิป ➔ เครดิตใน Postgres เพิ่มขึ้นจริง (และลองแนบสลิปเดิมซ้ำต้องถูกปฏิเสธ `DUPLICATE_SLIP`)
5. **ตรวจ Full 2-Role Order Flow + LINE Flex Push Notification:**
   - ใช้ **บัญชี LINE A** (มือถือ) กับ **บัญชี LINE B** (มือถืออีกเครื่อง หรือ Dev Role Switcher บนคอม)
   - ทดสอบสั่งซื้อ ➔ ผู้ขายกดรับออเดอร์ (หัก 1 เครดิต) ➔ **ตรวจแชท LINE OA ว่ามี Flex Card แจ้งเตือนเด้งเข้ามือถือผู้ซื้อ** ➔ แตะปุ่ม *"ดูรายละเอียดคำสั่งซื้อ"* ในแชท LINE แล้วเด้งเข้าหน้า `/orders/[id]` บน LIFF WebView ถูกต้อง
   - ทดสอบนัดรับ (กรอกรหัส Handover 6 หลัก) และส่งพัสดุ (COD `ACCEPTED` ➔ `PAID` ➔ `SHIPPED` ➔ `COMPLETED`) จนรีวิวสำเร็จ
   - ทดสอบปุ่ม **Share Target Picker** ในหน้า `/seller/list/success` เพื่อแชร์หนังสือเข้าแชทเพื่อนใน LINE

---

## 6. จุดที่ตั้งใจละไว้จนกว่าจะเชื่อม SlipOK / ขึ้น Production จริง
- **SlipOK Real API (`SLIPOK_API_KEY`):** การตรวจเลข `transRef` ของธนาคาร, ชื่อบัญชีผู้รับจริง, และยอดเงินจริงจาก QR สลิป จะยังไม่ถูกเรียกในแผนนี้ (ใช้ Dev Auto-Verify แทน)
- **Production Guards:** การถอด `/debug` Role Switcher และบังคับ `SLIPOK_API_KEY` + `LINE_CHANNEL_SECRET` แบบ fail-closed (`NODE_ENV=production`) จะทำงานเมื่อเปลี่ยน environment เป็น Production
