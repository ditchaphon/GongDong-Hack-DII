# แผนปรับปรุงระบบลงขายหนังสือเป็นชุด (MVP Edition — คนใช้ไม่งง)

> แผนฉบับกระชับสำหรับ **MVP** ที่ตัดความซับซ้อนและงานแก้ Schema ที่ยังไม่จำเป็นออก เหลือเฉพาะจุดที่แก้ปัญหาความสับสนจริงของทั้งผู้ขายและผู้ซื้อ (**ไม่ต้องแก้ Prisma Schema / ไม่ต้อง Migrate DB**) · อัปเดตวันที่ 2026-11-16

---

## 1. สิ่งที่ "ตัดออก" ในรอบ MVP (ไม่ทำตอนนี้)

- **ตัดระบบแยกประเภทชุด (`setType`: `SERIES` vs `MIXED`) และตาราง `setBooks` JSONB** — ไม่เพิ่มคอลัมน์ใหม่ใน Database และไม่สร้างฟอร์มเพิ่มหนังสือทีละเล่ม (ถ้าผู้ขายอยากขายมัดรวมหลายเรื่อง สามารถระบุ `จำนวนเล่มในชุด` + พิมพ์รายชื่อเล่มในช่อง `"รายละเอียดเพิ่มเติม"` ได้เลย)
- **ตัด UI เลือกเล่มที่ขาดแบบ Range/Parser ใหม่** — ใช้ BottomSheet เดิมใน Step 1 (เพิ่มแค่ข้อความสรุปจำนวนเล่มจริง + เช็กไม่ให้เหลือน้อยกว่า 2 เล่ม)
- **ตัดตัวเลือกเลขเล่มแยกใน Step 4 (เช็กตำหนิ 5 ข้อ)** — ใช้ช่อง `"อธิบายจุดตำหนิเพิ่มเติม"` เดิมให้พิมพ์ระบุเลขเล่มที่มีตำหนิได้ทันที

---

## 2. ปัญหาจริงที่ต้องแก้ใน MVP (Cause Real User Confusion)

1. **ผู้ซื้อไม่เห็นว่าชุดขาดเล่มไหน**: `missingVolumes` ถูกบันทึกและส่งจาก Backend แล้ว **แต่ `mappers.ts` ไม่ได้ map และ `/book/[id]` ไม่ได้แสดง** ทำให้ผู้ซื้อนึกว่าได้ครบชุด
2. **สแกน ISBN แล้วราคาปกถูกล็อกเป็นราคา 1 เล่ม**: ใน `details/page.tsx` ถ้าสแกน ISBN เล่ม 1 (`฿95`) ช่อง `originalPrice` ถูกล็อก ทำให้ Step 5 แนะนำราคาทั้งชุด 10 เล่มเหลือ `฿57`
3. **คำแนะนำใน Wizard ทำให้ผู้ขายงง**:
   - Step 1 เขียนว่า `"สแกนบาร์โค้ดทุกเล่ม"` ทั้งที่สแกนได้แค่ 1 เล่ม
   - Step 3–4 ไม่มีคำแนะนำการถ่ายรูปทั้งชุดและเกณฑ์ให้เกรดชุด (ประเมินจากเล่มที่สภาพต่ำสุด)
4. **ค่าส่งพัสดุชุดคิดแค่ `฿50` เหมือน 1 เล่ม**: `calcParcelFee` นับจำนวน listing (`books.length = 1`) ทำให้ส่งชุด 10 เล่มคิดค่าส่งเท่ากับ 1 เล่ม
5. **ISBN Smart Compare เทียบชุดกับเล่มเดียว**: `getBookIsbnComparison` จับคู่ด้วย `isbn` อย่างเดียวโดยไม่แยก `isSet` ทำให้ชุด `฿900` โดนเทียบกับเล่มเดียว `฿90`

---

## 3. แผนพัฒนา MVP (Zero DB Migration)

### ส่วนที่ 1: Backend ([bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts), [shippingService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/shippingService.ts), [orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts))
1. **Validation ชุดหนังสือ (`bookService.ts`)**:
   - เมื่อ `isSet === true`: ตรวจ `totalVolumes >= 2` และจำนวนเล่มที่มีจริง (`actualVolumes = totalVolumes - missingVolumes.length`) ต้อง **`>= 2`** (ป้องกันกรณีแจ้งขาดจนเหลือ 0–1 เล่ม)
2. **แยกเทียบใน ISBN Smart Compare (`bookService.ts` -> `getBookIsbnComparison`)**:
   - เพิ่มเงื่อนไข `isSet: current.isSet` ใน `where` ของ `siblings` เพื่อเทียบเฉพาะ **ชุดกับชุด** และ **เล่มเดียวกับเล่มเดียว** (พร้อมคืน `totalVolumes` และ `missingVolumes` ใน offer เมื่อ `isSet = true`)
3. **ค่าส่งพัสดุตามจำนวนเล่มจริง + เพดาน `฿150` (`shippingService.ts` + `orderService.ts`)**:
   - ปรับ `calcParcelFee(bookUnits)` เป็น `bookUnits <= 0 ? 0 : Math.min(150, 50 + (bookUnits - 1) * 10)`
   - ใน `createOrderInTx`: นับ `bookUnits` ของแต่ละรายการเป็น `isSet ? Math.max(1, (b.totalVolumes ?? 2) - b.missingVolumes.length) : 1`

### ส่วนที่ 2: Seller Flow — ปรับให้ชัด ไม่สับสน (`isSet === true`)
1. **Step 1 ([seller/list/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/list/page.tsx))**:
   - เปลี่ยนหัวข้อสแกนจาก `"สแกนบาร์โค้ดทุกเล่ม"` เป็น `"สแกนบาร์โค้ดเล่มตัวแทน (เช่น เล่ม 1)"`
   - แสดงตัวเลขชัดเจนในการ์ดชุด: `"ต้องการขาย X เล่ม"` (คำนวณจาก `totalVolumes - missingVolumes.length`) และกันไม่ให้กดถัดไปหากเหลือ `< 2` เล่ม
2. **Step 2 ([seller/list/details/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/list/details/page.tsx))**:
   - เมื่อ `isSet === true`: **ปลดล็อกช่อง `originalPrice`** ให้กรอก/แก้เป็นราคามือหนึ่งรวมทั้งชุดได้
   - ถ้าได้ราคาปกของ 1 เล่มมาจาก ISBN ให้ขึ้นปุ่มกดเร็ว 1 ครั้ง: `"ใช้ราคา ฿{perBook} × {actualVolumes} เล่ม = ฿{total}"`
3. **Step 3 — ถ่ายรูป 4 มุม ([seller/list/step-2/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/list/step-2/page.tsx))**:
   - ปรับคำอธิบายทั้ง 4 ช่องให้เข้าใจทันทีเมื่อ `isSet === true`:
     - `ภาพรวมหน้าปกทั้งชุด` — วางเรียงให้เห็นปกครบทุกเล่มที่มีจริง
     - `ปกหลัง / ขอบกระดาษรวม` — เห็นขอบบน-ข้างเทียบสีกระดาษทั้งกอง
     - `สันหนังสือเรียงทุกเล่ม` — เรียงให้เห็นเลขเล่มและความหนาครบทุกเล่ม
     - `ตัวอย่างหน้าด้านใน` — เปิดเล่มตัวอย่าง (แนะนำเล่มที่กระดาษเหลืองสุด)
4. **Step 4 — เช็กสภาพ 5 ข้อ ([seller/list/step-3/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/list/step-3/page.tsx))**:
   - เพิ่มแบนเนอร์แนะนำด้านบนเมื่อ `isSet === true`: `"เกณฑ์สำหรับขายชุด: ให้คะแนนตามเล่มที่มีสภาพต่ำสุดในชุด เพื่อไม่ให้ผู้ซื้อผิดหวัง"`
   - ปรับ placeholder ช่องหมายเหตุตำหนิให้ชวนระบุเลขเล่ม (เช่น `"เช่น เล่ม 3 มุมปกพับ, เล่ม 5 มีไฮไลต์ 2 หน้า"`)
5. **Step 5 — ตั้งราคา & สรุปค่าส่ง ([seller/list/step-4/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/seller/list/step-4/page.tsx))**:
   - แสดง **ราคาเฉลี่ยต่อเล่ม (`เฉลี่ย ~฿X/เล่ม`)** แบบเรียลไทม์ใต้ช่องราคาขาย
   - แสดงประมาณการค่าส่งพัสดุของชุดตาม `actualVolumes` (เพดาน `฿150`)

### ส่วนที่ 3: Buyer Flow — โปร่งใส เห็นครบก่อนสั่งซื้อ
1. **Types & Mappers ([types/index.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/types/index.ts), [lib/mappers.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/mappers.ts))**:
   - Map `missingVolumes` ใน `mapBackendBookToBook`, `mapBackendBookDetailToBook`, `mapBackendUserBookToSellerListing`
   - เพิ่ม helper `countActualVolumes()` และ `countOrderBookUnits()` ใน [lib/delivery.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/delivery.ts) (ใช้ `Math.min(150, 50 + (units - 1) * 10)` ตรงกับ Backend)
2. **BookCard ([BookCard.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/ui/BookCard.tsx))**:
   - แสดง badge จำนวนเล่มจริง: `"ชุด X เล่ม"` (หรือ `"ชุด X/Y เล่ม"` ถ้าขาดบางเล่ม)
3. **หน้ารายละเอียดสินค้า ([book/[id]/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/book/%5Bid%5D/page.tsx))**:
   - แสดง **ราคาเฉลี่ยต่อเล่ม (`~฿X/เล่ม`)** ข้างราคาขาย
   - ถ้า `missingVolumes.length > 0` แสดงกล่องเตือนสีส้มชัดเจน: `"ชุดนี้ขาดเล่ม: 4 (ได้รับจริง 4 จาก 5 เล่ม)"`
   - แสดงค่าส่งพัสดุเริ่มต้นตามจำนวนเล่มจริงของชุดนั้น (ไม่แสดง `฿50` ค้างเหมือนเล่มเดียว)
   - ใน **ISBN Smart Compare**: แสดงหัวข้อ `"เทียบกับชุดอื่น (ISBN เดียวกัน)"` และ badge `ยกชุด X เล่ม`
4. **ตะกร้าสินค้า ([cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx))**:
   - ใช้ `countOrderBookUnits(group.items)` ส่งเข้า `calcParcelFee` และแสดง tag จำนวนเล่ม/เล่มที่ขาดใต้ชื่อชุด

---

## 4. รายการตรวจสอบก่อนปิดงาน (Verification)

1. `npm --prefix backend test` (เพิ่มเคส `shippingService.test.ts` เพดาน `฿150`, `bookService.test.ts` `actualVolumes < 2` และ `isSet` filter ใน `getBookIsbnComparison`, `orderService.test.ts` ค่าส่งชุดตาม `actualVolumes`)
2. `npm --prefix backend run build`
3. `npm --prefix frontend run lint` และ `npm --prefix frontend run build`
4. `npm --prefix frontend run test:ui-snapshots` ตรวจภาพ `/seller/list/*`, `/book/[id]`, `/cart`
