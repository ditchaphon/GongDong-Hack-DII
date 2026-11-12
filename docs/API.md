# GongDong (กองดอง) — API Contract

> **เวอร์ชัน:** 2.0.0 (สอดคล้องกับ User Flow v4 & Database Schema v2.2.0)  
> **อัปเดตล่าสุด:** 12 พ.ย. 2569  
> **ผู้ร่วมจัดทำ:** Biw (Backend) ร่วมกับ Farm (Frontend)  
> **สถานะ:** พร้อมใช้งานสำหรับการพัฒนาคู่ขนานทั้งฝั่ง Frontend LIFF (Next.js) และ Backend API (Node.js/Express)

---

## 1. มาตรฐานการเชื่อมต่อ (General Specifications)

### 1.1 Base URL
- **Development (Local):** `http://localhost:8000/api`
- **Production:** `https://<deployed-domain>/api` (ต้องรองรับ HTTPS สำหรับ LINE LIFF)

### 1.2 Authentication
ใช้ **LIFF ID Token** ส่งผ่าน Header ในทุก Request ที่ต้องการระบุตัวตนผู้ใช้:
```http
Authorization: Bearer <liff_id_token>
```
* **Frontend:** ดึง Token ด้วย `liff.getIDToken()` แล้วแนบใน Request Header
* **Backend:** ตรวจสอบ Token กับ LINE Login API หากเป็นผู้ใช้ใหม่ที่ยังไม่มีในฐานข้อมูล ระบบจะสร้างข้อมูลผู้ใช้ให้อัตโนมัติพร้อม **แจกเครดิตเริ่มต้นฟรี 1 เครดิต**

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

## 2. ข้อมูลระบบและกฎเกณฑ์ทางธุรกิจ (Business Rules Reference)

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
| `LIKE_NEW` (เหมือนใหม่) | ไม่มีตำหนิเลย (0 จุด) | 75% |
| `GENTLY_READ` (สภาพดีมาก) | มีตำหนิ 1 จุด และเป็นเพียง `spine` หรือ `covers` เล็กน้อย | 60% |
| `WELL_LOVED` (อ่านทั่วไป) | มีรอยเปื้อน/ขีดเขียน 1 จุด หรือมีตำหนิรวม 2 จุด | 45% |
| `WORN_BUT_READABLE` (เน้นอ่าน) | มีตำหนิตั้งแต่ 3 จุดขึ้นไป หรือมี `pages` หลุด/ซ่อมเทป | 30% |

### 2.3 อัตราค่าจัดส่ง (Shipping Fee Calculation)
- **นัดรับ (PICKUP):** ฿0 (ปักหมุดพิกัดบนแผนที่ Leaflet OpenStreetMap)
- **ส่งพัสดุ (DELIVERY):** เล่มแรก ฿40 + เล่มถัดไป ฿10 ต่อเล่ม (เฉพาะร้านเดียวกันในตะกร้า)

### 2.4 วงจรชีวิตและ 10 สถานะคำสั่งซื้อ (Order Statuses)
- **นัดรับ (PICKUP):** `REQUESTED` ➔ `ACCEPTED` ➔ `SCHEDULED` ➔ `COMPLETED`
- **จัดส่ง (DELIVERY):** `REQUESTED` ➔ `ACCEPTED` ➔ `PAID` ➔ `SHIPPED` ➔ `COMPLETED`
- **สถานะสิ้นสุด/ข้อยกเว้น:** `REJECTED`, `EXPIRED`, `CANCELLED`, `DISPUTED`

---

## 3. รายการ API Endpoints

### 3.1 ระบบผู้ใช้และการยืนยันตัวตน (Users & KYC)

#### `GET /api/users/me`
ดึงข้อมูลโปรไฟล์ ยอดเครดิต สถานะ KYC และข้อมูลส่วนตัวของผู้ใช้ปัจจุบัน
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
    "nickname": "นนท์",
    "avatar_url": "https://<supabase-storage-url>/avatars/avatar_1.webp",
    "phone_number": "0812345678",
    "verified_name": "นนทภัทร",
    "promptpay_id": "0812345678",
    "is_verified_seller": true,
    "credits": 3,
    "created_at": "2026-11-11T20:00:00.000Z"
  }
}
```

#### `PATCH /api/users/me`
บันทึกหรือแก้ไขข้อมูลส่วนตัว (ชื่อเล่น, รูปตัวแทน, เบอร์โทรศัพท์, พร้อมเพย์)
- **Auth:** Required
- **Request Body:**
```json
{
  "nickname": "นนท์",
  "avatar_url": "https://<storage-url>/avatars/avatar_1.webp",
  "phone_number": "0812345678",
  "promptpay_id": "0812345678"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "nickname": "นนท์",
    "avatar_url": "https://<storage-url>/avatars/avatar_1.webp",
    "phone_number": "0812345678",
    "promptpay_id": "0812345678"
  },
  "message": "บันทึกข้อมูลส่วนตัวสำเร็จ"
}
```

#### `POST /api/users/me/topup-slip`
ผู้ขายแนบสลิปเติมเครดิตเข้ากองดอง (฿20 = 3 เครดิต / ฿50 = 10 / ฿100 = 25) เพื่อซื้อเครดิตและทำ **Frictionless KYC ระดับ 2**
- **Auth:** Required
- **Request Body:**
```json
{
  "slip_image_url": "https://<supabase-storage>/slips/topup_usr_9b1deb4d.webp"
}
```
- **การประมวลผลฝั่ง Server:**
  1. ยิงตรวจสอบผ่าน SlipOK API (โหมด `log: true` เพื่อตรวจว่าเงินเข้าบัญชีกองดองและตรวจสลิปซ้ำ)
  2. บันทึกข้อมูลลงตาราง `payment_slips` (`slip_type: CREDIT_TOPUP`, `order_id: null`)
  3. ดึงชื่อผู้โอนจากสลิปบันทึกลง `users.verified_name` และปรับ `users.is_verified_seller = true`
  4. เพิ่มเครดิตให้ผู้ขายตามยอดเงินที่โอน และบันทึกประวัติลง `credit_transactions`
- **Response:**
```json
{
  "success": true,
  "data": {
    "added_credits": 3,
    "total_credits": 4,
    "verified_name": "นนทภัทร",
    "is_verified_seller": true
  },
  "message": "เติมเครดิตและยืนยันบัญชีรับเงินสำเร็จ"
}
```

---

### 3.2 การอัปโหลดไฟล์ (File Upload)

#### `POST /api/upload`
อัปโหลดรูปภาพขึ้น Supabase Storage (รูปหนังสือ, รูปกล่องพัสดุ, สลิปโอนเงิน)
*แนะนำให้ Frontend ทำ Client-side Image Compression (เหลือ `.webp` กว้างไม่เกิน 1080px) ก่อนส่งมา*
- **Auth:** Required
- **Content-Type:** `multipart/form-data`
- **Body:**
  - `file`: Binary Image File
  - `bucket`: `'book-listings'` หรือ `'slips'` (Private) หรือ `'avatars'`
- **Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://<supabase-storage-url>/book-listings/img_849204.webp"
  }
}
```

---

### 3.3 หนังสือและรายการลงขาย (Books & Listings)

#### `GET /api/books/isbn/:isbn`
ดึงข้อมูลหนังสืออัตโนมัติจากรหัส ISBN (Google Books API)
- **Auth:** Optional
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
    "category": "จิตวิทยา / พัฒนาตนเอง",
    "cover_url": "https://books.google.com/books/content?id=...",
    "original_price": 290
  }
}
```
- **Response (กรณีไม่พบข้อมูล):**
```json
{
  "success": true,
  "data": {
    "found": false,
    "isbn": "9786161845678"
  },
  "message": "ไม่พบข้อมูลในแคตตาล็อกกลาง กรุณากรอกรายละเอียดด้วยตนเอง"
}
```

#### `POST /api/books`
ลงขายหนังสือเล่มใหม่ (หน้าจอ S2) — รองรับการบันทึกภาพถ่ายแยกตารางตาม 1NF
- **Auth:** Required
- **Request Body:**
```json
{
  "isbn": "9786161845678",
  "title": "จิตวิทยาวาทะด้วยเงิน",
  "author": "Morgan Housel",
  "publisher": "Live Rich",
  "category": "จิตวิทยา / พัฒนาตนเอง",
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
  "allow_pickup": true,
  "pickup_lat": 18.7953214,
  "pickup_lng": 98.9527312,
  "pickup_location_name": "หน้าหอสมุดกลาง มช. (ม้านั่งฝั่งใต้)",
  "allow_delivery": true,
  "images": [
    {
      "image_url": "https://<storage-url>/front.webp",
      "image_type": "FRONT_COVER",
      "display_order": 1,
      "is_cover": true
    },
    {
      "image_url": "https://<storage-url>/back.webp",
      "image_type": "BACK_COVER",
      "display_order": 2,
      "is_cover": false
    },
    {
      "image_url": "https://<storage-url>/spine.webp",
      "image_type": "SPINE",
      "display_order": 3,
      "is_cover": false
    },
    {
      "image_url": "https://<storage-url>/edge.webp",
      "image_type": "EDGE",
      "display_order": 4,
      "is_cover": false
    },
    {
      "image_url": "https://<storage-url>/defect_stain.webp",
      "image_type": "DEFECT",
      "display_order": 5,
      "is_cover": false
    }
  ]
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "bok_f2a7e289-4b6e-443b-821e-f38b2582845a",
    "title": "จิตวิทยาวาทะด้วยเงิน",
    "category": "จิตวิทยา / พัฒนาตนเอง",
    "grade": "WELL_LOVED",
    "price": 175,
    "recommended_price": 130.50,
    "status": "AVAILABLE",
    "created_at": "2026-11-12T15:30:00.000Z"
  },
  "message": "ลงขายหนังสือสำเร็จ"
}
```

#### `GET /api/books`
ค้นหาและกรองรายการหนังสือในตลาด (หน้าจอ B1)
- **Auth:** Optional
- **Query Parameters:**
  - `q`: คำค้นหา (ชื่อหนังสือ, ผู้แต่ง, ISBN)
  - `category`: กรองตามหมวดหมู่หนังสือ (เช่น `"จิตวิทยา / พัฒนาตนเอง"`, `"ตำราเรียน / สอบเข้า"`, `"มังงะ / นิยาย"`, `"บริหาร / การเงิน"`)
  - `grade`: กรองตามเกรด (`LIKE_NEW`, `GENTLY_READ`, `WELL_LOVED`, `WORN_BUT_READABLE`)
  - `shipping`: `'PICKUP'` หรือ `'DELIVERY'`
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
        "category": "จิตวิทยา / พัฒนาตนเอง",
        "cover_image_url": "https://<storage-url>/front.webp",
        "price": 175,
        "original_price": 290,
        "grade": "WELL_LOVED",
        "allow_pickup": true,
        "pickup_location_name": "หน้าหอสมุดกลาง มช.",
        "allow_delivery": true,
        "seller": {
          "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          "nickname": "นนท์",
          "avatar_url": "https://...",
          "is_verified_seller": true
        }
      }
    ],
    "total": 1
  }
}
```

#### `GET /api/books/:id`
ดูรายละเอียดหนังสือรายเล่ม (หน้าจอ B2)
> 🛡️ **ความปลอดภัย:** ส่งเฉพาะ `nickname`, `avatar_url`, และ `is_verified_seller` ของผู้ขาย **ห้ามเปิดเผยเบอร์โทรหรือชื่อ LINE ใน Endpoint นี้เด็ดขาด**
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
    "publisher": "Live Rich",
    "category": "จิตวิทยา / พัฒนาตนเอง",
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
      {
        "id": "img_1",
        "image_url": "https://.../front.webp",
        "image_type": "FRONT_COVER",
        "display_order": 1,
        "is_cover": true
      },
      {
        "id": "img_2",
        "image_url": "https://.../defect_stain.webp",
        "image_type": "DEFECT",
        "display_order": 2,
        "is_cover": false
      }
    ],
    "allow_pickup": true,
    "pickup_lat": 18.7953214,
    "pickup_lng": 98.9527312,
    "pickup_location_name": "หน้าหอสมุดกลาง มช. (ม้านั่งฝั่งใต้)",
    "allow_delivery": true,
    "status": "AVAILABLE",
    "seller": {
      "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "nickname": "นนท์",
      "avatar_url": "https://...",
      "is_verified_seller": true
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
        "category": "จิตวิทยา / พัฒนาตนเอง",
        "price": 175,
        "grade": "WELL_LOVED",
        "cover_image_url": "https://.../front.webp",
        "status": "AVAILABLE",
        "created_at": "2026-11-12T15:30:00.000Z"
      }
    ]
  }
}
```

#### `DELETE /api/books/:id`
ลบรายการลงขายหนังสือ (เฉพาะเล่มที่สถานะเป็น `AVAILABLE` และเป็นเจ้าของ)
- **Auth:** Required
- **Response:**
```json
{
  "success": true,
  "message": "ลบรายการหนังสือสำเร็จ"
}
```

---

### 3.4 คำสั่งซื้อและวงจรสถานะ (Orders & Transactions)

#### `POST /api/orders`
ผู้ซื้อส่งคำขอซื้อสินค้าจากตะกร้า (หน้าจอ B3)
*กติกา: 1 ตะกร้า = 1 ร้านค้า และผู้ซื้อ 1 คนส่งคำขอค้างสถานะ REQUESTED ได้ไม่เกิน 3 ออเดอร์*
- **Auth:** Required (ผู้ซื้อต้องบันทึกเบอร์โทรศัพท์แล้ว)
- **Request Body (กรณีส่งพัสดุ):**
```json
{
  "seller_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "book_ids": ["bok_f2a7e289-4b6e-443b-821e-f38b2582845a"],
  "shipping_method": "DELIVERY",
  "delivery_address": "หอพักนักศึกษา อาคาร 4 ห้อง 412 มช. ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",
  "recipient_name": "สมชาย ใจดี",
  "recipient_phone": "0898765432"
}
```
- **Request Body (กรณีนัดรับ):**
```json
{
  "seller_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "book_ids": ["bok_f2a7e289-4b6e-443b-821e-f38b2582845a"],
  "shipping_method": "PICKUP",
  "pickup_lat": 18.7953214,
  "pickup_lng": 98.9527312,
  "pickup_location_name": "หน้าหอสมุดกลาง มช."
}
```
- **การประมวลผลฝั่ง Server:**
  1. ตรวจสอบว่าผู้ซื้อไม่มีคำขอสถานะ `REQUESTED` ค้างเกิน 3 รายการ
  2. หนังสือยังไม่ถูกล็อก (เปิดให้ขอซื้อซ้อนได้)
  3. คำนวณค่าส่ง: `PICKUP` ฿0, `DELIVERY` ฿40 เล่มแรก + ฿10 เล่มถัดไป
  4. สร้าง Order ในสถานะ `REQUESTED`
  5. หากเลือก `DELIVERY` จะบันทึกข้อมูลจัดส่งลงในตารางแยก `order_delivery_details`
  6. ส่ง LINE Notification ไปยังผู้ขายว่ามีคนส่งคำขอซื้อเข้ามา
- **Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
    "total_price": 215,
    "shipping_fee": 40,
    "status": "REQUESTED",
    "created_at": "2026-11-12T15:45:00.000Z"
  },
  "message": "ส่งคำขอซื้อสำเร็จ แจ้งเตือนไปยังร้านค้าแล้ว"
}
```

#### `GET /api/orders/:id`
ดูรายละเอียดคำสั่งซื้อ (หน้าจอ B5 สำหรับผู้ซื้อ / S4 สำหรับผู้ขาย)
> 🛡️ **กฎการปกป้องข้อมูลส่วนบุคคล (Data Masking Rule):**
> * ก่อนร้านกดรับ (`REQUESTED`): ผู้ขายเห็นเฉพาะชื่อเล่นและรูปตัวแทนของผู้ซื้อ (เบอร์โทรและที่อยู่จะถูกซ่อน)
> * ข้อมูลที่อยู่จัดส่ง (`order_delivery_details`): จะส่งคืนให้ผู้ขายก็ต่อเมื่อออเดอร์มีสถานะเป็น `PAID` หรือ `SHIPPED` เท่านั้น
- **Auth:** Required (เฉพาะผู้ซื้อหรือผู้ขายของ Order นี้)
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
    "status": "ACCEPTED",
    "shipping_method": "DELIVERY",
    "shipping_fee": 40,
    "total_price": 215,
    "items": [
      {
        "book_id": "bok_f2a7e289-4b6e-443b-821e-f38b2582845a",
        "title": "จิตวิทยาวาทะด้วยเงิน",
        "price": 175,
        "cover_image_url": "https://..."
      }
    ],
    "buyer": {
      "id": "usr_...",
      "nickname": "สมชาย",
      "avatar_url": "https://..."
    },
    "seller": {
      "id": "usr_...",
      "nickname": "นนท์",
      "avatar_url": "https://...",
      "promptpay_id": "0812345678",
      "verified_name": "นนทภัทร",
      "is_verified_seller": true
    },
    "delivery_details": null,
    "created_at": "2026-11-12T15:45:00.000Z"
  }
}
```

#### `GET /api/orders/selling`
รายการคำสั่งซื้อที่เข้ามายังร้านค้า (หน้าจอ S4)
- **Auth:** Required
- **Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
        "status": "REQUESTED",
        "shipping_method": "DELIVERY",
        "total_price": 215,
        "items_count": 1,
        "buyer_nickname": "สมชาย",
        "created_at": "2026-11-12T15:45:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/orders/buying`
รายการคำสั่งซื้อที่ตนเองสั่งซื้อ (หน้าจอประวัติการสั่งซื้อ)
- **Auth:** Required
- **Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
        "status": "REQUESTED",
        "total_price": 215,
        "items_count": 1,
        "seller_nickname": "นนท์",
        "created_at": "2026-11-12T15:45:00.000Z"
      }
    ]
  }
}
```

#### `POST /api/orders/:id/accept`
ผู้ขายกดรับออเดอร์ (หน้าจอ S4) — **ทำงานแบบ ACID Transaction ภายในระบบ**
- **Auth:** Required (ต้องเป็นผู้ขายของ Order นี้)
- **การประมวลผลฝั่ง Server:**
  1. ตรวจสอบว่าผู้ขายผ่าน KYC ระดับ 2 หรือยัง (ถ้ายัง ให้แจ้งเตือนเติมเครดิตก่อน)
  2. ตรวจสอบว่าผู้ขายมี `credits >= 1`
  3. **หัก 1 เครดิต** จากผู้ขาย พร้อมบันทึกใน `credit_transactions`
  4. อัปเดตสถานะออเดอร์นี้เป็น `ACCEPTED`
  5. ล็อกหนังสือเล่มนั้นให้เป็น `RESERVED`
  6. **ตัดคำขอซื้ออื่น (ถ้ามี) ของหนังสือเล่มเดียวกันให้เป็น `REJECTED` อัตโนมัติ**
  7. ส่ง LINE Notification แจ้งเตือนผู้ซื้อ
- **Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
    "status": "ACCEPTED",
    "remaining_credits": 2
  },
  "message": "รับออเดอร์สำเร็จ หัก 1 เครดิต และล็อกสต็อกหนังสือให้คำสั่งซื้อนี้แล้ว"
}
```

#### `POST /api/orders/:id/reject`
ผู้ขายปฏิเสธคำขอซื้อ
- **Auth:** Required (ต้องเป็นผู้ขายของ Order นี้)
- **การทำงาน:** ปรับสถานะ Order เป็น `REJECTED` โดย **ไม่มีการหักเครดิต** และหนังสือยังคงสถานะ `AVAILABLE` ให้คนอื่นขอซื้อต่อได้
- **Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "ord_a08c1b3f-e8b2-48ec-b12e-15d911b30df4",
    "status": "REJECTED"
  },
  "message": "ปฏิเสธคำขอซื้อเรียบร้อย ไม่เสียเครดิต"
}
```

---

### 3.5 โฟลว์การนัดรับ (Pickup Flow Endpoints)

#### `PATCH /api/orders/:id/schedule`
ยืนยันวันเวลานัดหมายและพิกัดนัดพบ (เมื่อผู้ขายและผู้ซื้อตกลงกันได้)
- **Auth:** Required (ผู้ซื้อหรือผู้ขาย)
- **Request Body:**
```json
{
  "scheduled_at": "2026-11-13T17:30:00.000Z",
  "pickup_lat": 18.7953214,
  "pickup_lng": 98.9527312,
  "pickup_location_name": "หน้าหอสมุดกลาง มช. (ม้านั่งฝั่งใต้)"
}
```
- **การทำงาน:** ปรับสถานะเป็น `SCHEDULED` และสุ่มสร้าง `handover_code` 6 หลักส่งให้ผู้ซื้อ
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "SCHEDULED",
    "scheduled_at": "2026-11-13T17:30:00.000Z",
    "handover_code": "482910"
  },
  "message": "ยืนยันการนัดหมายสำเร็จ รหัสส่งมอบ 6 หลักถูกสร้างให้ผู้ซื้อแล้ว"
}
```

#### `POST /api/orders/:id/handover`
ผู้ขายกรอก **รหัสส่งมอบ 6 หลัก** ที่ได้รับจากผู้ซื้อเพื่อปิดการขาย (หลังตรวจสภาพหนังสือและจ่ายเงินเรียบร้อย)
- **Auth:** Required (เฉพาะผู้ขายของ Order นี้)
- **Request Body:**
```json
{
  "handover_code": "482910"
}
```
- **การทำงาน:** ตรวจสอบรหัส 6 หลัก หากถูกต้องจะปรับสถานะหนังสือเป็น `SOLD` และออเดอร์เป็น `COMPLETED`
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "COMPLETED"
  },
  "message": "รหัสถูกต้อง ปิดการขายสมบูรณ์"
}
```

#### `POST /api/orders/:id/missed-meeting`
ผู้ขายกดรายงานว่า "ผู้ซื้อไม่มาตามนัด"
- **Auth:** Required (เฉพาะผู้ขาย)
- **เงื่อนไข:** กดได้เมื่อ **เลยเวลา `scheduled_at` ไปแล้วอย่างน้อย 15–30 นาที**
- **การทำงาน:** บันทึกเวลา `missed_meeting_reported_at` และส่งแจ้งเตือนให้ผู้ซื้อมีสิทธิ์กดโต้แย้งภายใน 24 ชม. หากไม่มีการโต้แย้ง ระบบจะคืน 1 เครดิตให้ผู้ขาย
- **Response:**
```json
{
  "success": true,
  "data": {
    "missed_meeting_reported_at": "2026-11-13T18:00:00.000Z"
  },
  "message": "บันทึกรายงานเรียบร้อย ระบบให้สิทธิ์ผู้ซื้อโต้แย้งภายใน 24 ชม."
}
```

#### `POST /api/orders/:id/dispute-missed-meeting`
ผู้ซื้อกดโต้แย้งรายงานไม่มาตามนัด (ภายใน 24 ชม.)
- **Auth:** Required (เฉพาะผู้ซื้อ)
- **Request Body:**
```json
{
  "reason": "ฉันไปถึงจุดนัดพบแล้วและติดต่อร้านค้าไม่ได้"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "DISPUTED"
  },
  "message": "ส่งข้อโต้แย้งเข้าสู่การตรวจสอบของแอดมินเรียบร้อย"
}
```

---

### 3.6 โฟลว์การจัดส่งพัสดุ (Delivery Flow Endpoints)

#### `POST /api/orders/:id/payment-slip`
ผู้ซื้ออัปโหลดสลิปโอนเงิน PromptPay เพื่อชำระค่าหนังสือ
- **Auth:** Required (เฉพาะผู้ซื้อ)
- **Request Body:**
```json
{
  "slip_image_url": "https://<supabase-storage>/slips/order_ord_a08c1b3f.webp"
}
```
- **การประมวลผลฝั่ง Server:**
  1. ยิงตรวจสอบผ่าน SlipOK API (โหมด `log: false`) เพื่อดึงข้อมูลจริงจาก ธปท.
  2. ตรวจสอบว่า `transRef` ไม่เคยมีในตาราง `payment_slips` (ป้องกันสลิปซ้ำ)
  3. ตรวจสอบว่าชื่อผู้รับในสลิปตรงกับ `verified_name` ของร้านค้า
  4. ตรวจสอบว่ายอดเงินในสลิปตรงกับ `total_price`
  5. หากผ่านครบ: บันทึกสถานะ `AUTO_VERIFIED` และปรับสถานะออเดอร์เป็น `PAID` พร้อมแจ้งเตือนร้านค้า
  6. หากตรวจไม่ผ่าน/โควต้าหมด: บันทึกสถานะ `PENDING_ADMIN` ส่งเข้าคิวให้แอดมินตรวจสอบ (ห้ามร้านยืนยันเอง)
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "PAID",
    "verification_status": "AUTO_VERIFIED",
    "trans_ref": "202611129482019481"
  },
  "message": "ตรวจสอบสลิปโอนเงินสำเร็จ สถานะออเดอร์เปลี่ยนเป็น PAID แล้ว"
}
```

#### `PATCH /api/orders/:id/ship`
ผู้ขายกรอกข้อมูลการจัดส่งพัสดุ (ชื่อขนส่ง + เลขพัสดุ + รูปกล่องพัสดุติดฉลาก) ภายใน 48 ชม.
- **Auth:** Required (เฉพาะผู้ขาย)
- **Request Body:**
```json
{
  "courier_name": "Flash Express",
  "tracking_number": "TH0192837482A",
  "parcel_image_url": "https://<storage-url>/box_ord_a08c1b3f.webp"
}
```
- **การทำงาน:** บันทึกข้อมูลลง `order_delivery_details` ปรับสถานะเป็น `SHIPPED` และส่ง LINE Notification แจ้งเลขพัสดุให้ผู้ซื้อ
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "SHIPPED",
    "tracking_number": "TH0192837482A"
  },
  "message": "บันทึกข้อมูลจัดส่งสำเร็จ แจ้งเลขพัสดุให้ผู้ซื้อผ่าน LINE เรียบร้อย"
}
```

#### `POST /api/orders/:id/confirm-receipt`
ผู้ซื้อกดยืนยันได้รับสินค้าแล้ว (หรือครบ 7 วันหลังส่งพัสดุโดยอัตโนมัติ)
- **Auth:** Required (เฉพาะผู้ซื้อ)
- **การทำงาน:** ปรับสถานะออเดอร์เป็น `COMPLETED` และสถานะหนังสือเป็น `SOLD`
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "COMPLETED"
  },
  "message": "ยืนยันรับสินค้าเรียบร้อย คำสั่งซื้อเสร็จสิ้นสมบูรณ์"
}
```

---

### 3.7 การให้คะแนนและข้อพิพาท (Reviews & Disputes)

#### `POST /api/orders/:id/review`
ส่งคะแนนรีวิวหลังจบการขาย (สถานะ `COMPLETED`)
- **Auth:** Required (ผู้ซื้อหรือผู้ขาย)
- **Request Body (ผู้ซื้อรีวิวร้านค้า):**
```json
{
  "rating": 5,
  "is_condition_accurate": true,
  "comment": "หนังสือสภาพดีมาก ห่อกันกระแทกมาอย่างดีครับ"
}
```
- **Request Body (ผู้ขายรีวิวผู้ซื้อ):**
```json
{
  "rating": 5,
  "comment": "ตรงเวลา อัธยาศัยดีมากครับ"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "บันทึกรีวิวสำเร็จ ขอบคุณสำหรับข้อเสนอแนะ"
}
```

#### `POST /api/orders/:id/dispute`
เปิดข้อพิพาทหรือแจ้งปัญหาคำสั่งซื้อ (สถานะ `DISPUTED`)
- **Auth:** Required
- **Request Body:**
```json
{
  "reason": "หนังสือมีรอยน้ำท่วมและหน้ากระดาษติดกัน ไม่ตรงตามเกรด LIKE_NEW"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "status": "DISPUTED"
  },
  "message": "เปิดข้อพิพาทสำเร็จ แอดมินจะเข้าตรวจสอบหลักฐานเพื่อดำเนินการต่อไป"
}
```

---

### 3.8 Webhook สำหรับ LINE Messaging API

#### `POST /api/webhook/line`
รับ Callback Events จาก LINE Messaging API Platform
- **Headers:** ตรวจสอบความถูกต้องด้วย `x-line-signature` คู่กับ `LINE_CHANNEL_SECRET`
- **หน้าที่หลัก:**
  - **Follow Event:** ส่งข้อความ Flex Message ต้อนรับผู้ใช้ใหม่ แจ้งรับสิทธิ์ 1 เครดิตฟรี
  - **Stateless Chat Forwarding:** รับข้อความที่ผู้ซื้อหรือผู้ขายพิมพ์คุยใน LINE OA แล้วส่งต่อไปยังอีกฝ่าย โดยผ่านระบบกรองเบอร์โทรศัพท์และ LINE ID อัตโนมัติ

---

## 4. สรุป Error Codes สำหรับฝั่ง Frontend

| Error Code | HTTP Status | ความหมาย / แนวทางจัดการบนหน้าจอ UI |
|---|:---:|---|
| `UNAUTHORIZED` | 401 | LIFF ID Token หมดอายุหรือไม่ถูกต้อง ให้เรียก `liff.login()` ใหม่ |
| `PHONE_REQUIRED` | 400 | ยังไม่ได้กรอกเบอร์โทร ให้เปิด Modal บังคับกรอกเบอร์ก่อนทำรายการ |
| `BOOK_NOT_AVAILABLE` | 400 | หนังสือถูกยืนยันรับออเดอร์โดยลูกค้ารายอื่นไปแล้ว |
| `CANNOT_BUY_OWN_BOOK` | 400 | ไม่อนุญาตให้สั่งซื้อหนังสือที่ตนเองเป็นผู้ลงขาย |
| `TOO_MANY_PENDING_REQUESTS` | 400 | มีคำขอซื้อค้างสถานะ REQUESTED ครบ 3 รายการแล้ว ต้องรอการตอบรับก่อน |
| `INSUFFICIENT_CREDITS` | 400 | เครดิตผู้ขายไม่พอรับออเดอร์ แสดง Modal ให้เติมเงิน (฿20) |
| `SELLER_NOT_VERIFIED` | 400 | ผู้ขายยังไม่ได้ยืนยันบัญชีรับเงิน (Frictionless KYC) ให้เติมเงินเพื่อดึงชื่อยืนยันก่อน |
| `INVALID_CONDITION` | 400 | ส่งคำตอบสภาพหนังสือไม่ครบทั้ง 5 จุด |
| `INVALID_HANDOVER_CODE` | 400 | รหัสส่งมอบ 6 หลักไม่ถูกต้อง ให้ผู้ขายตรวจดูรหัสบนหน้าจอลูกค้าอีกครั้ง |
| `TOO_EARLY_FOR_NO_SHOW` | 400 | ยังไม่ถึงเวลานัดหมาย + 15 นาที จึงยังไม่สามารถกดรายงานไม่มาตามนัดได้ |
| `DUPLICATE_SLIP` | 400 | สลิปนี้เคยถูกใช้งานในระบบไปแล้ว (transRef ซ้ำ) |
| `SLIP_AMOUNT_MISMATCH` | 400 | ยอดเงินในสลิปไม่ตรงกับยอดรวมของคำสั่งซื้อ |
| `SLIP_RECEIVER_MISMATCH` | 400 | บัญชีผู้รับในสลิปไม่ตรงกับชื่อยืนยันของผู้ขาย |
| `ORDER_NOT_FOUND` | 404 | ไม่พบคำสั่งซื้อที่ระบุ |
| `ORDER_ALREADY_PROCESSED` | 409 | ออเดอร์นี้ถูกรับ ดำเนินการ หรือยกเลิกไปก่อนหน้าแล้ว |
