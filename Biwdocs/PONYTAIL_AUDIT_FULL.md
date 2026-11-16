# Full Repository Ponytail Audit (`ponytail-audit`)

> ผลตรวจทั้ง Repository (`frontend/` + `backend/`) เพื่อหา Over-engineering, Dead Code และโค้ดซ้ำซ้อน (ตรวจเฉพาะความซับซ้อนเกินจำเป็น ไม่ใช่ความถูกต้องของ Business Logic) · อัปเดตวันที่ 2026-11-16

## Findings (Biggest Cut First)

- `delete` Prototype mock data & showcase (`mocks/v4.ts`, `mocks/books.ts`, `mocks/seller.ts`, `mocks/shops.ts`, `V4Showcase.tsx`, `design-system/page.tsx`) where `seller.ts` & `shops.ts` have 0 imports and the rest only serve `/design-system`. Remove dead mocks (`seller.ts`, `shops.ts`) and drop `/design-system` showcase if dev gallery is no longer needed. [frontend/src/mocks/](file:///D:/Project/GongDong-Hack-DII/frontend/src/mocks/v4.ts) [frontend/src/components/v4/V4Showcase.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/V4Showcase.tsx) [frontend/src/app/design-system/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/design-system/page.tsx)
- `delete` Unused UI/v4 components in production flows (`MockQr.tsx` has 0 imports anywhere; `DateTimePicker.tsx`, `OrderCard.tsx`, `OrderTimeline.tsx`, `NextActionCard.tsx`, `Skeleton.tsx`, `CreditPackCard.tsx`, `TrustBadge.tsx` are only rendered in `/design-system`). Remove `MockQr.tsx` now and prune the 7 showcase-only components alongside `/design-system`. [frontend/src/components/v4/MockQr.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/MockQr.tsx) [frontend/src/components/ui/OrderCard.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/ui/OrderCard.tsx)
- `delete` Prototype client-side credit ledger simulator (`balanceOf`, `canAcceptOrder`, `spendForAccept`, `refundNoShow`, `topUp`, `signupBonus`, `push`) and duplicate `CREDIT_PACKS` array. Keep only `CREDIT_REASON_LABEL` + `sortLedger` and reuse `CREDIT_PACKAGES` from `catalog.ts`. [frontend/src/lib/creditLedger.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/creditLedger.ts)
- `shrink` Repeated shop-group availability & parcel fee calculation (`availableDays`, `expandShopHourlySlots`, `upcomingDates`, `findFirstFreeDateAndSlot`, `calcParcelFee`) duplicated across `evaluateShopGroup`, `useEffect`, `totals`, `handleSubmit`, and render. Compute once per shop group in a single memoized map. [frontend/src/app/cart/page.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/app/cart/page.tsx)
- `delete` Fake client SVG QR matrix generator (`qr.ts` + inline `<svg>` fallback in `QrPayCard.tsx`) while backend `GET /api/users/me/topup-qr` already returns real PromptPay `qr_data_url`. Use `Number.prototype.toLocaleString` and render a plain loading/error placeholder when `qrDataUrl` is absent. [frontend/src/lib/qr.ts](file:///D:/Project/GongDong-Hack-DII/frontend/src/lib/qr.ts) [frontend/src/components/v4/QrPayCard.tsx](file:///D:/Project/GongDong-Hack-DII/frontend/src/components/v4/QrPayCard.tsx)
- `shrink` Duplicated `buying`/`selling` summary mappers in `getUserOrders` (`includeDetails` branch vs summary branch) in `orderService.ts`. Extract `mapOrderSummaryItem(order, role)` shared by both branches. [backend/src/services/orderService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/orderService.ts#L1210-L1318)
- `shrink` Duplicated `categories` normalization, `_catalogSnapshot` field resolution (`title`/`author`/`originalPrice`), and `seller` select across `mapBookFeedItem`, `getBookListingDetail`, and `getUserBookListings`. Extract `resolveBookMetadata(item)` and `SELLER_SUMMARY_SELECT`. [backend/src/services/bookService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/bookService.ts)
- `shrink` Duplicated `meetupPoints.map` (3 sites), shop response serialization (`getMyShop` vs `upsertMyShop`), and identical `update`/`create` objects in `upsertMyShop`. Extract `formatShopProfile(shop)` and `shopWriteData`. [backend/src/services/shopService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/shopService.ts)
- `shrink` Duplicated `trim().replace(/[-\s]/g, '')` + regex + `AppError` validation for `phone_number` and `promptpay_id`, plus single-implementation `TopupSlipVerifier` DI callback in `userService.ts`. Extract `normalizeDigitField()` and inline the verifier call. [backend/src/services/userService.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/services/userService.ts#L205-L237)
- `yagni` Single-implementation `createAuthMiddleware(options)` factory & `AuthMiddlewareOptions` interface, plus repeated `touchUserLastActive` + `req.user` assignment across `x-user-id`, `mock_`, and LINE token branches. Export `authMiddleware` directly with one `attachUser(req, user)` helper. [backend/src/middlewares/auth.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/middlewares/auth.ts#L189-L286)
- `stdlib` `zod` dependency used solely in `env.ts` to parse `PORT` integer and `NODE_ENV` enum. Validate with `Number.parseInt` and a `Set(['development', 'production', 'test'])` check, then drop `zod`. [backend/src/config/env.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/config/env.ts) [backend/package.json](file:///D:/Project/GongDong-Hack-DII/backend/package.json)
- `delete` Redundant unused order route aliases (`PATCH /:id/ship`, `POST /:id/confirm-receipt`, `POST /:id/missed-meeting`) never called by Frontend (`useV4Orders.tsx` calls `POST /:id/ship`, `POST /:id/complete-delivery`, `POST /:id/report-missed-meeting`). Remove unused alias routes. [backend/src/routes/orders.ts](file:///D:/Project/GongDong-Hack-DII/backend/src/routes/orders.ts#L565-L620)
- `delete` Unused `tailwind-merge` dependency (`^3.7.0`) with zero imports across `frontend/src`. Remove from `frontend/package.json`. [frontend/package.json](file:///D:/Project/GongDong-Hack-DII/frontend/package.json#L27)

---

## Net Removable Summary

- **Lines removable**:
  - **~2,970 lines** total if removing `/design-system` showcase + its unused mock/showcase files (`~2,545` lines Frontend + `~205` lines Backend + `~220` lines related test/barrel cleanup), **or**
  - **~630 lines** if keeping `/design-system` showcase intact (`355` lines pure dead code `mocks/seller.ts`, `mocks/shops.ts`, `MockQr.tsx` + `~275` lines of duplication/boilerplate across `cart/page.tsx`, `creditLedger.ts`, `qr.ts`, `orderService.ts`, `bookService.ts`, `shopService.ts`, `userService.ts`, `auth.ts`, `env.ts`, `routes/orders.ts`).
- **Dependencies removable (2)**:
  - `tailwind-merge` in [frontend/package.json](file:///D:/Project/GongDong-Hack-DII/frontend/package.json) (0 imports)
  - `zod` in [backend/package.json](file:///D:/Project/GongDong-Hack-DII/backend/package.json) (only used in `env.ts`)

---

## หมายเหตุเปรียบเทียบกับรอบตรวจก่อนหน้า (`PONYTAIL_AUDIT_BACKEND.md`)

- `backend/src/services/promptPayService.ts` + `promptpay-qr` + `qrcode` ใน [PONYTAIL_AUDIT_BACKEND.md](file:///D:/Project/GongDong-Hack-DII/Biwdocs/PONYTAIL_AUDIT_BACKEND.md) **ไม่เป็น Dead Code แล้ว** เพราะตอนนี้ถูกใช้งานจริงโดย `getTopupPaymentQr` (`userService.ts`) และ `getOrderPaymentQR` (`orderService.ts`)
- ฝั่ง Backend ยังเหลือรายการ `shrink`/`stdlib`/`yagni` ใน `shopService.ts`, `bookService.ts`, `userService.ts`, `auth.ts`, `env.ts`, `routes/orders.ts` และ `getUserOrders` ใน `orderService.ts` ที่ยังสามารถยุบเพิ่มเติมได้ตามรายการด้านบน
