# GongDong (กองดอง) — API Contract

> **เวอร์ชัน:** 1.0.0 (MVP Hackathon)  
> **สถานะ:** Draft อิงจาก Presentation & Flow 3 วัน (ศุกร์ 13 พ.ย. 2569)  
> **ผู้จัดทำ:** Biw (Backend) ร่วมกับ Farm (Frontend)  
> **หมายเหตุ:** จัดทำขึ้นเพื่อให้ทีมสามารถเริ่มพัฒนาคู่ขนานกันได้ทันที และสามารถอัปเดตเพิ่มเติมเมื่อสรุป Flow ขั้นสุดท้ายร่วมกับ PM (Ditchaphon)

---

## 1. มาตรฐานการเชื่อมต่อ (General Specifications)

### 1.1 Base URL
- **Development (Local):** `http://localhost:3000/api` หรือ `http://localhost:8000/api`
- **Production:** `https://<deployed-domain>/api` (ต้องรองรับ HTTPS สำหรับ LIFF)

### 1.2 Authentication
ใช้ **LIFF ID Token** ส่งผ่าน Header ในทุก Request ที่ต้องการระบุตัวตนผู้ใช้:
```http
Authorization: Bearer <liff_id_token>
```
* **ขั้นตอนฝั่ง Frontend:** ดึง Token ด้วย `liff.getIDToken()` แล้วแนบใน Header
* **ขั้นตอนฝั่ง Backend:** ตรวจสอบความถูกต้องของ Token กับ LINE Login API หากเป็นผู้ใช้ใหม่ที่ยังไม่มีในฐานข้อมูล ระบบจะสร้างข้อมูลผู้ใช้ให้อัตโนมัติพร้อม **แจกเครดิตเริ่มต้นฟรี 1 เครดิต**

### 1.3 โครงสร้าง Response มาตรฐาน (Standard Envelope)

#### กรณีสำเร็จ (HTTP 200 / 201)
```json
{
  "success": true,
  "data": { ... },
  "message": "ข้อความแสดงผล (ถ้ามี)"
}
```

#### กรณีเกิดข้อผิดพลาด (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_NAME",
    "message": "คำอธิบายข้อผิดพลาดสำหรับผู้ใช้",
    "details": null
  }
}
```

---

## 2. ข้อมูลระบบและการคำนวณ (Business Rules Reference)

### 2.1 การตรวจสอบสภาพ 5 จุด (Condition Checklist)
1. `spine` (สันหนังสือ): รอยพับ รอยย่น งอ
2. `stains` (รอยเปื้อน): คราบน้ำ จุดเหลือง
3. `markings` (รอยขีดเขียน): ดินสอ ปากกา ไฮไลต์
4. `covers` (ปกหน้า-ปกหลัง): ยับ ฉีกขาด ถลอก
5. `pages` (หน้ากระดาษ): หลุด ขาด แปะเทปซ่อม

### 2.2 เกณฑ์การตัดเกรดอัตโนมัติ (Grading Logic)
*Backend เป็นผู้คำนวณและตรวจสอบความถูกต้องเป็นหลัก (ห้ามเชื่อค่าเกรดที่ Client ส่งมาตรงๆ)*

| เกรด (`grade`) | เงื่อนไข | ราคาแนะนำ (% ของราคาปก) |
|---|---|:---:|
| `LIKE_NEW` (เหมือนใหม่) | ไม่มีตำหนิเลย (0 จุด) | 70% |
| `GENTLY_READ` (สภาพดีมาก) | มีตำหนิ 1 จุด และเป็นเพียง `spine` หรือ `covers` เล็กน้อย | 60% |
| `WELL_LOVED` (อ่านทั่วไป) | มีรอยเปื้อน/ขีดเขียน 1 จุด หรือมีตำหนิรวม 2 จุด | 45% |
| `WORN_BUT_READABLE` (เน้นอ่าน) | มีตำหนิตั้งแต่ 3 จุดขึ้นไป หรือมี `pages` หลุด/ซ่อมเทป | 30% |

### 2.3 อัตราค่าจัดส่ง (Shipping Fee Calculation)
- **นัดรับ (PICKUP):** ฿0 (โซนใน มช.: หน้าหอสมุดกลาง, ประตูหน้า มช., หอพักนักศึกษา)
- **ส่งพัสดุ (DELIVERY):** เล่มแรก ฿40 + เล่มถัดไป ฿10 ต่อเล่ม (เฉพาะร้านเดียวกันในตะกร้า)

---

## 3. รายการ API Endpoints

### 3.1 ระบบผู้ใช้ (Users & Auth)

#### `GET /api/users/me`
ดึงข้อมูลโปรไฟล์ ยอดเครดิต และสถานะของตนเอง
- **Auth:** Required
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "line_user_id": "U1234567890abcdef",
    "display_name": "Nont Bookworm",
    "picture_url": "https://profile.line-scdn.net/...",
    "phone_number": "0812345678",
    "credits": 1,
    "created_at": "2026-11-11T20:00:00Z"
  }
}
```

#### `PATCH /api/users/me`
บันทึกหรือแก้ไขเบอร์โทรศัพท์ (จำเป็นต้องมีก่อนส่งคำขอซื้อหรือลงขาย)
- **Auth:** Required
- **Request Body:**
```json
{
  "phone_number": "0812345678"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "phone_number": "0812345678"
  },
  "message": "บันทึกเบอร์โทรศัพท์สำเร็จ"
}
```

---

### 3.2 หนังสือและรายการลงขาย (Books & Listings)

#### `GET /api/books/isbn/:isbn`
ดึงข้อมูลรายละเอียดหนังสืออัตโนมัติจาก Google Books API
- **Auth:** Optional
- **Parameters:**
  - `isbn`: รหัสบาร์โค้ดหนังสือ 10 หรือ 13 หลัก
- **Response (กรณีพบข้อมูล):**
```json
{
  "success": true,
  "data": {
    "found": true,
    "isbn": "9786161845678",
    "title": "จิตวิทยาวาทะด้วยเงิน (The Psychology of Money)",
    "author": "Morgan Housel",
    "publisher": "Live Rich",
    "cover_url": "https://books.google.com/books/content?id=...",
    "original_price": 290
  }
}
```
- **Response (กรณีไม่พบข้อมูล - ผู้ใช้พิมพ์เองในหน้าจอ):**
```json
{
  "success": true,
  "data": {
    "found": false,
    "isbn": "9786161845678",
    "title": null,
    "author": null,
    "publisher": null,
    "cover_url": null,
    "original_price": null
  },
  "message": "ไม่พบข้อมูลหนังสือ กรุณากรอกรายละเอียดด้วยตนเอง"
}
```

#### `POST /api/upload`
อัปโหลดรูปภาพหนังสือ (ปกหน้าคู่ป้ายชื่อ, ปกหลัง, สันปก, รอยตำหนิ)
- **Auth:** Required
- **Content-Type:** `multipart/form-data`
- **Body:** `file` (Binary Image File)
- **การประมวลผล:** Backend จะทำการปรับลดขนาด (Resize/Scale & Optimize เช่น WebP/JPEG คุณภาพ 80%) เพื่อประหยัดพื้นที่จัดเก็บและโหลดไวบนมือถือ แล้วเก็บขึ้น Supabase Storage
- **Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://<supabase-storage-url>/books/img_849204.webp",
    "width": 1200,
    "height": 1600
  }
}
```

#### `POST /api/books`
บันทึกลงขายหนังสือเล่มใหม่ (หน้าจอ S2–S3)
- **Auth:** Required (ต้องมี `phone_number` แล้ว)
- **Request Body:**
```json
{
  "isbn": "9786161845678",
  "title": "จิตวิทยาวาทะด้วยเงิน",
  "author": "Morgan Housel",
  "cover_url": "https://<storage-url>/cover.webp",
  "original_price": 290,
  "price": 175,
  "condition_answers": {
    "spine": false,
    "stains": true,
    "markings": false,
    "covers": false,
    "pages": false
  },
  "images": [
    "https://<storage-url>/front_with_namecard.webp",
    "https://<storage-url>/back.webp",
    "https://<storage-url>/spine.webp",
    "https://<storage-url>/pages.webp",
    "https://<storage-url>/defect_stain.webp"
  ],
  "allow_pickup": true,
  "pickup_zones": [
    "หน้าหอสมุดกลาง มช.",
    "ประตูหน้า มช."
  ],
  "allow_delivery": true
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "bok_f2a7e289-4b6e-443b-821e-f38b2582845a",
    "title": "จิตวิทยาวาทะด้วยเงิน",
    "grade": "WELL_LOVED",
    "price": 175,
    "status": "AVAILABLE",
    "created_at": "2026-11-11T20:30:00Z"
  },
  "message": "ลงขายหนังสือสำเร็จ"
}
```

#### `GET /api/books`
ค้นหาและกรองรายการหนังสือในตลาด (หน้าจอ B1)
- **Auth:** Optional
- **Query Parameters:**
  - `q`: คำค้นหา (ชื่อหนังสือ, ผู้แต่ง, ISBN)
  - `zone`: กรองตามจุดนัดรับ (เช่น `หน้าหอสมุดกลาง มช.`)
  - `grade`: กรองตามเกรด (`LIKE_NEW`, `GENTLY_READ`, etc.)
  - `status`: สถานะ (`AVAILABLE` ค่าเริ่มต้น)
  - `limit`: จำนวนต่อหน้า (default: 20)
  - `offset`: ลำดับเริ่มต้น (default: 0)
- **Response:**
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": "bok_f2a7e289-4b6e-443b-821e-f38b2582845a",
        "title": "จิตวิทยาวาทะด้วยเงิน",
        "author": "Morgan Housel",
        "cover_url": "https://...",
        "price": 175,
        "original_price": 290,
        "grade": "WELL_LOVED",
        "allow_pickup": true,
        "pickup_zones": ["หน้าหอสมุดกลาง มช."],
        "allow_delivery": true,
        "seller": {
          "id": "usr_...",
          "display_name": "Ploy Books",
          "picture_url": "https://..."
        }
      }
    ],
    "total": 1
  }
}
```

#### `GET /api/books/:id`
ดูรายละเอียดหนังสือรายเล่ม (หน้าจอ B2)
> ⚠️ **ความปลอดภัยขั้นวิกฤต:** Endpoint นี้ **ต้องไม่ส่งเบอร์โทรศัพท์ของผู้ขายออกมาเด็ดขาด**
- **Auth:** Optional
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "bok_f2a7e289-4b6e-443b-821e-f38b2582845a",
    "isbn": "9786161845678",
    "title": "จิตวิทยาวาทะด้วยเงิน",
    "author": "Morgan Housel",
    "cover_url": "https://...",
    "original_price": 290,
    "price": 175,
    "grade": "WELL_LOVED",
    "condition_answers": {
      "spine": false,
      "stains": true,
      "markings": false,
      "covers": false,
      "pages": false
    },
    "images": [
      "https://.../front_with_namecard.webp",
      "https://.../spine.webp"
    ],
    "allow_pickup": true,
    "pickup_zones": ["หน้าหอสมุดกลาง มช."],
    "allow_delivery": true,
    "status": "AVAILABLE",
    "seller": {
      "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "display_name": "Ploy Books",
      "picture_url": "https://..."
    }
  }
}
```

#### `GET /api/users/me/books`
ดูรายการหนังสือที่ตนเองลงขายไว้ (หน้าจอ S4 ร้านของฉัน)
- **Auth:** Required
- **Response:**
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": "bok_f2a7e289-4b6e-443b-821e-f38b2582845a",
        "title": "จิตวิทยาวาทะด้วยเงิน",
        "price": 175,
        "grade": "WELL_LOVED",
        "status": "AVAILABLE",
        "created_at": "2026-11-11T20:30:00Z"
      }
    ]
  }
}
```

---

### 3.3 คำสั่งซื้อและการดีล (Orders & Purchase)

#### `POST /api/orders`
ผู้ซื้อส่งคำขอซื้อสินค้าจากตะกร้า (หน้าจอ B3)
*คำสั่งซื้อ 1 รายการต้องมาจากผู้ขายคนเดียวกันเท่านั้น (Single-seller cart rule)*
- **Auth:** Required (ผู้ซื้อต้องบันทึกเบอร์โทรศัพท์แล้ว)
- **Request Body:**
```json
{
  "seller_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "book_ids": [
    "bok_f2a7e289-4b6e-443b-821e-f38b2582845a"
  ],
  "shipping_method": "PICKUP",
  "pickup_location": "หน้าหอสมุดกลาง มช.",
  "meeting_note": "สะดวกวันพฤหัสบดีช่วง 17:30 น.",
  "delivery_address": null
}
```
- **เงื่อนไขและการทำงานฝั่ง Server:**
  1. ตรวจสอบว่า `buyer_id` ไม่ตรงกับ `seller_id` (ห้ามซื้อหนังสือของตนเอง)
  2. ตรวจสอบว่าหนังสือทุกเล่มมีสถานะ `AVAILABLE`
  3. คำนวณค่าส่ง: ถ้า `PICKUP` ค่าส่ง = 0, ถ้า `DELIVERY` = 40 + (จำนวนเล่ม - 1) * 10
  4. สร้าง Order ในสถานะ `PENDING`
  5. **ส่งข้อความ LINE Bot (Flex Message) แจ้งเตือนผู้ขาย** ว่ามีคำสั่งซื้อใหม่รอให้กดรับ
- **Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
    "total_price": 175,
    "shipping_fee": 0,
    "status": "PENDING",
    "created_at": "2026-11-11T20:45:00Z"
  },
  "message": "ส่งคำขอซื้อสำเร็จ แจ้งเตือนผู้ขายผ่าน LINE แล้ว"
}
```

#### `GET /api/orders/:id`
ดูรายละเอียดคำสั่งซื้อ (หน้าจอ B5 สำหรับผู้ซื้อ / S4 สำหรับผู้ขาย)
> ⚠️ **กติกาเบอร์โทร:** จะเปิดเผย `phone_number` ของผู้ซื้อและผู้ขายต่อเมื่อสถานะเป็น `ACCEPTED` เท่านั้น หากยังเป็น `PENDING` จะเป็น `null`
- **Auth:** Required (เฉพาะผู้ซื้อหรือผู้ขายของ Order นี้เท่านั้น)
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
    "status": "ACCEPTED",
    "shipping_method": "PICKUP",
    "pickup_location": "หน้าหอสมุดกลาง มช.",
    "meeting_note": "สะดวกวันพฤหัสบดีช่วง 17:30 น.",
    "delivery_address": null,
    "shipping_fee": 0,
    "total_price": 175,
    "items": [
      {
        "book_id": "bok_f2a7e289-4b6e-443b-821e-f38b2582845a",
        "title": "จิตวิทยาวาทะด้วยเงิน",
        "price": 175,
        "cover_url": "https://..."
      }
    ],
    "buyer": {
      "id": "usr_...",
      "display_name": "Nont",
      "picture_url": "https://...",
      "phone_number": "0898765432"
    },
    "seller": {
      "id": "usr_...",
      "display_name": "Ploy Books",
      "picture_url": "https://...",
      "phone_number": "0812345678"
    },
    "created_at": "2026-11-11T20:45:00Z",
    "updated_at": "2026-11-11T20:50:00Z"
  }
}
```

#### `GET /api/orders/selling`
รายการคำสั่งซื้อที่เข้ามายังร้านค้าของผู้ขาย (หน้าจอ S4)
- **Auth:** Required
- **Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
        "status": "PENDING",
        "shipping_method": "PICKUP",
        "pickup_location": "หน้าหอสมุดกลาง มช.",
        "total_price": 175,
        "items_count": 1,
        "buyer_name": "Nont",
        "created_at": "2026-11-11T20:45:00Z"
      }
    ]
  }
}
```

#### `GET /api/orders/buying`
รายการคำสั่งซื้อที่ตนเองเป็นผู้ซื้อ (หน้าจอประวัติการสั่งซื้อ)
- **Auth:** Required
- **Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
        "status": "PENDING",
        "total_price": 175,
        "items_count": 1,
        "seller_name": "Ploy Books",
        "created_at": "2026-11-11T20:45:00Z"
      }
    ]
  }
}
```

#### `POST /api/orders/:id/accept`
ผู้ขายกดยืนยันรับออเดอร์ (หน้าจอ S4) — **หัวใจสำคัญของระบบ Transaction**
- **Auth:** Required (ต้องเป็น `seller_id` ของ Order เท่านั้น)
- **เงื่อนไขและการทำงานภายใน Database Transaction:**
  1. ตรวจสอบสถานะ Order ต้องเป็น `PENDING`
  2. ตรวจสอบเครดิตผู้ขาย (`users.credits >= 1`)
  3. **หัก 1 เครดิต** จากบัญชีผู้ขาย
  4. บันทึกประวัติใน `credit_transactions` (`amount: -1`, `type: ORDER_ACCEPT`)
  5. อัปเดตสถานะ Order เป็น `ACCEPTED`
  6. อัปเดตสถานะหนังสือใน Order เป็น `RESERVED`
  7. **ส่งข้อความ LINE Bot แจ้งเตือนผู้ซื้อ** ว่าผู้ขายรับออเดอร์แล้ว และพร้อมติดต่อประสานงาน
- **Response (สำเร็จ):**
```json
{
  "success": true,
  "data": {
    "order_id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
    "status": "ACCEPTED",
    "remaining_credits": 0,
    "buyer_phone": "0898765432"
  },
  "message": "รับออเดอร์สำเร็จ หัก 1 เครดิต ระบบเปิดเผยเบอร์โทรทั้งสองฝ่ายแล้ว"
}
```
- **Response (กรณีเครดิตไม่พอ):**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "เครดิตของคุณไม่เพียงพอ กรุณาเติมเครดิตก่อนรับออเดอร์"
  }
}
```

#### `POST /api/orders/:id/reject`
ผู้ขายปฏิเสธคำสั่งซื้อ (หน้าจอ S4)
- **Auth:** Required (ต้องเป็น `seller_id` ของ Order เท่านั้น)
- **เงื่อนไขและการทำงาน:**
  1. อัปเดตสถานะ Order เป็น `RESERVED` -> `REJECTED`
  2. **ไม่หักเครดิต** ของผู้ขาย
  3. ปลดสถานะหนังสือกลับเป็น `AVAILABLE`
  4. ส่งแจ้งเตือนผู้ซื้อทาง LINE
- **Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
    "status": "REJECTED"
  },
  "message": "ปฏิเสธคำสั่งซื้อเรียบร้อย ไม่มีการหักเครดิต"
}
```

---

### 3.4 Webhook สำหรับ LINE Messaging API

#### `POST /api/webhook/line`
รับ Callback Events จาก LINE Platform
- **Headers:** ตรวจสอบ Signature เสมอด้วย `x-line-signature` คู่กับ `LINE_CHANNEL_SECRET`
- **หน้าที่หลัก:**
  - รองรับ Event ติดตาม (Follow Event): ทักทายผู้ใช้ใหม่ พร้อมแนะนำระบบและให้ข้อมูลเครดิตฟรี
  - รองรับ Event ข้อความ/เมนู เพื่อส่งการ์ดแนะนำการเข้าใช้งาน LIFF

---

## 4. สรุป Error Codes สำหรับฝั่ง Frontend

| Error Code | HTTP Status | ความหมาย / คำแนะนำสำหรับ UI |
|---|:---:|---|
| `UNAUTHORIZED` | 401 | Token ไม่ถูกต้องหรือหมดอายุ ให้รัน `liff.login()` ใหม่ |
| `PHONE_REQUIRED` | 400 | ยังไม่ได้กรอกเบอร์โทร ให้พาไปหน้ากรอกเบอร์ก่อนทำรายการ |
| `BOOK_NOT_AVAILABLE` | 400 | หนังสือถูกผู้อื่นสั่งซื้อไปแล้ว |
| `CANNOT_BUY_OWN_BOOK` | 400 | ไม่อนุญาตให้ซื้อหนังสือที่ตนเองลงขาย |
| `INSUFFICIENT_CREDITS` | 402 / 400 | เครดิตไม่พอรับออเดอร์ แสดง Modal ให้เติมเครดิต |
| `INVALID_CONDITION` | 400 | ส่งคำตอบสภาพหนังสือไม่ครบ 5 จุด |
| `ORDER_NOT_FOUND` | 404 | ไม่พบคำสั่งซื้อที่ระบุ |
| `ORDER_ALREADY_PROCESSED` | 409 | ออเดอร์นี้ถูกรับหรือปฏิเสธไปก่อนหน้าแล้ว |
