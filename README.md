# กองดอง (GongDong)

ตลาดหนังสือมือสองบน LINE · **ลงขายฟรี จ่ายเมื่อขายได้**
LINE OA + LIFF · C2C Book Marketplace · Design Pitching & Hackathon 2569

> ✅ **สถานะ: เสร็จสมบูรณ์** — พิตช์แล้ว 18 พ.ย. 2569 · ใช้งานได้จริงบนมือถือผ่าน LINE

---

## 🔗 ลิงก์

| | |
|---|---|
| 🌐 เว็บที่ deploy | https://gongdong-books.vercel.app/ |
| 🎨 Figma | [กองดอง design](https://www.figma.com/design/tPARViRjMjfbZLmofgP7m1/%E0%B8%81%E0%B8%AD%E0%B8%87%E0%B8%94%E0%B8%AD%E0%B8%87?node-id=0-1) |
| 💬 LINE Official Account | [@848xkfsj](https://line.me/R/ti/p/@848xkfsj) (เพิ่มเพื่อนแล้วเปิดเมนูเพื่อเข้าแอป) |
| 🎤 Pitch deck (Canva) | https://www.canva.com/d/52rBVBDVWY1TEjV |
| 📄 API contract | [docs/API.md](docs/API.md) |
| 🗄 Database ERD | [docs/DATABASE_ERD.md](docs/DATABASE_ERD.md) |
| 🔁 Flow ผู้ซื้อ–ผู้ขาย | [Biwdocs/BUYER_SELLER_ORDER_FLOW.md](Biwdocs/BUYER_SELLER_ORDER_FLOW.md) |

## 💡 ปัญหาและแนวคิด

นักศึกษามีหนังสือเก่าเหลือเยอะแต่ขายยาก: โพสต์ในกลุ่ม Facebook แล้วจมหาย ไม่รู้จะตั้งราคาเท่าไร และผู้ซื้อไม่มั่นใจในสภาพหนังสือ
กองดองทำให้การซื้อขายจบใน LINE ที่ทุกคนมีอยู่แล้ว:

- **ลงขายฟรี** — ผู้ขายจ่าย 1 เครดิตเฉพาะตอนรับออเดอร์ (ขายได้จริงถึงเสีย)
- **เกรดสภาพอัตโนมัติ** จากเช็กลิสต์ 5 จุด + รูปจริง 4 ด้าน → ผู้ซื้อเชื่อใจได้
- **ราคาแนะนำ** คิดจาก % ของราคาปกตามเกรด
- **ปกป้องข้อมูลส่วนตัว (PDPA)** — เบอร์โทร/ที่อยู่เปิดเผยเมื่อถึงขั้นที่จำเป็นเท่านั้น

## ✨ ฟีเจอร์

**ผู้ขาย**
- ลงขาย 4 ขั้น: สแกนบาร์โค้ด/พิมพ์ ISBN → ดึงชื่อ/ปกจาก Google Books → ถ่ายรูป 4 ด้าน → เช็กสภาพ 5 จุด → เกรด + ราคาแนะนำ
- ลงขายแบบยกชุด (set listing)
- ร้านของฉัน: จัดการ/แก้ไข/ลบประกาศ · คำอธิบายร้าน
- รับ/ปฏิเสธออเดอร์ (ใช้ 1 เครดิตตอนรับ) · บันทึกเลขพัสดุ
- เติมเครดิตด้วย PromptPay QR + ตรวจสลิปอัตโนมัติ (SlipOK)
- ยืนยันตัวตนผู้ขาย + ตรวจ Blacklist

**ผู้ซื้อ**
- หน้าแรก / ค้นหา / กรองตามหมวด เกรด วิธีรับ
- ดูรายละเอียด แกลเลอรีรูป และโปรไฟล์ร้าน + รีวิว
- ตะกร้า → ส่งคำขอซื้อ (นัดรับใน มช. หรือส่งพัสดุ)
- จัดการที่อยู่จัดส่ง · ติดตามพัสดุ · ยืนยันรับของ

**ระหว่างกัน**
- นัดรับ + รหัสส่งมอบ 6 หลัก · แจ้งไม่มาตามนัด
- รีวิว 1–5 ดาว + "สภาพตรงเกรดไหม" → Trust score
- แจ้งเตือนผ่าน LINE Flex Message ทุกขั้นสำคัญ + หน้าแจ้งเตือนในแอป
- กรองเบอร์/เลขบัญชี/LINE ID ออกจากข้อความอัตโนมัติ

**แอดมิน**
- หน้าแอดมิน · รายงานผู้ใช้ · dry-run flow ซื้อขายครบวงจรสำหรับเดโม

## 📐 กติกาธุรกิจ

**เครดิต**
- ผู้ใช้ใหม่ได้ฟรี 1 เครดิต · ใช้ **1 เครดิต ต่อ 1 ออเดอร์** ตอนกดรับ · ปฏิเสธไม่เสียเครดิต
- แพ็กเกจ: ฿20 = 3 · ฿50 = 10 · ฿100 = 25

**เกรดอัตโนมัติ** (คำนวณฝั่ง server จากคำตอบ 5 จุด: สันหนังสือ · รอยเปื้อน · รอยขีดเขียน · ปก · หน้ากระดาษ)

| เกรด | เงื่อนไข | ราคาแนะนำ |
|---|---|---|
| `LIKE_NEW` เหมือนใหม่ | ไม่มีตำหนิ | 75% ของราคาปก |
| `GENTLY_READ` สภาพดีมาก | ตำหนิ 1 จุด (สันหรือปกเล็กน้อย) | 60% |
| `WELL_LOVED` อ่านทั่วไป | รอยเปื้อน/ขีดเขียน 1 จุด หรือตำหนิ 2 จุด | 45% |
| `WORN_BUT_READABLE` เน้นอ่าน | ตำหนิ 3 จุดขึ้นไป หรือหน้าหลุด/ซ่อมเทป | 30% |

**วิธีรับหนังสือ**
- นัดรับใน มช. · ฟรี · จ่ายหน้างาน
- ส่งพัสดุ · ฿50 เล่มแรก + ฿10 ต่อเล่มถัดไป (สูงสุด ฿150 ต่อออเดอร์) · โอนพร้อมเพย์ + แนบสลิป

## 🛠 Tech stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend (LIFF) | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Leaflet · ZXing (สแกนบาร์โค้ด) |
| Backend / API | Node.js · Express · TypeScript · Prisma · Zod · Vitest |
| Database / Storage | PostgreSQL + Storage บน Supabase |
| LINE | LIFF (`@line/liff`) · Messaging API (`@line/bot-sdk`) · Flex Message · Rich Menu |
| บริการภายนอก | Google Books API · SlipOK · PromptPay QR |
| Deploy | Vercel (frontend + backend) |

รายละเอียดเพิ่มเติม: [Backend-doc/TECH_STACK.md](Backend-doc/TECH_STACK.md)

## 📁 โครงสร้าง repo

```
├── frontend/      Next.js LIFF app (src/app = ทุกหน้าจอ)
├── backend/       Express API + LINE webhook + Prisma schema/seed
├── docs/          API contract · ERD · UI audit
├── Biwdocs/       เอกสาร flow, audit, แผน deploy และคู่มือทดสอบ
├── Backend-doc/   Tech stack
├── design/        ไฟล์ออกแบบ
└── line-assets/   รูป Rich Menu / Flex
```

## 🚀 รันบนเครื่อง

ต้องมี Node.js 20+ และโปรเจกต์ Supabase + LINE channel ของตัวเอง

```bash
# Backend
cd backend
cp .env.example .env        # ใส่ค่าจริง
npm install
npm run prisma:push         # สร้างตาราง
npm run prisma:seed         # ข้อมูลตัวอย่าง (ไม่บังคับ)
npm run dev
```

```bash
# Frontend
cd frontend
cp .env.example .env.local  # ใส่ LIFF ID, API URL
npm install
npm run dev
```

ทดสอบโดยไม่ต้องล็อกอิน LINE: ตั้ง `NEXT_PUBLIC_LIFF_MOCK=true` (frontend) และ `ENABLE_MOCK_AUTH=true` (backend) · ห้ามเปิดใน production

```bash
cd backend && npm test      # Vitest unit tests
```

> ห้าม commit ไฟล์ `.env` / `.env.local` · LIFF ต้องเปิดผ่าน HTTPS

## 👥 ทีม

| คน | บทบาท | รับผิดชอบ |
|---|---|---|
| Ditchaphon | PM | LINE OA / LIFF / Messaging API · Flex · Rich Menu · test case · UAT |
| Biw | Backend | ฐานข้อมูล · API · LINE auth · แจ้งเตือน · deploy |
| Frame | Frontend | หน้าจอ LIFF ทั้งหมดตาม Figma · เชื่อม API · ทดสอบบนมือถือ |
