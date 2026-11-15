# ผลการตรวจสอบปัญหาและช่องโหว่ระบบสั่งซื้อหนังสือ (Multi-Book & Multi-Seller Flow Audit)

**วันที่ตรวจสอบ**: 2026-11-14  
**ขอบเขตการตรวจสอบ**: Flow ตั้งแต่เลือกหนังสือลงตะกร้า (`useCart`, `book/[id]`, `CartAddedSheet`) ➔ หน้าตะกร้า/ส่งคำขอซื้อ (`cart/page.tsx`, `useV4Orders`) ➔ Backend API (`POST /api/orders`, `orderService.ts`, `orders.ts`, `schema.prisma`) ➔ การตอบรับ/จัดการออเดอร์ต่อเนื่อง (`acceptOrder`, `orders/[id]`)

---

## สรุปภาพรวม (Executive Summary)

ระบบปัจจุบันถูกออกแบบภายใต้ข้อจำกัด **"1 ตะกร้า = 1 ร้านค้า = 1 ออเดอร์"** ทั้งฝั่ง Frontend และ Backend จึงยังไม่รองรับการสั่งซื้อหนังสือจาก **หลายเจ้าของพร้อมกัน** (Multi-Seller Checkout) และในการสั่ง **หลายเล่มจากร้านเดียวกัน** ยังมีบั๊กเรื่องเงื่อนไขวิธีจัดส่งขัดกัน ข้อมูลใน `localStorage` ไม่อัปเดตสด การตรวจสอบ Input / Concurrency ใน Backend รวมถึงการส่งค่าที่ไม่สอดคล้องกันระหว่าง Frontend กับ Backend

| ระดับความรุนแรง | จำนวนประเด็น | ประเด็นหลัก |
|---|---:|---|
| 🔴 Critical | 1 | สั่งหลายเจ้าของพร้อมกันไม่ได้ (Single-Shop Cart Lock ทั้ง FE/BE) |
| 🟠 High | 4 | โควต้า `REQUESTED <= 3` + Race Condition, วิธีส่งหลายเล่มขัดกันใน `/cart`, Input Validation / Duplicate `book_ids` / `ship_within_days` Spoofing, Race Condition ใน `createOrder` / `acceptOrder` |
| 🟡 Medium | 4 | `localStorage` ไม่ผูก User & ราคาไม่อัปเดต (Price Drift), ไม่มี Idempotency & ไม่ระบุเล่มที่ไม่ว่าง, `codEnabled` & Fallback จุดนัดรับไม่ตรงกัน, บั๊กหน้าออเดอร์ต่อเนื่อง (`MEETUP` สถานะ `ACCEPTED`, `scheduledAt`, `grade`) |

---

## รายการปัญหาและช่องโหว่โดยละเอียด

### 1. 🔴 [CRITICAL] ระบบล็อก "1 ตะกร้า = 1 ร้าน" — สั่งซื้อหนังสือจากหลายเจ้าของพร้อมกันไม่ได้

- **ตำแหน่งที่พบ**:
  - Frontend: [useCart.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useCart.tsx#L142-L161), [CartAddedSheet.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/CartAddedSheet.tsx#L73-L119), [book/[id]/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/book/[id]/page.tsx#L144-L164)
  - Backend: [orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts#L36-L80), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L193-L199)
- **อาการ / สาเหตุ**:
  1. `addToCart(book)` ใน `useCart.tsx` ตรวจ `items[0].sellerId !== book.sellerId` แล้วคืน `{ success: false, reason: 'OTHER_SHOP' }` ทำให้ไม่สามารถเก็บหนังสือจากร้านที่ 2 ไว้ในตะกร้าได้
  2. หน้า `book/[id]/page.tsx` และ `CartAddedSheet.tsx` บังคับให้เลือกระหว่าง **"เก็บตะกร้าเดิม"** หรือ **"ล้างแล้วใส่เล่มนี้ (`replaceCart`)"** รวมถึงปุ่ม **"ส่งคำขอซื้อ" (`handleBuyNow`)** ก็ใช้ `addToCart` ตัวเดียวกัน ทำให้กดซื้อด่วนเล่มใหม่แล้วตะกร้าเดิมหาย (หรือรวมเล่มเดิมในร้านเดียวกันติดไปด้วยโดยไม่ได้ตั้งใจ)
  3. ฝั่ง Backend `POST /api/orders` รับ `seller_id` เดียว และบล็อกด้วย `MULTIPLE_SELLERS_IN_CART` (HTTP 400) ยังไม่มี Batch Checkout Endpoint (เช่น `POST /api/orders/batch`) ที่รับรายการหลายร้านแล้วแตกเป็นหลาย Order พร้อมกันใน Transaction เดียว
- **แนวทางแก้ไข**:
  - เปลี่ยนโครงสร้าง `useCart` ให้เก็บได้หลายร้าน โดยจัดกลุ่มตาม `sellerId` (1 Group = 1 ร้านค้า = 1 วิธีรับของ + 1 ชุดหนังสือ)
  - ให้หน้า `/cart` แสดงเป็นรายร้าน (แต่ละร้านเลือก `MEETUP` หรือ `PARCEL` และค่าส่งแยกกัน) พร้อมปุ่มส่งคำขอซื้อรายร้านหรือส่งทั้งหมด
  - เพิ่ม Endpoint `POST /api/orders/batch` (หรือวนส่งแบบรองรับ partial failure ชัดเจน) เพื่อสร้างหลายออเดอร์โดยคำนวณโควต้าและล็อกสต็อกอย่างถูกต้อง

---

### 2. 🟠 [HIGH] โควต้าคำขอซื้อค้างสูงสุด 3 ออเดอร์ (`REQUESTED <= 3`) และช่องโหว่ Race Condition

- **ตำแหน่งที่พบ**:
  - Backend: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L171-L182)
- **อาการ / สาเหตุ**:
  1. ระบบจำกัด `pendingCount >= 3` (`TOO_MANY_PENDING_REQUESTS`) หากผู้ซื้อสั่งหนังสือจาก **4 เจ้าของขึ้นไป** พร้อมกัน ระบบต้องสร้าง 4 ออเดอร์ขึ้นไป ทำให้ติด Error ตั้งแต่ร้านที่ 4
  2. **ช่องโหว่ Race Condition (TOCTOU)**: การตรวจ `db.order.count({ where: { buyerId, status: 'REQUESTED' } })` ทำ**นอก** `db.$transaction(...)` (L260) หากผู้ซื้อยิง `POST /api/orders` พร้อมกันหลาย request (หรือกดเบิ้ล / batch request พร้อมกัน) ทุก request จะเห็น `pendingCount < 3` และสร้างออเดอร์ทะลุโควต้า 3 ออเดอร์ได้
- **แนวทางแก้ไข**:
  - พิจารณาปรับเพดาน `REQUESTED` หรือแยกโควต้าให้สอดคล้องกับการสั่งหลายร้าน
  - ย้ายการตรวจ `pendingCount` เข้าไปอยู่ใน `$transaction` (หรือใช้ advisory lock / serializable check ต่อ `buyerId`) เพื่อป้องกันการยิงพร้อมกัน

---

### 3. 🟠 [HIGH] หนังสือหลายเล่มจากร้านเดียวกันที่วิธีจัดส่งไม่ตรงกัน ทำให้หน้า `/cart` ค้างและส่งคำขอที่พังแน่นอน

- **ตำแหน่งที่พบ**:
  - Frontend: [cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx#L90-L97), [cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx#L471-L479)
  - Backend: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L219-L240)
- **อาการ / สาเหตุ**:
  1. หน้า `/cart` คำนวณสิทธิ์ด้วย `items.every(...)`:
     - `canMeetup = items.length > 0 && items.every((book) => book.deliveryMethods.includes('MEETUP'))`
     - `canParcel = items.length > 0 && items.every((book) => book.deliveryMethods.includes('PARCEL')) && (shop ? shop.supportsParcel && shop.payeeVerified : true)`
  2. หากในตะกร้ามีหนังสือจากร้านเดียวกัน 2 เล่ม โดยเล่ม A เปิดเฉพาะ `MEETUP` และเล่ม B เปิดเฉพาะ `PARCEL` จะทำให้ **`canMeetup === false` และ `canParcel === false` พร้อมกัน**
  3. ตัวแปร `delivery` (L97) จะ fallback ไปเป็น `'PARCEL'` หรือ `'MEETUP'` แม้ปุ่มทั้งคู่จะถูก `disabled` อยู่ และปุ่ม **"ส่งคำขอซื้อ" (`disabled={missingParcelAddress}`)** ไม่ได้ตรวจ `!canMeetup && !canParcel` ทำให้ผู้ใช้กดส่งคำขอซื้อได้ แล้วค่อยไปพัง HTTP 400 จาก Backend (`DELIVERY_NOT_ALLOWED` หรือ `PICKUP_NOT_ALLOWED`)
  4. **Flash of wrong state**: ระหว่างรอ `GET /api/shops/:sellerId` (`shop === null`) ค่า `canParcel` ประเมิน `(shop ? ... : true)` เป็น `true` ชั่วคราว แล้วค่อยดีดกลับเป็น `false` หลังข้อมูลร้านโหลดเสร็จ
- **แนวทางแก้ไข**:
  - Disable ปุ่มสั่งซื้อเมื่อ `!canMeetup && !canParcel` พร้อมแสดง Banner แจ้งเตือนชัดเจนว่าเล่มใดในตะกร้าไม่รองรับวิธีส่งที่ตรงกัน (ให้ลบออกหรือแยกสั่ง)
  - แสดง Skeleton/Loading state จนกว่าข้อมูล `shop` จะโหลดเสร็จก่อนคำนวณวิธีส่งและค่าจัดส่ง

---

### 4. 🟠 [HIGH] ช่องโหว่ Input Validation ใน `POST /api/orders` (`book_ids` ซ้ำ, Non-UUID และ `ship_within_days` Spoofing)

- **ตำแหน่งที่พบ**:
  - Backend: [orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts#L59-L80), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L184-L191), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L278)
- **อาการ / สาเหตุ**:
  1. **Duplicate `book_ids` Bug**: `orders.ts` ไม่ได้เช็ก `Array.isArray(book_ids)` หรือความซ้ำซ้อนของ ID ใน `book_ids` หากส่ง `book_ids: ["uuid-1", "uuid-1"]` มาที่ `createOrder`:
     - `prisma.bookListing.findMany({ where: { id: { in: input.bookIds } } })` จะคืน 1 แถว
     - เงื่อนไข `books.length !== input.bookIds.length` จะผิดพลาดและโยน `404 BOOK_NOT_FOUND` ทั้งที่เล่มนั้นมีอยู่จริง
  2. **ขาดการตรวจ UUID Format**: ทั้ง `seller_id` และ `book_ids[*]` ถูกส่งเข้า Prisma ทันทีโดยไม่ตรวจ UUID Regex (แบบที่เพิ่งแก้ใน `auth.ts`) หาก client ส่ง string ที่ไม่ใช่ UUID หรือ `book_ids` ไม่ใช่ array จะเกิด Prisma `P2023` / `500 Internal Server Error`
  3. **`ship_within_days` Spoofing**: `orders.ts` (L78-L79) รับ `ship_within_days` จาก `req.body` ของผู้ซื้อมาบันทึกลง DB โดยตรง แทนที่จะอ่านจาก `ShopProfile.shipWithinDays` ฝั่ง Server ผู้ซื้อสามารถส่งค่า `0` หรือค่าติดลบเพื่อให้ `shipBy` ใน `acceptOrder` (L599-L603) หมดอายุทันทีได้
- **แนวทางแก้ไข**:
  - Validate `seller_id` (UUID), `book_ids` (non-empty array of unique valid UUIDs; ปฏิเสธด้วย `400` หากซ้ำหรือผิดรูปแบบ)
  - อ่าน `shipWithinDays` / `shipMode` จาก `ShopProfile` ใน DB ฝั่ง Backend แทนการเชื่อค่าจาก `req.body`

---

### 5. 🟠 [HIGH] ช่องโหว่ Concurrency ใน `createOrder` / `acceptOrder` และการ Auto-Reject ข้ามหลายเล่มแบบเงียบ

- **ตำแหน่งที่พบ**:
  - Backend: [orderService.ts (`createOrder`)](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L201-L307), [orderService.ts (`acceptOrder`)](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L519-L611)
- **อาการ / สาเหตุ**:
  1. ใน `createOrder` การตรวจ `books.some(b => b.status !== 'AVAILABLE')` เกิดขึ้น**นอก** `$transaction` ไม่ได้ตรวจซ้ำใน Transaction
  2. ใน `acceptOrder` แม้จะอยู่ใน `$transaction` แต่ใช้ `findUnique` + `updateMany({ where: { id: { in: bookListingIds } } })` โดย**ไม่ได้ใส่เงื่อนไข `status: 'AVAILABLE'` ใน `updateMany` หรือ Row-level Lock (`FOR UPDATE`)** หากผู้ขายกดรับ 2 ออเดอร์ที่มีหนังสือบางเล่มซ้อนกันพร้อมกัน (เช่น Order A = [เล่ม 1, เล่ม 2], Order B = [เล่ม 2, เล่ม 3]) มีความเสี่ยงเกิด Race Condition ตัดเครดิตซ้ำหรือสถานะหนังสือขัดแย้งกัน
  3. **Auto-Reject ไม่แจ้งเตือนผู้ซื้อ**: เมื่อ `acceptOrder` ล็อกหนังสือและอัปเดตออเดอร์คู่แข่งเป็น `REJECTED` (L579-L597) ระบบไม่ได้ส่ง Notification (`notifyOrderEvent`) ให้ผู้ซื้อของออเดอร์ที่ถูกปฏิเสธอัตโนมัติ (เช่น Order B ถูกยกเลิกทั้งใบแม้เล่ม 3 ยังว่างอยู่ ผู้ซื้อไม่รู้ตัวจนกว่าจะเปิดเข้ามาดูเอง)
- **แนวทางแก้ไข**:
  - ใน `acceptOrder` ใช้ Conditional Update: `updateMany({ where: { id: { in: bookListingIds }, status: 'AVAILABLE' }, data: { status: 'RESERVED' } })` และตรวจ `updated.count === bookListingIds.length` (ถ้าไม่เท่าให้ throw `BOOK_NOT_AVAILABLE` เพื่อ Rollback ทันที)
  - ส่ง Notification ให้ผู้ซื้อทุกออเดอร์ใน `rejectedOrderIds` หลัง Transaction สำเร็จ

---

### 6. 🟡 [MEDIUM] ตะกร้า `localStorage` ไม่ผูกกับ User, ข้อมูลหนังสือ/ราคาไม่อัปเดตสด และสูตรค่าส่ง Frontend ไม่ตรงกัน

- **ตำแหน่งที่พบ**:
  - Frontend: [useCart.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useCart.tsx#L17-L108), [useCart.tsx (shippingFee)](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useCart.tsx#L173-L176), [cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx#L124-L126)
  - Backend: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L246-L251)
- **อาการ / สาเหตุ**:
  1. Key `gongdong.cart.v1` ใน `localStorage` เป็น Global ไม่แยกตาม `user.id` หากสลับบัญชีผู้ใช้หรือเปลี่ยน mock token บนเบราว์เซอร์เดียวกัน ตะกร้าของบัญชีเก่าจะค้างอยู่ (และอาจมีหนังสือของตัวเองติดมาจนเจอ error `CANNOT_BUY_OWN_BOOK`)
  2. ตะกร้าเก็บ Object `Book` แบบ Snapshot จึงไม่ซิงค์กับ Backend หากผู้ขายแก้ไขราคา (`PATCH /api/books/:id`), ซ่อนประกาศ (`HIDDEN`), หรือหนังสือถูกขายไปแล้ว (`RESERVED`/`SOLD`) หน้า `/cart` ยังแสดงราคาและรายการเดิม
  3. **ไม่มี Price Drift Guard**: `POST /api/orders` ไม่ได้เช็กราคาที่ผู้ซื้อเห็นล่าสุด (`expected_total` หรือ `expected_prices`) หากผู้ขายแก้ราคาขึ้นก่อนผู้ซื้อกดยืนยัน ระบบจะสร้างออเดอร์ในราคาใหม่ทันทีโดยผู้ซื้อไม่ทราบ
  4. **ค่าส่งใน `useCart` vs `cart/page.tsx` ไม่ตรงกัน**: `useCart.tsx` (L176) เรียก `calcParcelFee(items.length, undefined, selectedAddress?.province)` โดยไม่ส่ง `fromProvince` (คิดต้นทางเป็นภาคกลาง `'C'` เสมอ) ขณะที่ `cart/page.tsx` (L124) ส่ง `shop?.province` ทำให้ค่าส่งเปลี่ยนไป +฿15 หากร้านอยู่คนละภาคกับที่ผู้ซื้ออยู่
- **แนวทางแก้ไข**:
  - ผูก storage key กับ `user.id` (เช่น `gongdong.cart.v1.${user.id}`) หรือล้างเมื่อเปลี่ยนบัญชี
  - เมื่อเข้าหน้า `/cart` ให้ Revalidate หนังสือทุกเล่มกับ `GET /api/books/:id` เพื่ออัปเดตราคา/สถานะล่าสุด
  - ส่ง `expected_total` (หรือ `expected_prices`) ไปให้ Backend ตรวจ หากราคาเปลี่ยนให้แจ้งผู้ซื้อยืนยันใหม่

---

### 7. 🟡 [MEDIUM] ไม่มี Idempotency Guard และ Error ไม่ระบุหนังสือเล่มที่มีปัญหา

- **ตำแหน่งที่พบ**:
  - Frontend: [useV4Orders.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useV4Orders.tsx#L260-L293), [cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx#L129-L186)
  - Backend: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L185-L243)
- **อาการ / สาเหตุ**:
  1. หากตะกร้ามีหลายเล่ม แล้วมีเพียง 1 เล่มที่ไม่ว่าง (`RESERVED`/`SOLD`), ไม่รับส่งพัสดุ, หรือไม่รับ `COD` Backend จะโยน Error กว้างๆ (`หนังสือบางเล่มในตะกร้า...`) โดยไม่ส่ง `conflict_book_ids` กลับมา ทำให้ Frontend ไฮไลต์หรือแนะนำให้ลบเฉพาะเล่มที่มีปัญหาไม่ได้
  2. ไม่มี Idempotency Key ใน `POST /api/orders` หากอินเทอร์เน็ตหลุดระหว่างรอ response หรือมีการ retry คำขอ อาจเกิดออเดอร์ซ้ำซ้อน
- **แนวทางแก้ไข**:
  - ส่ง `details: { invalidBookIds: [...] }` แนบมากับ `AppError` ใน `orderService.ts` เพื่อให้หน้า `/cart` แสดง badge บนเล่มที่มีปัญหาได้ทันที
  - รองรับ `idempotency_key` หรือตรวจ duplicate request ภายในช่วงเวลาสั้นๆ

---

### 8. 🟡 [MEDIUM] การ Hardcode `payment_method: 'COD'` และ Fallback จุดนัดรับ

- **ตำแหน่งที่พบ**:
  - Frontend: [useV4Orders.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useV4Orders.tsx#L275), [cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx#L37-L39,L79)
  - Backend: [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L209-L215)
- **อาการ / สาเหตุ**:
  1. `useV4Orders.tsx` hardcode ส่ง `payment_method: 'COD'` เสมอ ขณะที่ Backend เช็ก `books.some(b => b.codEnabled === false)` -> `COD_NOT_ENABLED` แต่หน้า `cart/page.tsx` และ `mappers.ts` ไม่ได้ตรวจสอบหรือแสดงสถานะ `codEnabled` ของหนังสือแต่ละเล่ม (แม้ปัจจุบัน `useSeller.tsx` L310 จะตั้งค่า `codEnabled: true` ตอนสร้าง แต่ถ้ามีข้อมูล seed/API ที่ `codEnabled: false` จะสั่งไม่ได้เลย)
  2. หน้า `cart/page.tsx` (L79) ใช้ `FALLBACK_POINTS` (`หน้าหอสมุดกลาง มช.`, เชียงใหม่) เมื่อร้านค้ายังไม่มีจุดนัดรับ ขัดแย้งกับ `book/[id]/page.tsx` (L166) ที่ไม่ให้ `offersMeetup` เป็น `true` หาก `shop.meetupPoints.length === 0`

---

### 9. 🟡 [MEDIUM] ปัญหาต่อเนื่องหลังสร้างออเดอร์ (Post-Order Flow & Display)

แม้จะสร้างออเดอร์หลายเล่มสำเร็จแล้ว ยังพบจุดขัดข้องต่อเนื่องในหน้าติดตามออเดอร์:
1. **ขาด UI จัดการสถานะ `ACCEPTED` สำหรับ `MEETUP`** ([orders/[id]/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/page.tsx#L283-L290), [L374-L384](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/orders/[id]/page.tsx#L374-L384)):
   - เมื่อผู้ขายกดรับออเดอร์นัดรับ สถานะจะเปลี่ยนจาก `REQUESTED` ➔ `ACCEPTED` (ไม่ใช่ `SCHEDULED`)
   - แต่หน้า `/orders/[id]` แสดง Panel สำหรับ `ACCEPTED` เฉพาะเมื่อ `order.delivery === 'PARCEL'` เท่านั้น ทำให้ทั้ง Buyer และ Seller ของออเดอร์ `MEETUP` ไม่เห็นปุ่มไปหน้า `/orders/[id]/schedule` จากหน้ารายละเอียดออเดอร์
2. **Hardcode เวลานัดเป็น `T16:00:00.000Z`** ([useV4Orders.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useV4Orders.tsx#L264-L267), [L334](file:///D:/Project/GongDong-Hack-DII/frontend/src/hooks/useV4Orders.tsx#L334)):
   - แปลงวันที่นัดเป็น 16:00 UTC (23:00 น. เวลาไทย) เสมอโดยไม่สัมพันธ์กับช่วงเวลา (`timeLabel`) ที่เลือก ส่งผลให้การคำนวณสิทธิ์แจ้งไม่มาตามนัด (`scheduledAt + 15 นาที` ใน [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1221)) คลาดเคลื่อน และใน `PATCH /api/orders/:id/schedule` ([orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts#L295-L310)) ยังไม่ได้รับ `schedule_date_iso` / `schedule_time_label` จาก body ด้วย
3. **เกรดหนังสือทุกเล่มในออเดอร์แสดงเป็น "เหมือนใหม่" (`LIKE_NEW`)** ([orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L418-L426), [mappers.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/mappers.ts#L581-L587)):
   - `GET /api/orders/:id` ไม่ได้คืนค่า `grade` ของ `bookListing` ทำให้ `mapBackendOrderDetailToV4Order` hardcode `grade: toV4Grade('LIKE_NEW')` ให้หนังสือทุกเล่มในออเดอร์

---

## ลำดับความสำคัญที่แนะนำในการแก้ไข

1. **ระยะเร่งด่วน (อุดช่องโหว่ & แก้บั๊กสั่งซื้อพัง)**:
   - แก้ Backend `POST /api/orders`: validate UUID + unique `book_ids` + ดึง `shipWithinDays` จาก DB + conditional `updateMany` ใน `acceptOrder` + ส่ง notification เมื่อ auto-reject + ป้องกัน race condition นับ `pendingCount`
   - แก้ Frontend `/cart`: กันกรณีหนังสือในร้านเดียวกันมีวิธีส่งขัดแย้งกัน (`!canMeetup && !canParcel`), Revalidate ราคา/สถานะหนังสือตอนเข้า `/cart`, ผูก cart key กับ `user.id`, และเติม Panel สถานะ `ACCEPTED` ของ `MEETUP` ใน `/orders/[id]`
2. **ระยะถัดไป (รองรับ Multi-Seller Checkout เต็มรูปแบบ)**:
   - ปรับ `useCart` ให้เก็บสินค้าแยกกลุ่มตาม `sellerId` (1 ตะกร้ามีได้หลายร้าน) และให้หน้า `/cart` เลือกวิธีจัดส่งแยกต่อร้าน
   - เพิ่ม Endpoint `POST /api/orders/batch` (หรือปรับ Flow ส่งทีละร้านพร้อม UI แสดงสถานะรายร้าน) และทบทวนกฎ `REQUESTED <= 3` ให้รองรับการสั่งหลายร้านพร้อมกัน
