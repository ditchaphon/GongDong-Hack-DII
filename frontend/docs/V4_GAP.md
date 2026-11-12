# V4_GAP.md — Phase 0 audit (KEEP / CHANGE / DELETE / NEW)

Status: **Phase 0 deliverable.** No code has been changed.
Audited at: 13 พ.ย. 2569 · repo `frontend/` (Next.js 16 App Router, TS, Tailwind v4)

> ⚠️ **Source limitation:** `docs/GongDong-User-Flow-v4.md` is still **not in the
> repo** (no root `docs/`; `frontend/docs/` has AUDIT, FLOW, this prompt). This
> audit is therefore based on the v4 rules summarised in
> `GongDong-Antigravity-UXUI-Prompt.md` §1, §4, §5, §5.8. When the real v4 file
> arrives, re-check the rows marked `v4?` below and the read-back in §1.

---

## 0. The 15-line v4 read-back

1. GongDong is a second-hand book marketplace that lives entirely inside LINE (OA, Rich Menu, LIFF, Flex Messages).
2. v4's promise: everything ends in GongDong — chat, schedule, pay, handover, ship, review, report.
3. The only time a user leaves is opening the bank app to transfer, then returning to upload the slip.
4. There is no escrow; money goes buyer → seller directly, and GongDong never holds or guarantees money.
5. Trust replaces escrow: real watermarked photos, 5-point check, 4 grades, verified payee from a real slip, masked chat, handover code, reviews, admin disputes.
6. No personal contact is ever shown: no phone, LINE ID, LINE name/photo, bank account, or slip real name. Users set a nickname + avatar.
7. Sellers start light: shop setup (name, map pin, shipping on/off, real name + PromptPay, PDPA) and can list immediately.
8. Seller verification happens at the first order: top up credits from their own bank, the slip payer name becomes the verified name and must match PromptPay.
9. Listing is free; 1 credit is spent only when the seller accepts. Reject is free. New users get 1 credit; packs ฿20=3, ฿50=10, ฿100=25.
10. Buyers may hold max 3 open requests; a request does not lock the book; accepting one locks it and auto-rejects the others.
11. Parcel flow: accepted → QR pay + slip (auto-checked) → PAID → carrier + tracking + box photo within 48h → SHIPPED → received or auto-complete after 7 days.
12. Meetup flow: accepted → seller proposes time + map pin + landmark in chat → buyer confirms → inspect, pay (QR or cash), then buyer shows a 6-digit code and the seller types it to complete.
13. Timers: 24h accept, 24h pay (parcel), 48h ship, 7-day auto-complete, 48h after meetup; DISPUTED stops everything.
14. Special cases are explicit: no-show (only 15–30 min after the time, buyer has 24h to dispute), book not as graded at meetup (cancel, credit not refunded), seller no-ship → dispute → admin.
15. Admin is a separate desktop app (slip queue, dispute view showing chat/slips/photos, shop reports, users + blacklist); LINE assets (Rich Menu + Flex templates) are spec-only with no real API calls.

---

## 1. Audit method

Every route in `src/app`, every component in `src/components`, plus hooks,
mocks, types, styles and env config was checked against v4.

**Verdicts**
- **KEEP** — behaviour already matches v4; only copy/visual polish later.
- **CHANGE** — screen stays but behaviour, data, states or copy must change.
- **DELETE** — must be removed (contradicts v4 or is replaced).
- **NEW** — does not exist yet.

`v4?` marks a decision that depends on the missing rulebook.

---

## 2. Route audit

### 2.1 Entry, account, shared

| Route | What exists today | Verdict | Change needed / phase |
|---|---|---|---|
| `/onboarding` | 3 value props, buttons → `/` and `/seller`; stores `has_seen_onboarding` in `localStorage` | **CHANGE** | Buttons must lead to nickname/avatar setup first; drop `localStorage`-only gating (server session), v4 copy. Phase 2 |
| `/` | Buyer feed, search bar → `/search`, category chips, trust banner, book grid, cart/bell header, LIFF menu sheet | **KEEP** | Keep layout; add shop badge/verified state on cards; remove any trust claim phrasing that reads as a guarantee. Phase 2 |
| `/search` | Search + filter chips, book grid | **CHANGE** | Add course/ISBN search and single/set filter; keep grade/price/delivery filters. Phase 2 |
| `/book/[id]` | Detail with cover gallery sheet, grade, checklist, seller card, add-to-cart | **CHANGE** | 4-photo watermarked gallery, defect photos, "Report shop", verified badge, no seller personal data, price-vs-new per v4. Phase 2 |
| `/seller/[sellerId]` | Public shop page with seller rating and book grid | **CHANGE** | Becomes shop page: rating, **review list**, verified badge, report shop. Phase 2 |
| `/notifications` | Notification list with links | **KEEP** | Keep; map new order/chat/slip events later. Phase 2/4 |
| `/wishlist` | Wishlist list + add/edit sheets | **KEEP** | Keep as-is. Phase 2 |
| `/addresses` | Address list, default badge, delete confirm | **KEEP** | Keep; receiver phone visible only to seller in PAID/SHIPPED. Phase 2 |
| `/addresses/edit` | Address form with phone field | **KEEP** | Keep the form (buyer's own phone is required for delivery) — v4 only forbids showing it to the *other party*. Phase 2 |
| `/design-system` | Component gallery, includes a phone-number input demo | **CHANGE** | Extend with v4 blocks; remove contact-number demos from the gallery. Phase 1 |
| `/debug` | LIFF diagnostics: in-client, OS, version, friendship, masked uid | **KEEP** | Keep; ensure it is dev/staging gated. Phase 1 |
| `/api/auth/line` | Stub that reads the ID token and returns a mock session | **KEEP** | Keep as stub; add session + PDPA consent fields later. Phase 1 |
| `/_not-found` | Framework default | **KEEP** | Later design pass. Phase 7 |

### 2.2 Cart & buyer orders

| Route | What exists today | Verdict | Change needed / phase |
|---|---|---|---|
| `/cart` | One shop's cart (rejects other sellers), meetup/parcel choice, zone + time sheets, address sheet, price breakdown, submit | **CHANGE** | Split by shop (1 shop = 1 order), unverified-shop notice (meetup + cash only), 3-open-request limit message, parcel fee ฿40 + ฿10/extra book, remove zone list in favour of pin later, no phone exposure. Phase 2 |
| `/cart/success` | "Request sent" confirmation | **CHANGE** | Copy must say the request does not lock the book and others may request it. Phase 2 |
| `/orders` | Buyer-only order list with 3 status tabs | **CHANGE** | One page with tabs **ที่ซื้อ / ที่ขาย**, red dot for actions waiting on me, no "buyer-only" assumption. Phase 4 |
| `/orders/[id]` | Buyer order detail: status stepper, 48h countdown, **seller phone + call modal**, delivery card, slip sheet, cancel modal, "received" → review | **CHANGE (major)** | New status machine + timeline + "who must act + time left"; **DELETE phone card and CALL modal**; add chat, pay-by-QR, schedule, handover-code, tracking, report entries. Phase 4 |
| `/orders/[id]/review` | Star rating + comment for seller | **CHANGE** | Add "condition matches grade?" and make it shop review + buyer rating per v4. Phase 4 |

### 2.3 Seller

| Route | What exists today | Verdict | Change needed / phase |
|---|---|---|---|
| `/seller` | Shop hub: avatar/name, credits, stats, verify banner, listing tabs (listings / waiting / closed), `BottomTab` | **CHANGE** | Shop header with rating, successful sales, verified badge; tabs selling / reserved / sold; edit/hide listing; reviews; settings entry. Phase 3 |
| `/seller/verify` | Heavy KYC screen (name, phone, PromptPay, bank, rules tick) | **DELETE** | Replaced by light **shop setup**; verification moves to first-order top-up gate. Phase 3 |
| `/seller/list` | Wizard step 1: single/set, ISBN scan + manual ISBN sheet + manual info sheet, verification gate empty state | **CHANGE** | Keep the wizard mechanics; new route naming allowed; add 10/day rate-limit message; drop gate that blocks listing before shop setup (setup is the gate now). Phase 3 |
| `/seller/list/step-2` | 4 mandatory photos + defect photos, PHOTO/DEFECT sheets, mock "fill sample photos" button | **CHANGE** | Name tag = **shop name + date only**, system watermark, webp ≤1080px compression, example images; sample-photo helper must not exist in production. Phase 3 |
| `/seller/list/step-3` | 5-point checklist, live grade A–D, GRADE criteria sheet | **KEEP** | Keep logic; rename grades and show v4 simple Thai labels. Phase 3 |
| `/seller/list/step-4` | Price input, PriceSuggest 70/60/45/30, meetup/parcel, parcel fee, COD toggle | **CHANGE** | Percentages → **75/60/45/30**; unverified shops = meetup + cash only; COD is not in v4. Phase 3 |
| `/seller/list/success` | Success summary, share via shareTargetPicker → copy link | **KEEP** | Keep; ensure copy has no guarantee wording. Phase 3 |
| `/seller/orders` | Seller order list with tabs, accept sheet (S4A), reject sheet, no-credit modal | **CHANGE** | Merge into `/orders` tab "ที่ขาย"; show buyer nickname/avatar/rating/no-show history only; competing-request explanation. Phase 4 |
| `/seller/orders/[id]/accepted` | Success + **buyer phone + call modal** + LINE OA chat link + next steps | **CHANGE (major)** | **DELETE phone + CALL**; replace with "chat opened" + next action; first-order path routes through verification gate. Phase 4 |
| `/seller/meetup/[id]` | Meetup detail, share, **call modal**, parcel slip + tracking input, close-sale modal | **CHANGE** | Meetup becomes propose/confirm time + **map pin**, handover-code entry, "received cash", no-show enabled 15–30 min after time; parcel becomes shipping form (carrier + tracking + box photo) with 48h countdown; remove call. Phase 4 |
| `/seller/meetup/[id]/closed` | Sale-closed summary (earnings, order, next actions) | **CHANGE** | Completion must come from handover code / buyer received; keep summary without contact data. Phase 4 |
| `/seller/report` | Report form: order select, reasons, 10-char detail, evidence photo | **CHANGE** | Unify with order dispute entry; reasons/timers per v4; DISPUTED stops timers. Phase 4 |
| `/seller/report/sent` | Case number + what happens next | **KEEP** | Keep; wording must not promise outcomes. Phase 4 |
| `/seller/credits` | Credit balance + 3 packages + selection | **CHANGE** | Add ledger/history; first top-up becomes verification step. Phase 3 |
| `/seller/credits/pay` | Mock QR, PromptPay id, copy button, 30-min countdown, slip upload | **CHANGE** | Real QR payload + name-check warning; slip **result states** (checking / passed / failed / to admin); never show public slip URL. Phase 3 |
| `/seller/credits/success` | "Credits added" + new balance (mock auto-approve) | **CHANGE** | Must show pending / approved states instead of instant credit; remove auto-approve note logic. Phase 3 |

### 2.4 Missing routes (NEW)

| Screen | Proposed route | Phase |
|---|---|---|
| Nickname + avatar + PDPA consent | `/setup` | 2 |
| Help: how to buy/sell, safety, grades, credits, FAQ, contact | `/help` | 2 |
| Shop setup (light KYC entry) | `/shop/setup` | 3 |
| Shop settings (pin, shipping, PromptPay re-verify) | `/shop/settings` | 3 |
| Edit / hide listing | `/shop/listings/[id]/edit` | 3 |
| Incoming request detail + first-order verification gate | `/shop/requests/[id]`, `/verify` | 4 |
| Order chat (masked, read-only after COMPLETED) | `/orders/[id]/chat` | 4 |
| Pay by QR + slip result | `/orders/[id]/pay` | 4 |
| Meetup schedule: time + map pin | `/orders/[id]/schedule` | 4 |
| Handover code (buyer) / code input (seller) | `/orders/[id]/handover` | 4 |
| Parcel tracking + shipping form | `/orders/[id]/tracking` | 4 |
| No-show + rebuttal | `/orders/[id]/no-show` | 4 |
| Admin: overview, slip queue + review, disputes, shops, users/blacklist | `/admin/**` | 5 |
| Flex template preview + Rich Menu spec | `/line-preview` | 6 |

---

## 3. Component audit

### 3.1 Layout

| Component | Verdict | Note |
|---|---|---|
| `AppShell` | **CHANGE** | Keep safe areas + external-browser banner; fix OA link to prepend `@`; base URL from `NEXT_PUBLIC_APP_URL`. |
| `TopBar` | **KEEP** | Back handling is fine. |
| `BottomTab` | **CHANGE** | v4 navigation: home / orders (buying+seller) / wishlist / shop; drop cart-only emphasis; badge counts actions waiting on me. |

### 3.2 UI primitives

| Component | Verdict | Note |
|---|---|---|
| `Button`, `Chip`, `Input`, `SearchBar`, `BottomSheet`, `Modal`, `Toast`, `Stepper`, `Countdown`, `EmptyState`, `Skeleton` | **KEEP** | Keep, add missing loading/error variants where v4 needs them. |
| `TrustBadge` | **CHANGE** | Tap → reasons; no guarantee/100% wording. |
| `StatusBadge` | **CHANGE** | Replace `OrderStatus` union with the v4 state machine (see §4.1). |
| `BookCard` | **KEEP** | Keep; add verified shop + grade label updates. |
| `OrderCard` | **CHANGE** | Needs "who acts next", time left, chat/pay shortcuts; remove buyer/seller phone logic. |
| `GradeBadge` | **CHANGE** | A–D labels → LIKE_NEW / GENTLY_READ / WELL_LOVED / WORN_BUT_READABLE with Thai labels from `V4_COPY.md`. |
| `ConditionChecklist` | **KEEP** | Keep 5 points; grade calculation percentages change. |
| `PriceSuggest` | **CHANGE** | 70 → **75 %** for LIKE_NEW; labels per v4. |
| `PhotoUploader` | **CHANGE** | Compress webp ≤1080px, watermark, progress + retry, no public slip URL, name-tag rule text. |
| `Modal` | **KEEP (usage DELETE)** | Component stays; **CALL usage must be deleted** from order/seller/meetup screens. |
| `index.ts` barrel | **KEEP** | Extend with new components. |

### 3.3 Hooks

| Hook | Verdict | Note |
|---|---|---|
| `useLiff` | **CHANGE** | Keep SDK/mock split and scan/share fallbacks; **MOCK_USER contains phone + PromptPay name** → remove contact fields; add OA id handling (`@`), `NEXT_PUBLIC_APP_URL`; keep friendship as silent check. |
| `useCart` | **CHANGE** | Single-shop rejection stays; add per-shop split model, 3-open-request limit, unverified-shop rule, remove meetup zone list in favour of schedule/pin. |
| `useListing` | **CHANGE** | Keep draft wizard; add watermark/compression flags, rate-limit state, name-tag = shop name + date, 75 % suggestion. |
| `useSeller` | **CHANGE** | Remove `isVerified` heavy KYC state → shop setup state + first-order verification; remove buyer phone from accepted order; align statuses; add credit ledger. |

### 3.4 Data, types, config

| Item | Verdict | Note |
|---|---|---|
| `types/index.ts` `OrderStatus` | **CHANGE** | New union: REQUESTED, ACCEPTED, SCHEDULED, PAID, SHIPPED, COMPLETED, REJECTED, EXPIRED, CANCELLED, DISPUTED. Current PENDING_ACCEPT / WAITING_PAYMENT / PAYMENT_SUBMITTED / PREPARING_SHIPPING / MEETUP_CONFIRMED / REPORTED all disappear. |
| `types` `Order` | **CHANGE** | Add handoverCode (buyer-side), schedule {time, lat/lng, landmark}, shipping {carrier, tracking, boxPhoto}, verification state, dispute, no-show; remove implicit phone fields. |
| `types` `Book` / `SellerListing` | **CHANGE** | Watermark + shop tag metadata; reviews; hidden state. |
| `types` `UserProfile` | **CHANGE** | nickname/avatar; `phone`/`promptPayName` only for own payout settings, never rendered to the other party. |
| `mocks/books.ts` | **CHANGE** | Contains phone numbers (`081-…`, `089-…`) and buyer/seller names → remove contact data, align statuses/grades. |
| `mocks/seller.ts` | **CHANGE** | `buyerPhone` on orders must go; statuses must follow v4; add review/no-show/verification fixtures. |
| `styles/tokens.css` | **KEEP** | Keep brand tokens; add any new semantic tokens (status/dispute) here only. |
| `app/layout.tsx` providers | **KEEP** | Add v4 providers only if needed (e.g. chat/orders), keep order stable. |
| `.env.example` | **CHANGE** | Add `NEXT_PUBLIC_APP_URL`; `NEXT_PUBLIC_LINE_OA_ID=848xkfsj` (no `@`); `NEXT_PUBLIC_BASE_URL` is a duplicate and should be retired or aliased. |
| `README.md` | **CHANGE** | Phase 7 deliverable; currently documents the pre-v4 build. |

### 3.5 Missing building blocks (NEW)

`OrderTimeline` · `ChatRoom` + `MaskedText` · `MapPinPicker` · `DateTimePicker` ·
`QrPayCard` · `SlipUploader` + `SlipResult` · `HandoverCode` + `CodeInput` ·
`TrackingForm` · `PhotoGallery` · `CreditPackCard` · `ConfirmSheet` ·
`NicknameAvatarPicker` · `ReviewCard` · `ReportShopButton` · `NextActionCard`.

---

## 4. Cross-cutting findings

### 4.1 Status model mismatch (biggest state change)

Current: `PENDING_ACCEPT`, `WAITING_PAYMENT`, `PAYMENT_SUBMITTED`,
`PREPARING_SHIPPING`, `SHIPPED`, `MEETUP_CONFIRMED`, `COMPLETED`, `CANCELLED`,
`REPORTED`.

v4: `REQUESTED → ACCEPTED → SCHEDULED (meetup) / PAID (parcel) → SHIPPED →
COMPLETED`, plus `REJECTED`, `EXPIRED`, `CANCELLED`, `DISPUTED`.

Impact: `StatusBadge`, `OrderCard`, both order pages, order detail timeline,
accepted screen, meetup screen, mocks, notifications links.

### 4.2 Contact-data leaks found in code (must be removed)

`tel:` links / call modals / phone text appear in:
- `src/app/orders/[id]/page.tsx` (seller phone card + CALL modal)
- `src/app/seller/orders/[id]/accepted/page.tsx` (buyer phone + CALL modal)
- `src/app/seller/meetup/[id]/page.tsx` (buyer phone + CALL modal)
- `src/app/seller/verify/page.tsx` (collects phone — moves to shop setup)
- `src/hooks/useLiff.tsx` (MOCK_USER phone + PromptPay name)
- `src/mocks/books.ts`, `src/mocks/seller.ts` (buyer/seller phone data)
- `src/app/addresses/edit/page.tsx` (buyer's own phone — allowed, delivery only)
- `src/app/design-system/page.tsx` (phone demo — remove from gallery)
- `src/app/seller/credits/pay/page.tsx` (platform PromptPay id — allowed, but name check copy)

### 4.3 Claims wording

Grep for `รับประกัน` / `100%` / `ปลอดภัย 100` returned **no matches** — good
baseline. New copy still must be checked in `V4_COPY.md`.

### 4.4 Config / OA facts

- `NEXT_PUBLIC_LINE_OA_ID` must be `848xkfsj` (no `@`) and code must add `@` when
  building `https://line.me/R/ti/p/@…`; current `AppShell` uses the value raw.
- Base URL must come from `NEXT_PUBLIC_APP_URL`; `.env.example` still has
  `NEXT_PUBLIC_BASE_URL`.
- Mock mode stays the default (`NEXT_PUBLIC_LIFF_MOCK=true`).

---

## 5. Contradictions / gaps inside v4 (as summarised in the prompt)

1. **Unverified shop rule vs first-order verification.** Sellers can list
   immediately, and unverified shops are "meetup + cash only" — but verification
   itself happens by topping up at the first order. Can an unverified shop receive
   a *parcel* first order (which needs QR + slip)? v4?
2. **First-order gate timing.** The gate is described as "before accepting the
   first order", but buyer-side copy says pay by QR right after acceptance. Which
   step does the buyer see if the seller is stalled at the gate?
3. **Handover code storage.** "Stored on the buyer's device" is listed for offline
   use, yet the seller needs a server-side check and a 48h retry window. Where is
   the code validated in the mock (client store vs mock API)? v4?
4. **Slip check on meetup QR.** Auto slip check is described for parcel, but
   meetup can also "pay by QR in-app". Is a slip required there, or does the
   seller simply tap "received cash / received transfer"?
5. **Watermark.** The prompt lists watermarking as a rule but examples put
   compression client-side; server-side vs client-side watermark is ambiguous
   (§5.8 explicitly lists this as a known question).
6. **Notification quota.** "Chat notification max once per 30 min per order" —
   but push quota is per OA and the message goes to the *other* person. Is the
   throttle per order, per user, or both? v4?
7. **Request limit vs seller capacity.** Max 3 open requests per buyer; when a
   seller accepts one book, other requests auto-reject — but a multi-book cart
   from one shop becomes one order. Does auto-reject apply per book or per shop?
8. **Credit refund on no-show.** "Seller is refunded 1 credit" after the buyer
   fails to dispute within 24h — but the earlier rule says rejecting is free and
   accepting costs a credit. Is the refund automatic on no-show confirmation, or
   only after the 24h window?
9. **DISPUTED and reviews.** Reviews are requested at COMPLETED, and disputes
   stop timers. Can a completed order still be disputed (e.g. wrong condition),
   or must the dispute happen before COMPLETED?
10. **Chat read-only after COMPLETED** conflicts with "rebut a no-show claim
    within 24h" and with disputes that may be opened after completion. Is chat
    reopened for DISPUTED orders?

---

## 6. Questions for the owner (max 10, simplest first)

1. Where is `GongDong-User-Flow-v4.md`? Phase 0 cannot be signed off without it.
2. Can an unverified shop accept a **parcel** first order, or only meetup + cash
   until verification succeeds?
3. Handover code in the mock: generate + validate client-side, or add a mock API
   route so seller and buyer have separate devices?
4. Should meetup QR payments also require a slip + auto-check, or is "received"
   enough?
5. Watermark: browser (canvas) or server (mock upload endpoint)?
6. Keep current `/seller/*` paths or rename to `/shop/*`? (Affects links, docs,
   and every route in this audit.)
7. One orders page (`/orders` with buying/selling tabs) replaces `/seller/orders`
   — confirm, so seller-order code can move rather than duplicate.
8. Should the 10-book/day limit apply per shop or per LINE account, and does it
   also apply to sets?
9. Do we keep COD? It exists in step 4 today but is absent from v4 — delete?
10. For the demo, should top-up and order slips share one admin queue UI, or two
    separate lists?

---

## 6b. Owner decisions (recorded 13 พ.ย. 2569)

| # | Decision | Effect |
|---|---|---|
| 1 | **Buyers see the seller's shop name, never the real name.** The real (payee) name exists only for payout verification and admin. | `ShopIdentity.shopName` is the only seller label on cards, book detail, chat and orders. `PublicIdentity`/`ShopIdentity` must not carry a real name. Shop settings (Phase 3) may add an opt-in "show real name" toggle, default OFF, and it must still never expose phone/LINE ID. |

Still open from §6: route naming (`/seller/*` vs `/shop/*`), Thai copy approval in
`docs/V4_COPY.md`, and the v4 rulebook file.

## 7. Phase 0 exit criteria

- [x] Every route listed with KEEP / CHANGE / DELETE / NEW.
- [x] Every component, hook, mock, type and config file listed.
- [x] Contact-data leak sites identified by file.
- [x] v4 contradictions + questions written down.
- [x] Seller identity decision: shop name only (real name opt-in, default off).
- [ ] Owner approves this audit and answers the remaining questions above.
- [ ] `GongDong-User-Flow-v4.md` added to the repo and re-checked.

**No code changes were made in Phase 0.** Phase 1 starts only after approval.
