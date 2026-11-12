# Backend · กองดอง (GongDong API)

**ผู้รับผิดชอบ:** Biw  
**เทคโนโลยีหลัก:** Node.js (v24+) + Express + TypeScript + Prisma ORM + PostgreSQL (Supabase)

API, ฐานข้อมูล, ยืนยันตัวตนด้วย LINE และบอท LINE OA 

---

## 🚀 เริ่มต้นใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
cd backend
npm install
```

### 2. ตั้งค่า Environment Variables
คัดลอกไฟล์ `.env.example` เป็น `.env` แล้วกรอกค่าคอนฟิกจริง:
```bash
cp .env.example .env
```

### 3. จัดการฐานข้อมูล (Prisma)
สร้าง Prisma Client จากสคีมา:
```bash
npm run prisma:generate
```

ซิงค์โครงสร้างตารางไปยัง Supabase PostgreSQL:
```bash
npm run prisma:push
```

เปิดดูและจัดการข้อมูลผ่านเบราว์เซอร์:
```bash
npm run prisma:studio
```

### 4. รันเซิร์ฟเวอร์ในโหมดพัฒนา (Hot Reload)
```bash
npm run dev
```
เซิร์ฟเวอร์จะเริ่มทำงานที่ `http://localhost:8000`  
ตรวจสอบสถานะได้ที่: `http://localhost:8000/api/health`

### 5. ตรวจสอบ Type & Build สำหรับ Production
```bash
# ตรวจสอบ TypeScript Types
npm run lint

# Build เป็น JavaScript (dist/)
npm run build

# Start Production Server
npm start
```

---

## 📁 โครงสร้างโปรเจกต์ (Folder Structure)

```
backend/
├── prisma/
│   └── schema.prisma         # สคีมา 10 โมเดล (PostgreSQL) ตาม docs/DATABASE_ERD.md
├── src/
│   ├── config/               # ค่าคอนฟิก (env.ts, prisma.ts)
│   ├── controllers/          # Request Handlers
│   ├── middlewares/          # Middlewares (errorHandler.ts, auth, ฯลฯ)
│   ├── routes/               # Express Route Definitions (health.ts ฯลฯ)
│   ├── services/             # Core Business Logic (grading, slipok, googleBooks)
│   ├── types/                # Shared TypeScript Type Definitions
│   └── index.ts              # Express App Entry Point & Server Bootstrap
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 📋 เอกสารอ้างอิง
* สัญญา API Contract: `../docs/API.md`
* สถาปัตยกรรมฐานข้อมูล: `../docs/DATABASE_ERD.md`
* สรุป Tech Stack: `../Backend-doc/TECH_STACK.md`
* User Flow v4: `../Backend-doc/กองดอง · User Flow v4 (ผู้ขาย + ผู้ซื้อ).md`
