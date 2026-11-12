# GongDong — Current Flow (what the app actually does)

Last updated: 13 พ.ย. 2569 · Source: `frontend/src/app` route tree.

Entry point for everything: `https://liff.line.me/<LIFF_ID>/<path>`
(LIFF ID is not set yet, so local dev runs `NEXT_PUBLIC_LIFF_MOCK=true`.)

---

## 1. Entry

| Screen | Route | Notes |
|---|---|---|
| Home / feed | `/` | Search bar → `/search`, category chips, book feed, cart + bell in header |
| Onboarding (first open, B0) | `/onboarding` | 3 value props → "เริ่มซื้อ" or "เริ่มขาย" (`/seller`) |
| Deep links | any route under `/` | Every page is addressable, so Rich Menu / Flex can open it directly |

We do **not** have a separate 2-button landing page: `/` is already the buyer feed
(B1 in Figma), and the seller side starts from the bottom tab "ร้านของฉัน".

---

## 2. Buyer flow (Phase 2 — done)

```
/ (feed)
 └─ /search          search + filters (category, grade, price, delivery)
     └─ /book/[id]   detail → add to cart / send request
         └─ /seller/[sellerId]   seller shop page
 └─ /cart           cart + delivery method (meetup zone/time or parcel address)
     └─ /cart/success   request sent
 └─ /orders          buyer orders (tabs, empty state)
     └─ /orders/[id]      status timeline, contact, attach slip, cancel, call
         └─ /orders/[id]/review   rating after completion
 └─ /wishlist        "ฝากตามหา" + saved search
 └─ /notifications   notification center
 └─ /addresses       address list (max 5)
     └─ /addresses/edit
```

Search filters live on `/search` (chips + price/zone sheets), not a separate
`/browse` page. Card → detail works exactly as your friend described.

---

## 3. Seller flow (Phase 3 — done)

```
/seller                        shop hub (S4L / S4W / S4C)
 ├─ /seller/verify             S1 identity + PromptPay verification
 ├─ /seller/list               S2 / S2B  single vs set + ISBN scan (+ S2M / S2N sheets)
 │   ├─ /seller/list/step-2    S3P / S3PB 4 mandatory photos + defect photos
 │   ├─ /seller/list/step-3    S3C / S3CB 5-point check → auto grade
 │   ├─ /seller/list/step-4    S3 / S3B   price + suggested price + delivery
 │   └─ /seller/list/success   S3S        published + share
 ├─ /seller/orders             S4  seller orders (new / active / done)
 │   ├─ /seller/orders/[id]/accepted    S4B  accept (-1 credit) → phone unlocked
 │   ├─ /seller/meetup/[id]             S6   meetup day / parcel + tracking / close sale
 │   │   └─ /seller/meetup/[id]/closed  S7   sale closed
 │   └─ /seller/report                 S6R  report problem
 │       └─ /seller/report/sent        S6RS report sent
 └─ /seller/credits            S5  3 packages (฿20=3 · ฿50=10 · ฿100=25)
     ├─ /seller/credits/pay    S5Q QR + slip upload
     └─ /seller/credits/success S5OK new balance
```

First-time seller: `/seller` shows the amber "ยืนยันตัวตน" banner; `/seller/list`
is gated by an empty state pointing to `/seller/verify`. After verification the
seller gets the free-credit toast.

---

## 4. Orders tab (both sides)

`/orders` currently lists **buyer** orders; `/seller/orders` lists **seller**
orders. Your friend's "แท็บ ที่ซื้อ / ที่ขาย" would merge them into one page with
two tabs — not built yet (see gaps).

Each order detail already has: status timeline, contact card (hidden until the
seller accepts), call modal, attach slip (parcel), cancel, "ได้รับหนังสือแล้ว" →
rating. Meetup/parcel details are shown from the order object.

---

## 5. Rules the flow enforces

- **Free to list**; 1 credit is spent only when the seller taps รับออเดอร์
  (`/seller/orders` → S4A). Rejecting costs nothing.
- **No escrow**: buyer pays at meetup or transfers to the seller's PromptPay and
  attaches a slip. No platform wallet exists in the UI.
- **Phone numbers unlock after acceptance only** (buyer sees seller's number,
  seller sees buyer's number on S4B/S6).
- **Photos**: 4 mandatory (front, back, spine, name-tag) + defect photos.
- **Condition**: 5-point check → 4 grades A/B/C/D → suggested % of cover price.
- **Admin is not LIFF**: it will live under `/admin` in Phase 5.

---

## 6. Difference vs your friend's outline

| Friend's route | Ours today | Status |
|---|---|---|
| `/` = 2 big buttons (ซื้อ / ขาย) | `/` = buyer feed; seller via bottom tab | Different, deliberate (feed sells faster) |
| `/browse` + search + filters | `/` + `/search` | ✅ exists, different path |
| `/books/[id]` | `/book/[id]` | ✅ exists, singular path |
| `/sell` (4-step wizard) | `/seller/list` + `step-2..4` + `success` | ✅ exists, different path |
| "ยังไม่มีร้าน → ตั้งชื่อร้าน + จุดนัดรับ 1 นาที" | `/seller/verify` covers identity + PromptPay + phone; no shop-name/create-shop step | ⚠️ missing shop-creation screen |
| `/orders` with tabs ที่ซื้อ / ที่ขาย | `/orders` (buyer) + `/seller/orders` (seller) | ⚠️ split, not tabbed |
| Chat inside order after accept | Phone call + LINE OA link only | ⚠️ no in-app chat |
| QR pay button in order | Slip upload only; QR exists in top-up (`/seller/credits/pay`) | ⚠️ no buyer-side QR payment screen |
| Pickup code (รหัสรับของ) | Not built | ⚠️ missing |
| `/shop` (shop hub) | `/seller` | ✅ exists, different path |
| Shop tabs กำลังขาย / ติดจอง / ขายแล้ว | `/seller` tabs: ประกาศของฉัน / รอชำระเงิน / ปิดการขาย | ✅ close enough, labels differ |
| Edit / hide listing | Not built (view only) | ⚠️ missing |
| Reviews on shop page | Rating shown on book cards; no review list | ⚠️ missing |
| Shop settings (meetup zones, shipping on/off, PromptPay) | Collected once in `/seller/verify`; not editable | ⚠️ missing settings page |
| "แถบเตือน เติมเครดิตครั้งแรกเพื่อเปิดรับเงินโอน" | Amber verify banner instead | Different copy/trigger |
| `/shop/credits` | `/seller/credits` | ✅ exists, different path |
| `/help` (buy/sell guides, safety, grades, credits, FAQ, contact) | Not built | ⚠️ missing |

Legend: ✅ present (maybe under a different route) · ⚠️ not built.

---

## 7. What to decide with your friend

The real differences are **not** paths, they are these five product decisions:

1. **Landing page**: buyer feed first (current) or two big buttons (friend's)?
   Two buttons add a tap before every purchase; a feed converts better in a demo.
2. **One orders page with tabs** vs two pages. Merging is ~1 page + a tab switch,
   and it matches the buyer's mental model.
3. **In-app chat in the order**: real work (needs server + realtime). Until then
   phone + LINE OA is honest and cheap.
4. **Buyer QR payment / pickup code**: with no escrow, these only make sense if
   you keep a platform-held flow. Current flow is direct-to-seller.
5. **`/help` content**: pure writing, no backend. Cheap and useful for UAT.

If you want, we can align paths by adding thin aliases (`/browse`, `/sell`,
`/shop`, `/shop/credits`) so the friend's links work without changing the
existing screens, then build `/help` and the merged `/orders` tabs in Phase 4.5.
