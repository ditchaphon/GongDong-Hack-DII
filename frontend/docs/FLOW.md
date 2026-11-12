# GongDong — Flow v4-first plan & current-screen audit

Document only. **No code has been changed to match this document yet.**
Source of truth: `docs/GongDong-User-Flow-v4.md` (the v4 rulebook) via
`docs/GongDong-Antigravity-UXUI-Prompt.md`.

> ⚠️ **Blocker:** `GongDong-User-Flow-v4.md` is **not in the repo** (there is no
> root `docs/`, and `frontend/docs/` contains only `AUDIT.md`, `FLOW.md` and the
> prompt). Everything below is derived from the v4 rules summarised in the prompt.
> Phase 0 cannot be completed until the rulebook is added.

---

## 1. What v4 changes about the product

| Topic | v3 / current build | v4 |
|---|---|---|
| Design source | Figma frames, pixel check | **No Figma binding** — design the screens from v4 |
| Contact | Phone numbers unlocked after accept, call popup | **No phone, LINE ID, LINE name, bank number, slip name ever shown** |
| Identity | LINE display name + photo everywhere | **Nickname + avatar** set at sign-up; seller real name + PromptPay only for payout |
| Seller onboarding | Heavy identity verification screen before listing | **Light shop setup**, then list immediately; **verification at first order** (top-up from own bank) |
| Chat | None (phone call + LINE OA link) | **In-order chat**, opens after accept, masked, read-only after COMPLETED, no free image upload |
| Payment | Buyer uploads slip, mock auto-approve | **PromptPay QR in the order** + auto slip check (pass / fail / quota → admin); seller can never confirm a slip |
| Handover | Close-sale button | **6-digit handover code**, buyer-side, seller enters it |
| Meetup | Fixed zone list + time slot | **Free map pin + landmark text** + date/time, proposed in chat, buyer confirms |
| Statuses | PENDING_ACCEPT → WAITING_PAYMENT → … → COMPLETED | `REQUESTED → ACCEPTED → SCHEDULED/PAID → SHIPPED → COMPLETED` + REJECTED / EXPIRED / CANCELLED / DISPUTED |
| Requests | One request per buyer, book implied locked | **Max 3 open requests**, request does **not** lock the book; accept locks it and auto-rejects others |
| Grades | A–D at 70 / 60 / 45 / 30 % | LIKE_NEW / GENTLY_READ / WELL_LOVED / WORN_BUT_READABLE at **75 / 60 / 45 / 30 %** |
| Anti-leak | None | Block 9–10 digit numbers and "line / ไลน์ / @" in listings and shop names |
| Help / FAQ | None | `/help` with how-to-buy, how-to-sell, safety rules, grades, credits, FAQ |
| Admin | Not built | Desktop `/admin`: slip queue, dispute view, shops, users/blacklist |

Core idea: **everything ends inside GongDong** — chat, schedule, QR pay, slip,
handover code, shipping proof, review, dispute. The only exit is the bank app for
the transfer itself. **No escrow; money never passes through the platform.**

---

## 2. Target route map (planned, not implemented)

Route names are suggestions; they can also stay as the current `/seller/...`
paths if we prefer less churn (see §3). Phase numbers are the new v4 phases.

### Account & entry
| Screen | Route | Phase |
|---|---|---|
| Onboarding (3 points → buy / sell) | `/onboarding` | 2 |
| Nickname + avatar + PDPA | `/setup` | 2 |
| Help / safe trading / grades / credits / FAQ | `/help` | 2 |
| Debug (dev only) | `/debug` | 1 |
| Design system | `/design-system` | 1 |

### Buyer
| Screen | Route | Phase |
|---|---|---|
| Home feed + filters | `/` | 2 |
| Search results | `/search` | 2 |
| Book detail (watermarked gallery, 5-point, grade, shop badge) | `/book/[id]` | 2 |
| Shop page + reviews + Report shop | `/shop/[shopId]` | 2 |
| Wishlist ("ฝากตามหา") | `/wishlist` | 2 |
| Notifications | `/notifications` | 2 |
| Addresses (max 5) | `/addresses` | 2 |
| Cart, split by shop, delivery per shop | `/cart` | 2 |
| Request sent | `/cart/sent` | 2 |

### Orders (shared, the heart of v4)
| Screen | Route | Phase |
|---|---|---|
| Orders page — tabs "ที่ซื้อ / ที่ขาย" + red dot | `/orders` | 4 |
| Order detail (status timeline, next action, countdown) | `/orders/[id]` | 4 |
| Order chat (masked, opens after accept) | `/orders/[id]/chat` | 4 |
| Pay by QR + slip + result states | `/orders/[id]/pay` | 4 |
| Meetup schedule: confirm time + pin | `/orders/[id]/schedule` | 4 |
| Handover code (buyer) / code input (seller) | `/orders/[id]/handover` | 4 |
| Parcel tracking + shipping form (seller) | `/orders/[id]/tracking` | 4 |
| Rate shop / buyer | `/orders/[id]/review` | 4 |
| Report / dispute / no-show rebuttal | `/orders/[id]/report` | 4 |

### Seller
| Screen | Route | Phase |
|---|---|---|
| Shop setup (light: name, pin, shipping, real name + PromptPay, PDPA) | `/shop/setup` | 3 |
| Shop hub (header, credit, tabs: selling / reserved / sold) | `/shop` | 3 |
| Edit / hide listing | `/shop/listings/[id]/edit` | 3 |
| Shop settings | `/shop/settings` | 3 |
| Listing wizard step 1 (single/set + ISBN scan + manual fallbacks) | `/sell` | 3 |
| Step 2 — 4 mandatory watermarked photos | `/sell/photos` | 3 |
| Step 3 — 5-point check → grade | `/sell/condition` | 3 |
| Step 4 — price 75/60/45/30 % + delivery | `/sell/price` | 3 |
| Listing success + share | `/sell/success` | 3 |
| Incoming requests + request detail | `/shop/requests` | 3/4 |
| First-order verification gate (top-up then accept) | `/shop/requests/[id]/verify` | 4 |
| Credits: packs, history | `/shop/credits` | 3 |
| Credit QR + slip | `/shop/credits/pay` | 3 |
| Credit result | `/shop/credits/success` | 3 |

### Admin (desktop, own login, no LIFF)
`/admin` overview · `/admin/slips` queue · `/admin/slips/[id]` review ·
`/admin/disputes` + `/admin/disputes/[id]` · `/admin/shops` reports ·
`/admin/users` + blacklist. Phase 5.

### LINE assets
`/line-preview` (Flex templates, no real API). Phase 6.

---

## 3. Current screens — KEEP / CHANGE / DELETE / NEW

Legend: **KEEP** = fits v4 as-is · **CHANGE** = screen stays, behavior or copy
changes · **DELETE** = must go · **NEW** = does not exist today.
Paths are today's real routes.

| # | Current route / screen | Verdict | What must happen |
|---|---|---|---|
| 1 | `/onboarding` | CHANGE | Keep 3 value points; both buttons lead into `/setup` (nickname) first, not straight to feed/shop |
| 2 | `/` feed + header + cart/bell | KEEP | Keep feed; add shop/verified badges; no contact info anywhere |
| 3 | `/search` filters | CHANGE | Add course/ISBN search + single/set filter; keep grade/price/delivery |
| 4 | `/book/[id]` | CHANGE | Watermarked gallery, shop badge + "Report shop", grade % per v4, no seller personal data |
| 5 | `/seller/[sellerId]` (public shop) | CHANGE | Becomes `/shop/[shopId]`: rating, review list, verified badge, report shop |
| 6 | `/cart` | CHANGE | Split by shop (1 shop = 1 order), unverified-shop notice (meetup + cash only), 3-open-request limit, no phone fields |
| 7 | `/cart/success` | CHANGE | Rename/keep as "request sent"; explain requests don't lock the book |
| 8 | `/orders` (buyer only) | CHANGE | One page, tabs "ที่ซื้อ / ที่ขาย", red dot for actions waiting on me |
| 9 | `/orders/[id]` | CHANGE (major) | New status machine, "who must act", countdown, next-action CTA; **remove phone contact card and CALL modal**; add chat / pay / schedule / handover / report entries |
| 10 | `/orders/[id]/review` | CHANGE | Rate shop + "condition matches grade?"; no phone |
| 11 | `/wishlist` | KEEP | Keep as-is |
| 12 | `/notifications` | KEEP | Keep; wording must not promise guarantees |
| 13 | `/addresses`, `/addresses/edit` | KEEP | Keep; receiver phone used only by seller in PAID/SHIPPED |
| 14 | `/seller` shop hub | CHANGE | Header: shop name, rating, successful sales, verified badge, credits; tabs renamed; add reviews + settings; hide/edit listings |
| 15 | `/seller/verify` (S1 heavy KYC) | **DELETE** | Replaced by light `/shop/setup`; verification moves to first-order gate |
| 16 | `/seller/list` wizard step 1 | CHANGE | Route/step names; ISBN scan + manual fallbacks stay; add 10/day rate-limit message |
| 17 | `/seller/list/step-2` | CHANGE | 4 photos with **shop name tag (name + date only)**, watermark, webp ≤1080px; remove "fill sample photos" from production path |
| 18 | `/seller/list/step-3` | KEEP | 5-point checklist stays; grade labels/percentages updated to v4 |
| 19 | `/seller/list/step-4` | CHANGE | Suggested price 75/60/45/30 %; unverified shops = meetup + cash only |
| 20 | `/seller/list/success` | KEEP | Keep share; remove "no middleman" style claims if they read as a guarantee |
| 21 | `/seller/orders` | CHANGE | Merge into `/orders` tab "ที่ขาย"; add buyer nickname/avatar/rating/no-show history; competing-request explanation |
| 22 | `/seller/orders/[id]/accepted` | CHANGE (major) | **Remove unlocked phone + call modal**; show "chat opened" + next action; first-order path goes through verification gate |
| 23 | `/seller/orders` accept sheet (S4A) | CHANGE | Confirm sheet stays; insufficient credits → top-up on the same page then return; explain competing requests auto-reject |
| 24 | `/seller/meetup/[id]` | CHANGE | Meetup: propose time + map pin (not zone list), confirm, handover code input, "received cash", "buyer did not show up" enabled 15–30 min after time |
| 25 | `/seller/meetup/[id]/closed` (S7) | CHANGE | Completion happens via handover code / buyer "received"; keep earnings summary without contact data |
| 26 | `/seller/report` + `/sent` | CHANGE | Unified report/dispute flow from the order; reasons from v4; timers stop when DISPUTED |
| 27 | `/seller/credits`, `/pay`, `/success` | CHANGE | QR + slip **check result states** (checking / pass / fail / to admin) instead of instant auto-approve; add credit ledger; first top-up feeds verified name |
| 28 | `/api/auth/line` stub | KEEP | Keep as stub; add session + PDPA consent fields later |
| 29 | `/debug` | KEEP | Keep; dev/staging only |
| 30 | `/design-system` | KEEP | Extend with v4 blocks (§4) |
| 31 | — no route — | NEW | `/setup` nickname + avatar + PDPA |
| 32 | — | NEW | `/help` (buy/sell guides, safety rules, grades, credits, FAQ, contact) |
| 33 | — | NEW | Order chat with masking (`ChatRoom`, `MaskedText`) |
| 34 | — | NEW | Pay by QR + `SlipResult` states, remembers the order |
| 35 | — | NEW | Map pin + date/time picker (`MapPinPicker`, `DateTimePicker`) |
| 36 | — | NEW | Handover code (buyer screen + seller code input, 48h window) |
| 37 | — | NEW | Parcel shipping form (carrier, tracking, box photo) + 48h countdown + tracking view |
| 38 | — | NEW | No-show flow + buyer rebuttal within 24h |
| 39 | — | NEW | Shop setup (`/shop/setup`) replacing S1 |
| 40 | — | NEW | First-order verification gate (top-up → accept) |
| 41 | — | NEW | Admin: overview, slip queue, dispute view, shops, users/blacklist |
| 42 | — | NEW | `/line-preview` Flex templates + Rich Menu spec |

### Components

| Component | Verdict | Note |
|---|---|---|
| `Button`, `Chip`, `Input`, `SearchBar`, `BottomSheet`, `Modal`, `Toast`, `Stepper`, `Countdown`, `EmptyState`, `Skeleton`, `GradeBadge`, `StatusBadge`, `BookCard`, `OrderCard`, `PhotoUploader`, `ConditionChecklist`, `PriceSuggest` | KEEP | Extend states where v4 adds them |
| `TopBar`, `BottomTab`, `AppShell` | CHANGE | Bottom tab: home / orders(buying+seller) / wishlist / shop; no cart-only flow in v4 language |
| `OrderCard` | CHANGE | Show next action + "who acts", no phone |
| `PhotoUploader` | CHANGE | Compress to webp ≤1080px, watermark, no public slip URL |
| `ConditionChecklist` | KEEP | Keep logic; grades renamed |
| `PriceSuggest` | CHANGE | 75/60/45/30 % |
| `TrustBadge` | CHANGE | Reasons on tap; no guarantee wording |
| `Modal` (CALL usage) | **DELETE usage** | Call popups removed from buyer, seller, meetup screens |
| — | NEW | `OrderTimeline`, `ChatRoom`, `MaskedText`, `MapPinPicker`, `DateTimePicker`, `QrPayCard`, `SlipUploader`, `SlipResult`, `HandoverCode`, `CodeInput`, `TrackingForm`, `PhotoGallery`, `CreditPackCard`, `ConfirmSheet`, `NicknameAvatarPicker` |

---

## 4. Rules the new UI must enforce (checklist for every screen)

1. **One main action** per screen, clearly shown.
2. Always show **what happens next** and **who must act** on order screens.
3. Show **safety evidence** where the user worries: photos, grade, verified
   badge, QR name-check warning.
4. **Honest copy only** — no "100% ปลอดภัย", no "รับประกัน", no escrow words.
5. **No contact data** — no phone, LINE ID, LINE name/photo, bank account, or
   slip-derived real name shown to the other side.
6. Mask phone-like numbers (9–10 digits), "line / ไลน์ / @", and bank-account-like
   numbers in chat and listing text.
7. Every screen has **loading, empty, error** states; every money or irreversible
   action has a **confirm step**.
8. Thai money format `฿1,234`; Thai line-height ≥ 1.5; touch targets ≥ 44px.

### Statuses and timers (target state machine)

- Meetup: `REQUESTED → ACCEPTED → SCHEDULED → COMPLETED`
- Parcel: `REQUESTED → ACCEPTED → PAID → SHIPPED → COMPLETED`
- Exits: `REJECTED`, `EXPIRED`, `CANCELLED`, `DISPUTED`
- 24h to accept · 24h to pay (parcel) · 48h to ship · 7 days auto-complete ·
  48h after meetup time → ask both sides · DISPUTED stops all timers
- Buyer max 3 open REQUESTED orders; accept locks the book and auto-rejects others

---

## 5. Phase plan (rewritten from the v4 prompt)

| Phase | Scope | Output |
|---|---|---|
| **0 — Audit** | Read v4 fully, summarise in 15 lines, audit every route/component, list v4 contradictions + questions | `docs/V4_GAP.md` (KEEP/CHANGE/DELETE/NEW), **no code changes** |
| 1 — Foundations | Tokens, v4 component list (§5.4 of prompt), order state machine + timers + credit ledger, LIFF base | `/design-system` extended |
| 2 — Account + buyer discovery | 5.1, buyer parts of 5.2, `/help` | Feed → cart → request sent journeys |
| 3 — Seller setup + listing | Shop setup, shop hub, wizard, edit/hide, credits + first-order gate entry | Listing journeys |
| 4 — Order engine | Tabs page, order detail per status, accept/reject, chat, schedule, QR pay, handover, shipping, completion, rating, report, no-show | All 10 Phase-7 journeys |
| 5 — Admin | Slip queue, dispute view, shops, users/blacklist | Desktop app |
| 6 — LINE assets | Flex templates, Rich Menu spec, `/line-preview` | No real API calls |
| 7 — QA | 10 journeys, 360/390/430px, copy audit, no contact data, README + `SCREEN_MAP.md` | Build + lint clean |
| 8 — Go-live | Real LIFF path, deep links, setup/deploy/test docs | `DEEP_LINKS.md`, `LIFF_SETUP.md`, `DEPLOY.md` |

Supporting docs to create during these phases: `V4_GAP.md` (Phase 0),
`V4_COPY.md` (all new Thai copy for owner review), `SCREEN_MAP.md` (Phase 7).

---

## 6. Current vs v4 — biggest risks

1. **Phone numbers are everywhere today** (order detail, accepted screen, meetup
   screen, call modals). This is the single largest removal: it touches buyer
   order detail, seller accepted screen, meetup screen, and mocks.
2. **Status model differs** from the existing `OrderStatus` union, so order cards,
   timelines, badges and mock orders all move together.
3. **Chat, QR pay, handover code, map pin** are new systems, not screens — they
   need mock services before the UI is truthful.
4. **Seller verification moves** from a first screen to the first order; the old
   `/seller/verify` flow becomes dead code.
5. **Grade percentages change** (70 → 75 % for LIKE_NEW), affecting
   `PriceSuggest`, mocks, and copy.

---

## 7. Open questions (blocking Phase 0)

1. **Where is `GongDong-User-Flow-v4.md`?** It is not in the repo; Phase 0 needs it.
2. Unverified shops are "meetup + cash only", but first-order verification happens
   by top-up — does the first order have to be meetup + cash until the shop is
   verified?
3. Handover code: buyer-side storage is listed, but the seller needs a server
   check — where is the code validated in the mock (client store vs mock API)?
4. Slip check quota: what should the UI do when quota ends mid-demo — always
   "sent to admin"?
5. Watermark: client-side (canvas) or server-side? Prompt lists both as examples.
6. Should the current `/seller/*` paths keep their names, or move to `/shop/*`
   for consistency with v4 language?
7. Chat notification limit (once per 30 min per order) — visible to the user or
   silent in the mock?
8. Listing rate limit 10/day: does it apply per shop or per LINE account?
