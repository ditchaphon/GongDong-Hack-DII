# Frontend · กองดอง (GongDong)

เว็บแอป LIFF ของกองดอง · **Next.js (App Router) + TypeScript + Tailwind CSS v4**
ออกแบบ mobile-first สำหรับเปิดใน LINE (กว้าง 390 × 844, max 430px)

สถานะ: **Phase 0–4 + 6–7 เสร็จ** — design system, buyer flow, seller flow, order engine,
LINE assets (spec only), QA pass ใช้งานได้ด้วย mock data
(Phase 5 admin ยังไม่ทำ — ข้ามตามคำขอ; Phase 8 go-live docs ยังไม่ทำ)

---

## วิธีรัน (How to run)

ต้องมี Node.js 20 ขึ้นไป และ npm

```bash
cd frontend
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
```

เปิดเบราว์เซอร์ที่ URL ที่ terminal แสดง (ปกติ `http://localhost:3000`
ถ้า port ไม่ว่าง Next.js จะเปลี่ยนให้อัตโนมัติ เช่น `http://localhost:13138`)

ค่าเริ่มต้นใน `.env.local` ใช้ **mock mode** (`NEXT_PUBLIC_LIFF_MOCK=true`)
แอปจึงรันในเบราว์เซอร์ปกติได้เลย ไม่ต้องมี LIFF ID และไม่ต้องล็อกอิน

### คำสั่งที่มี

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันโหมดพัฒนา (hot reload) |
| `npm run build` | build เวอร์ชันจริง ต้องผ่านก่อน deploy |
| `npm run start` | รันไฟล์ที่ build แล้ว |
| `npm run lint` | ตรวจ TypeScript (`tsc --noEmit`) |

### รันใน LINE จริง (mock off)

1. ตั้ง `NEXT_PUBLIC_LIFF_ID` ใน `.env.local` เป็น LIFF ID ของคุณ
2. ตั้ง `NEXT_PUBLIC_LIFF_MOCK=false`
3. เปิดผ่าน `https://liff.line.me/<LIFF_ID>/` (ต้องเป็น HTTPS)
4. ดูรายละเอียดการตั้งค่า LIFF ใน `docs/LIFF_SETUP.md` (จะเขียนใน Phase 7)

ค่า secret ของ LINE (`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`)
อยู่ใน `.env.local` เท่านั้น ห้าม commit และห้ามใช้ฝั่ง client

---

## สิ่งที่ทำแล้ว

### 1. Design system + LIFF foundation (Phase 1)
- Design tokens ที่ `src/styles/tokens.css` + Tailwind (ห้าม hard-code สีใน component)
- Component พื้นฐาน 20+ ตัวใน `src/components/ui` — Button, Chip, Input, SearchBar,
  Card, GradeBadge, TrustBadge, StatusBadge, BottomTab, TopBar, BottomSheet, Modal,
  Toast, Stepper, Countdown, PhotoUploader, ConditionChecklist, PriceSuggest,
  EmptyState, Skeleton
- หน้า `/design-system` แสดง component ทั้งหมด (ไว้รีวิว)
- `useLiff()` มี mock mode + เรียก LIFF SDK จริงเมื่อมี LIFF ID
  (`scanCodeV2`, `shareTargetPicker`, `openWindow`, `closeWindow` มี fallback ครบ)
- `/api/auth/line` เป็น stub ตรวจ ID token (มี TODO เชื่อม backend จริง)
- `/debug` แสดงสถานะ LIFF (dev/staging)

### 2. Buyer flow (Phase 2)

| หน้า | Route |
|---|---|
| หน้าแรก / ฟีดหนังสือ | `/` |
| Onboarding ครั้งแรก | `/onboarding` |
| ค้นหา + ตัวกรอง | `/search` |
| รายละเอียดหนังสือ | `/book/[id]` |
| ร้านของผู้ขาย | `/seller/[sellerId]` |
| ตะกร้า + วิธีรับ (นัดรับ/พัสดุ) | `/cart` |
| ส่งคำขอซื้อสำเร็จ | `/cart/success` |
| ออเดอร์ผู้ซื้อ | `/orders`, `/orders/[id]` |
| ให้คะแนนหลังรับของ | `/orders/[id]/review` |
| ฝากตามหา (wishlist) | `/wishlist` |
| ศูนย์แจ้งเตือน | `/notifications` |
| ที่อยู่จัดส่ง (สูงสุด 5) | `/addresses`, `/addresses/edit` |

### 3. Seller flow (Phase 3)

| หน้า | Figma | Route |
|---|---|---|
| ร้านของฉัน (ประกาศ / รอชำระ / ปิดการขาย) | S4L · S4W · S4C | `/seller` |
| ยืนยันตัวตนผู้ขาย | S1 | `/seller/verify` |
| ลงขายขั้น 1 — เล่มเดียว/ยกชุด + สแกน ISBN | S2 · S2B · S2M · S2N | `/seller/list` |
| ขั้น 2 — รูปบังคับ 4 รูป + รูปตำหนิ | S3P · S3PB | `/seller/list/step-2` |
| ขั้น 3 — เช็กสภาพ 5 จุด → เกรดอัตโนมัติ | S3C · S3CB | `/seller/list/step-3` |
| ขั้น 4 — ราคา + ราคาแนะนำ + วิธีรับ | S3 · S3B | `/seller/list/step-4` |
| ลงขายสำเร็จ | S3S | `/seller/list/success` |
| ออเดอร์ผู้ขาย | S4 | `/seller/orders` |
| รับออเดอร์แล้ว (เห็นเบอร์ผู้ซื้อ) | S4B | `/seller/orders/[id]/accepted` |
| เติมเครดิต | S5 | `/seller/credits` |
| จ่ายเงิน QR + แนบสลิป | S5Q | `/seller/credits/pay` |
| เติมเครดิตสำเร็จ | S5OK | `/seller/credits/success` |
| วันนัดรับ / ปิดการขาย | S6 | `/seller/meetup/[id]` |
| ปิดการขายสำเร็จ | S7 | `/seller/meetup/[id]/closed` |
| รายงานปัญหา | S6R | `/seller/report` |
| ส่งรายงานแล้ว | S6RS | `/seller/report/sent` |

Bottom sheet ที่ผูกกับหน้าแล้ว: ZONE, TIME, PRICE, GAL, TSAVE, CANCEL, CALL, PHOTO,
TPHOTO, TRATE, GRADE, DEFECT, TGRADE, TMISSING, TCOD, REJECT, TSHARE, TPRICE

---

## กติกาที่หน้าจอใช้ (ตรงกับ README หลัก)

- **ลงขายฟรี** · ใช้ **1 เครดิตเมื่อผู้ขายกดรับออเดอร์** เท่านั้น · ปฏิเสธไม่เสียเครดิต
- **ไม่มีระบบพักเงิน (no escrow)** — นัดรับจ่ายหน้างาน หรือโอนพร้อมเพย์ + แนบสลิป
- **เบอร์โทรอีกฝ่ายเห็นหลังผู้ขายรับออเดอร์** เท่านั้น
- รูปบังคับ: ปกหน้า (คู่ป้ายชื่อ) · ปกหลัง · สันหนังสือ · สันกระดาษ + รูปตำหนิ
- เช็กสภาพ 5 จุด → เกรด A/B/C/D → ราคาแนะนำ 70% / 60% / 45% / 30% ของราคาปก
- ค่าส่ง: นัดรับ มช. ฿0 · พัสดุ ฿40 เล่มแรก + ฿10 ต่อเล่ม
- เครดิต: Starter ฿20 = 3 · Bookworm ฿50 = 10 · Merchant ฿100 = 25

> ราคาแนะนำ/เกรดที่แสดงเป็น client-side mock — ของจริง server ต้องคำนวณเอง
> ห้ามเชื่อค่าจาก client

---

## โครงสร้างโค้ด

```
src/
├── app/                 # route ตาม Next.js App Router
│   ├── seller/          # seller flow (Phase 3)
│   ├── orders/          # buyer orders
│   ├── book/ cart/ search/ wishlist/ notifications/ addresses/
│   └── api/auth/line/   # LINE ID token verify (stub)
├── components/
│   ├── layout/          # AppShell, TopBar, BottomTab
│   └── ui/              # design system
├── hooks/
│   ├── useLiff.tsx      # LIFF + mock mode + credits
│   ├── useCart.tsx      # ตะกร้า 1 ร้าน
│   ├── useListing.tsx   # draft ของ wizard ลงขาย (S2 → S3S)
│   └── useSeller.tsx    # สถานะร้าน: ยืนยันตัวตน, เครดิต, ออเดอร์, ประกาศ
├── mocks/               # ข้อมูลจำลอง (books.ts, seller.ts)
├── styles/              # tokens.css + globals.css
└── types/               # type ทั้งหมด
```

Provider ทั้งหมด mount ใน `src/app/layout.tsx` ตามลำดับ
`LiffProvider → CartProvider → SellerProvider → ListingProvider → AppShell`

---

## เอกสารที่เกี่ยวข้อง

- `docs/FLOW.md` — flow จริงของแอป + สรุปความต่างจาก flow ที่ทีม brainstorm
- `docs/AUDIT.md` — conflict rules, state ที่เพิ่ม, คำถามถึงเจ้าของโปรเจกต์
- `docs/GongDong-Antigravity-UXUI-Prompt.md` — prompt/แผนงาน 8 เฟส
- `../docs/API.md` — API contract (เขียนร่วมกับ Biw)

## ที่ยังไม่ทำ (ตามแผน)

- Phase 4: Flex Message C1/C2 + Rich Menu + `/line-preview`
- Phase 5: Admin desktop ใต้ `/admin`
- Phase 6: clickable journeys ครบ 5 เส้น, pixel check, ทดสอบ 360/390/430px
- Phase 7: LIFF go-live docs (`DEEP_LINKS.md`, `LIFF_SETUP.md`, `DEPLOY.md`)

mock-only ที่ต้องเปลี่ยนก่อนใช้จริง: อนุมัติสลิปเติมเครดิตอัตโนมัติ, QR ตัวอย่าง,
ปุ่มเติมรูปตัวอย่างในหน้า step-2, และข้อมูลใน `src/mocks/`
