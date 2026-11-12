# PROMPT FOR ANTIGRAVITY — GongDong (กองดอง) UX/UI Build (v4-first)

> Copy everything below the line into Antigravity (Agent panel).
> Put `GongDong-User-Flow-v4.md` in the project folder `/docs` before you start.

---

## 0. ROLE

You are a senior product designer + front-end engineer.
Your job: build a working, clickable **front-end prototype of GongDong (กองดอง)** that follows **User Flow v4**, and make the UX/UI good for real Thai users inside LINE.
**You are free to design the screens yourself.** There is no pixel-perfect design to copy. What matters is that every step in v4 exists, is easy to understand, and is safe.
The user is a **beginner developer** and is not strong in English. So:
- Explain every step in **simple English** (short sentences, no jargon without a one-line explanation).
- Work in **small phases**. After each phase, stop, show a short summary, and wait for "continue".
- Never delete or rewrite files outside the project folder.

## 1. PRODUCT CONTEXT (read first)

GongDong is a C2C marketplace for **second-hand books in Thailand**, running inside **LINE** (Official Account + Rich Menu + LIFF web app + Flex Messages).
Main idea of v4: **"everything ends inside GongDong."** Buyers and sellers chat, schedule, pay by QR, check the slip, hand over with a code, ship with proof, review, and report problems — all inside the app. The only moment a user leaves LINE is opening the bank app to transfer money, then coming back to upload the slip.
There is **no escrow**. Money goes directly from buyer to seller. GongDong never holds money.
Trust comes from: real photos (4 sides + shop name tag + watermark) · 5-point condition check + 4 grades · verified payee name from a real bank slip · automatic slip check · no contact details shown · in-order chat with masking · handover code · reviews · admin dispute handling · internal blacklist.
Business model: **free to list, pay-to-accept** (1 credit when the seller accepts).
Personas: Sky (cautious student), Tham (mint-condition reader), Bio (hates chatting, wants one-tap buy), IQ (beginner, afraid of scams), Bank (rare-book hunter, needs wishlist), Mintra (collector, needs back cover + synopsis). Core insight: *the market does not lack demand, it lacks trust.*

## 2. SOURCE OF TRUTH

1. **`/docs/GongDong-User-Flow-v4.md` is the only rulebook** (behavior, rules, states, timers, who sees what). If anything else disagrees, v4 wins. If v4 disagrees with itself or is silent, **ask me** — do not guess.
2. **Figma is NOT required and NOT binding.** The Figma file (fileKey `tPARViRjMjfbZLmofgP7m1`) is an old draft that conflicts with v4. You may open it for inspiration (mood, colors, typography, ideas), but you must **not** copy its screens, flows or copy when they conflict with v4. Do not spend time on pixel-matching.
3. **Existing code in the repo (Phases 1–4 of the old plan):** treat it as a draft. Audit it (Phase 0), keep what already fits v4, **rewrite or delete what does not.** Keep the existing brand look (colors, font, radius) unless a change clearly improves usability — if you change it, tell me why in one sentence.
4. Older docs in `/docs` (MVP spec, listing flow, e-commerce architecture, personas): background only.

## 3. TECH STACK & CONSTRAINTS

- **Next.js (App Router) + TypeScript + Tailwind CSS**. Mobile-first.
- LIFF screens are web pages inside LINE: design width **390 × 844**, max content width ~430px, safe-area padding on top and bottom.
- Admin screens are desktop web (~1280 × 800).
- **UI first, but LIFF-ready from day one.** Use typed **mock data** (`/src/mocks`) and a thin service layer (`/src/services`) so Supabase / SlipOK / LINE Messaging API can be plugged in later. No real payments. Build `useLiff()` with a real SDK path and a **mock mode** (`NEXT_PUBLIC_LIFF_MOCK=true`). Read section 3A before writing code.
- Thai UI, one Thai-friendly font (`Noto Sans Thai` or `IBM Plex Sans Thai` unless the repo already has one).
- Design tokens (color, radius, spacing, type) live in one place: `tailwind.config.ts` + `/src/styles/tokens.css`. No hard-coded hex in components.
- Accessibility: touch targets ≥ 44px, contrast ≥ 4.5:1, visible focus, Thai line-height ≥ 1.5. Never use color alone to carry meaning.
- Keep components small and reusable. No giant files.
- **UX principles you must apply:** (1) one main action per screen, shown clearly; (2) always show "what happens next" and "who must act" on every order screen; (3) show safety evidence at the moment the user worries (photos, grade, verified badge, QR name warning); (4) honest copy only — no "100% safe", no "guarantee", no escrow language; (5) every screen has loading, empty and error states; (6) any money or irreversible action has a confirm step.

## 3-0. ALREADY CONFIGURED BY THE OWNER (do not redo; use these facts)

- LINE Official Account: **GongDong**, basic ID `@848xkfsj` → set `NEXT_PUBLIC_LINE_OA_ID=848xkfsj` (store WITHOUT the `@`; add the `@` in code when building `https://line.me/R/ti/p/@...`).
- Messaging API: **enabled** on the OA.
- LINE Login channel: **created**, with one LIFF app: view size **Full**, bot link (add friend) option = **Aggressive**, and the OA is **linked** to the Login channel.
- Still unknown to you (the owner will provide as environment variables, never in code): `NEXT_PUBLIC_LIFF_ID`, LINE Login channel ID, Messaging API channel secret and channel access token.
- Because "Aggressive" already shows an add-friend screen right after login, keep the friendship check (`liff.getFriendship()`) only as a silent safety net — do not show a second add-friend prompt unless the check says the user is not a friend.
- The LIFF endpoint URL is not final yet. Assume it will be the production HTTPS domain; keep the base URL in an env variable (`NEXT_PUBLIC_APP_URL`), never hard-code it.

## 3A. LIFF-READY REQUIREMENTS (the app must really run inside LINE)

A LIFF app is NOT "any website". It is a web page opened inside LINE's in-app browser (WKWebView on iOS, Android WebView on Android). Some browser features behave differently there. Follow all rules below.

**A. Setup & SDK**
1. Install `@line/liff`. Initialize once in a client-only provider (`<LiffProvider>`) with `liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID })`. Wait for init before rendering any page that needs the user. Never call LIFF code during server rendering (Next.js: `"use client"` + dynamic import).
2. Environment variables: `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_LIFF_MOCK`, `NEXT_PUBLIC_LINE_OA_ID` (for add-friend link). Provide `.env.example`. Never commit real secrets. Channel secret / access tokens are server-only.
3. The app must work in 3 environments and detect them with `liff.isInClient()`: (a) LINE in-app browser (main target), (b) external browser (Chrome/Safari — must not crash; show login + a "open in LINE" hint), (c) mock mode for local development.

**A2. Admin is NOT a LIFF app.** The `/admin` area (A1–A5) is a normal desktop website. It must not call LIFF. Give it its own simple login (email + password or an allow-list) and block it from normal users. Mock the login for now and leave a clear TODO.

**B. Login & identity**
4. In the LINE browser the user is logged in automatically; in an external browser call `liff.login()`. Handle both. Request only the scopes we need: `profile`, `openid` (add `chat_message.write` only if we really send messages from LIFF).
5. NEVER trust a user id sent from the client. Send the raw ID token (`liff.getIDToken()`) to a server route `/api/auth/line` that verifies it with LINE (`https://api.line.me/oauth2/v2.1/verify`) and then creates our own session. Build this route as a small stub now with a clear TODO for Supabase.
6. Handle: user not logged in, token expired, user denied permission, user not yet friends with the Official Account (show an add-friend prompt using `liff.getFriendship()`).

**C. Routing & deep links**
7. Every screen must open from a link like `https://liff.line.me/{LIFF_ID}/<path>` (used by Rich Menu, Flex Messages, notifications). Make sure the path and query string survive login redirects (LIFF puts them in `liff.state`) and test it. Keep a table of routes → deep links in `docs/DEEP_LINKS.md`.
8. Back button: handle the LINE header back button and a screen's own back button without trapping the user. Use `liff.closeWindow()` only in the LINE browser (it is unreliable in an external browser).
9. Use `liff.openWindow({ url, external: true })` for outside links (parcel tracking, PromptPay app); never navigate away from the LIFF page for those.

**D. Features that differ inside LIFF (important)**
10. **Barcode / ISBN scan (listing step 1):** use `liff.scanCodeV2()` as the primary method (works only in the LINE browser and must be switched on in the LIFF settings). Do NOT depend on camera libraries such as `html5-qrcode` inside LINE — they can fail in the in-app browser. Always provide a **manual ISBN** entry and a **manual book info** entry (no ISBN) as fallbacks. In an external browser, use only the manual fallbacks.
11. **Photo upload (S3P, B5P slip, S1 slip):** use a plain `<input type="file" accept="image/*">` (allow camera or gallery). Compress images in the browser before upload (max ~1600px, JPEG ~0.8) and show upload progress and retry. Test with large phone photos.
12. **Sharing (TSHARE):** use `liff.shareTargetPicker()` in the LINE browser (needs to be enabled in the LIFF settings); fall back to copy-link in an external browser.
13. **Clipboard, downloads, window.close, popups, `window.open`:** may be blocked or behave differently. Use feature checks and a graceful fallback. No `localStorage`-only logic for important data (it can be cleared) — server session is the source of truth.
14. **Phone call (CALL) and maps:** use `tel:` links and normal https map links; verify they open correctly from LINE on iOS and Android.
15. **Caching:** the LINE browser cache cannot be cleared by us. Use hashed asset file names (default in Next.js build) and correct `Cache-Control` headers, so users always get the newest version after a deploy.

**E. Layout inside LIFF**
16. LIFF view size is set in the LIFF settings (Full / Tall / Compact). Design for **Full**. Respect safe areas (`env(safe-area-inset-*)`) at top and bottom. Fixed bottom tab bar and bottom sheets must not be covered by the iOS home indicator or the keyboard.
17. Inputs: `font-size ≥ 16px` to avoid iOS auto-zoom; make sure the keyboard does not hide the submit button.
18. Performance: target first load < 3 s on 4G. Lazy-load images and heavy components; load only one Thai font with `font-display: swap`; no large libraries without approval.

**F. Chatbot / Messaging API (Flex Messages, notifications)**
19. Flex Message JSON for C1 / C2 must be valid for the LINE Flex Message Simulator. Buttons open LIFF deep links (item 7). Build a server-side helper `sendFlex(userId, template)` as a **stub** (no real call yet) and document which events trigger which message (new order, accepted, slip received, wishlist match, reminders).
20. Sending messages to users needs the Messaging API channel and the user's LINE user id (from the verified token). Keep these keys server-side only.

**G. Debugging inside LINE**
21. Add `@line/liff-inspector` and `eruda` (mobile console) **only in development/staging** behind an env flag, so errors can be seen on a real phone. Remove them from production.
22. Add a `/debug` page (dev/staging only) that shows: `isInClient`, OS, LIFF version, language, login state, context type, friendship flag, user id (masked).

## 4. RULES FROM USER FLOW v4

Core idea of v4: **everything happens inside GongDong** (chat, scheduling, payment QR, slip check, handover code, shipping proof, review, dispute). No phone numbers, LINE IDs or bank numbers are ever shown. There is still **no escrow**: money goes directly from buyer to seller; GongDong never holds money.

| Topic | v4 rule |
|---|---|
| Contact info | **Never show** phone, LINE ID, LINE name/photo, bank account number or real name from slip. Everyone sets a **nickname + avatar** at sign-up. Remove the phone-call popup (CALL) and the "phone unlocked" contact card. |
| Chat | **In-order chat** opens only after the seller accepts. Read-only after COMPLETED. Mask phone-like numbers (9–10 digits), "line", "ไลน์", "@", and bank-account-like numbers as `•••`. **No free image upload in chat** (images only in dedicated forms: slip, parcel box photo, report). Use mock messages now; design the service layer for realtime later. |
| Seller identity (Frictionless KYC) | Seller can **list immediately** after LINE login + shop setup (shop name, meetup point, shipping on/off, real name + PromptPay number, rules + PDPA tick). Verification happens at the **first order**: before accepting the first order the seller must top up credits from their own bank account; the slip's payer name becomes the "verified name" and must match the PromptPay owner. The sign-up step for sellers is a light **"shop setup"**, not a heavy verification screen. |
| Credits | Free to list. **−1 credit when seller accepts** (ACCEPTED). Reject = free. New user gets **1 free credit**. Packs: ฿20=3, ฿50=10, ฿100=25. If credits are not enough, show top-up on the same page, then return to accept. |
| Requests | Buyer can have max **3 open REQUESTED** orders. A request does **not** lock the book; several buyers may request the same book. When the seller accepts one, the book locks and other requests are auto-rejected. Seller sees only: nickname, avatar, rating, successful purchases, no-show history, delivery method, amount, province/district (parcel). |
| Payment | System generates a **PromptPay QR with the seller's amount** + a clear warning: "check that the account name matches [seller first name] before confirming the transfer". Buyer pays in the bank app, comes back and uploads the slip (page remembers the order). **Auto slip check** (receiver = verified name, amount, slip not reused) → PAID. If the check fails or quota ends → **admin approval queue**. **A seller can NEVER confirm a slip.** Meetup: pay by QR in-app or cash (seller taps "received cash"). |
| Meetup | Seller proposes time + **free map pin** + landmark text in chat; buyer confirms. Reminder 1 hour before. Use a map-pin picker + date/time picker (no fixed zone list). Buyer inspects the book first, pays, then shows a **6-digit handover code**; seller types it → COMPLETED. Never show the code to the seller before the handover. Code is stored on the buyer's device so it works if the network drops; seller can enter it up to 48h later. |
| Parcel | Fee ฿40 + ฿10 per extra book. Order of events: accepted → buyer pays QR + slip → PAID → seller enters carrier + tracking number + box photo **within 48h** → SHIPPED → buyer taps "received" or auto-complete after 7 days. Address and receiver phone are shown to the seller **only in PAID/SHIPPED** and hidden again after COMPLETED. Unverified shops: meetup + cash only. |
| Statuses | Meetup: REQUESTED → ACCEPTED → SCHEDULED → COMPLETED. Parcel: REQUESTED → ACCEPTED → PAID → SHIPPED → COMPLETED. Exits: REJECTED, EXPIRED, CANCELLED, DISPUTED. Timers: 24h to accept, 24h to pay (parcel), 48h to ship, 7 days to auto-complete, 48h after meetup time → ask both. DISPUTED stops all timers. |
| Special cases | "No-show" button only after meetup time + 15–30 min; the buyer gets 24h to "dispute" before the seller is refunded 1 credit. "Book not as graded" at meetup → buyer rejects in person, order cancelled, credit is not refunded. Seller no-ship after payment → DISPUTED → admin. |
| Photos | 4 mandatory: (1) front cover + shop name tag, (2) back cover, (3) spine, (4) page edges + defect photos if any. Name tag text = shop name + date only (no contact info). System adds a watermark on all photos. Compress in the browser (webp, max width 1080px). |
| Grades | 5-point check → 4 grades. Suggested price: 75% / 60% / 45% / 30% of cover price (LIKE_NEW / GENTLY_READ / WELL_LOVED / WORN_BUT_READABLE). Show grades with simple Thai labels (propose them in `docs/V4_COPY.md` for my approval). |
| Anti-leak | Block 9–10 digit numbers and "line/ไลน์/@" in book descriptions and shop names on save. Show a "Report shop" action. |
| Storage / security | Slip images: private bucket + short-lived signed URLs only. UI must never expose a public URL for slips. |
| Notifications | LINE OA notifications on each status change. Chat notification max **once per 30 min per order**, only if the other person is not in the chat. Keep a `notify()` service stub; no real sending yet. |
| Escrow | **None.** Never draw an escrow/wallet UI. Never write "100% safe" or "guarantee". |
| Anything not in v4 | Do not invent rules. List it under "Questions for the owner". |

## 5. WHAT MUST EXIST (derived from v4 — design these screens yourself)

Route names are suggestions; keep them English kebab-case. Mark each item in `docs/SCREEN_MAP.md` as KEEP (existing code fits), CHANGE, or NEW.

### 5.1 Account & entry
- Onboarding (3 short value points) → choose "start buying" / "start selling".
- **Nickname + avatar setup** (everyone; replaces LINE name/photo everywhere). PDPA consent text + tick.
- LINE add-friend handling (see 3A), permission-denied screen, "open in LINE" hint for external browsers.
- Help page `/help`: how to buy, how to sell, **safe-trading rules** (pay only through the QR in the order · never transfer to an account sent in chat · say the handover code only after you hold the book), grade explanation, credits, FAQ, report/contact button.

### 5.2 Buyer
- Home feed + search with filters (category, grade, price, meetup/parcel, single/set, course/ISBN search).
- Book detail: 4 watermarked photos (gallery) · defects · 5-point result + grade · price vs new price · shop badge/rating/verified status · add to cart / send request. Shop page with rating and review list.
- Wishlist ("ฝากตามหา") + notification center + address book (max 5).
- Cart split by shop (1 shop = 1 order) · delivery choice per shop (meetup ฿0 / parcel ฿40 + ฿10 per extra book) · unverified-shop notice (meetup + cash only) · limit of 3 open requests with a clear message · "request sent" screen.
- **Orders page (one page, tabs: buying / selling)** with a red dot when something waits for me.
- **Order detail** (the heart of v4): status timeline · countdown · the ONE next action for me · links to chat, pay, handover, report. Content changes per status (see 5.5).
- **Order chat** (opens after accept; masked; no free images; read-only after COMPLETED).
- **Meetup**: view/confirm proposed time + map pin; reminder state; **handover code screen** (6 digits, large, "say it only after you have the book and have paid", works offline); "book not as graded" action.
- **Pay by QR** (parcel; or meetup by QR): QR + amount + the name-check warning · open bank app hint · slip upload · check result states: checking / passed / failed (try again) / sent to admin · remembers the order when the user returns.
- Parcel tracking view (carrier, number, box photo, open carrier page) · "received" button · auto-complete notice.
- Rate the shop (1–5 + "condition matches grade?") · report a problem (reason, photos, text) · rebut a no-show claim within 24h.

### 5.3 Seller
- **Shop setup** (light): shop name, meetup point (map pin + landmark text), parcel on/off, real name + PromptPay number, rules + PDPA tick → can list immediately. Show the free-credit message.
- Shop hub: header (name, rating, successful sales, verified badge, credit balance + top-up button) · tabs for listing / waiting-payment-or-reserved / sold · edit or hide a listing · reviews · shop settings (editable, with the rule that a new PromptPay name must be re-verified).
- Listing wizard (ONE component for single book and set): choose single/set → ISBN scan (`scanCodeV2`) with manual ISBN and manual info fallbacks → 4 mandatory photos with clear example images and the "name tag = shop name + date only" rule → 5-point check → suggested grade + price (75/60/45/30%) → publish → success + share. Rate limit message for new shops (10 books/day in the first 7 days).
- Incoming requests list + request detail: buyer nickname/avatar, rating, successful purchases, no-show history, delivery method, amount, province/district (parcel). Buttons: accept (−1 credit, with confirm) / reject. Competing-requests explanation.
- **First-order verification gate**: explain why, show top-up packs, warn "transfer from your own bank account", then return to accepting. Handle: name mismatch → sent to admin / receiving money paused.
- Credits: packs (฿20=3, ฿50=10, ฿100=25) → QR + slip upload → result → new balance. Ledger/history.
- Meetup tools: propose time + map pin (in chat sheet) · "received cash" button · **enter handover code** (retry rules, 48h window) · "buyer did not show up" (enabled only 15–30 min after the time) · refund-of-credit explanation.
- Parcel tools: after PAID show receiver name + full address + receiver phone (only in PAID/SHIPPED) · shipping form (carrier, tracking number, box photo) with a **48h countdown**.
- Rate the buyer · report a problem.

### 5.4 Shared building blocks (build once, reuse everywhere)
`TrustBadge` (tap → reasons) · `StatusBadge` · `OrderTimeline` · `Countdown` · `ChatRoom` + `MaskedText` · `MapPinPicker` · `DateTimePicker` · `QrPayCard` · `SlipUploader` + `SlipResult` · `HandoverCode` + `CodeInput` · `TrackingForm` · `PhotoUploader` (compress to webp ≤1080px) + `PhotoGallery` · `ConditionChecklist` · `CreditPackCard` · `ConfirmSheet` · `Toast` · `EmptyState` · `Skeleton` · `NicknameAvatarPicker`.

### 5.5 What each order status must show (for both sides)
REQUESTED (waiting, 24h) · ACCEPTED (chat open; parcel: pay within 24h) · SCHEDULED (time + pin + code for buyer / code input for seller) · PAID (parcel: seller must ship in 48h) · SHIPPED (tracking; 7 days to auto-complete) · COMPLETED (rate; chat read-only; address/phone hidden again) · REJECTED · EXPIRED · CANCELLED · DISPUTED (timers stopped; "admin is checking"). Each state needs: title, one-line explanation, who must act, time left, primary button, secondary actions.

### 5.6 Admin (desktop web, not LIFF, own simple login)
Overview · **slip queue** (top-up slips and order slips that failed auto-check or hit quota) with approve/reject · **dispute view** that shows chat + slips + photos + verified names in one page, with actions (warn / refund order / blacklist) · reports on shops · users + blacklist · optional analytics link.

### 5.7 LINE assets (Messaging side)
- Rich Menu (spec only): "หาหนังสือ", "ขายหนังสือ", "ออเดอร์", "ฝากตามหา", "ช่วยเหลือ" — each opens a LIFF deep link.
- Flex Message templates for every notification event: new request · accepted · rejected/expired · meetup time proposed/confirmed · 1-hour reminder · slip passed/failed · paid (seller) · shipped (buyer, with tracking) · completed (ask for review) · dispute opened/resolved · new chat message (max once per 30 min per order) · credit top-up success · wishlist match. Provide a `/line-preview` page. Do not call the real LINE API.

### 5.8 Behaviors to mock now (so the UI is truthful)
Order state machine + timers · credit ledger (−1 on accept, free credit, top-up) · request limit (3) · listing rate limit · accept auto-rejects competing requests · chat masking · handover code generation and verification · slip check results (pass / fail / quota → admin) · notification stub `notify()` · permissions: what each side may see per status (section 4).

## 6. WHAT YOU MUST DELIVER

**Phase 0 — Audit (then STOP)**
1. Read `/docs/GongDong-User-Flow-v4.md` fully. Summarize it back to me in 15 simple lines to prove you understood.
2. Audit the existing repo: for every route/component mark KEEP / CHANGE / DELETE / NEW against section 5. Write `docs/V4_GAP.md`.
3. List contradictions or gaps in v4 itself and your questions for me (max 10, simplest first). Known examples to include: unverified shops vs first-order verification; how push-message quota is saved when notifying the OTHER person; watermark client-side vs server-side.
4. Do not change code yet. Wait for my approval.

**Phase 1 — Foundations**: tokens + base components (section 5.4 list, all states) + `/design-system` page · the LIFF foundation from 3A (`LiffProvider`, `useLiff()` mock mode, `/api/auth/line` stub, `/debug`, `.env.example`, `AppShell` with safe areas) · mock data model + order state machine + timers + credit ledger (5.8). Wait for my review.

**Phase 2 — Account + Buyer discovery**: 5.1 and the buyer browsing parts of 5.2 (feed, search, book detail, shop page, wishlist, notifications, addresses, cart, request sent, help).

**Phase 3 — Seller setup + listing**: shop setup, shop hub, listing wizard, edit/hide, credits and top-up with the verification gate.

**Phase 4 — The order engine (most important)**: orders page with tabs · order detail for every status (5.5) · accept/reject · chat with masking · propose/confirm time + pin · QR payment + slip result states · handover code (both sides) · parcel shipping form + tracking · completion, rating, report, no-show + rebuttal.

**Phase 5 — Admin**: 5.6.

**Phase 6 — LINE assets**: 5.7.

**Phase 7 — QA & usability pass (no pixel matching)**
- Click through these journeys end to end with mock data: (1) buyer buys by meetup + cash, (2) buyer buys by meetup + QR, (3) buyer buys by parcel, (4) seller lists a set, (5) seller's first order: verification top-up then accept, (6) two buyers request the same book, (7) buyer no-show + rebuttal, (8) failed slip → admin approves, (9) dispute handled by admin, (10) order expires.
- Check every status screen has: explanation, who acts, time left, one primary button.
- Test at 360, 390, 430px. Thai text must not overflow or be clipped. Keyboard must not hide the submit button.
- Check all copy: no phone/LINE ID/account number appears anywhere; no "100%" / "guarantee" / "escrow" wording.
- Write `README.md` (how to run, simple English) and `docs/SCREEN_MAP.md` (screen → route → component).

**Phase 8 — LIFF go-live preparation**
1. Replace remaining mock-only assumptions with the real `useLiff()` path; keep mock mode.
2. `docs/DEEP_LINKS.md` (route → `https://liff.line.me/{LIFF_ID}/path` → used by Rich Menu / Flex / notification).
3. `docs/LIFF_SETUP.md`, `docs/DEPLOY.md`, `docs/LIFF_TEST_CHECKLIST.md` (simple English, step by step, exact field values; HUMAN TEST items for real phones).

## 7. WORKING RULES

- One phase at a time. End each phase with: ✅ done list · ⚠️ problems · ❓ questions · ▶️ next step.
- Route names are English kebab-case; all visible text is **simple, friendly Thai**. Because there is no Figma copy to follow, collect all new Thai copy in `docs/V4_COPY.md` (screen → text) so I can review it. Keep wording honest and short.
- Money format: `฿1,234`. Do not invent business rules. When v4 is silent, ask.
- Do not add libraries without telling me why in one sentence.
- Never show or store (even in mock UI) phone numbers, LINE IDs, bank account numbers or slip-derived real names to the other party.

## 8. DEFINITION OF DONE

- Every item in section 5 is built or explicitly listed as "not built yet" with a reason in `docs/SCREEN_MAP.md`.
- All 10 journeys in Phase 7 can be clicked from start to finish with mock data.
- `npm run build` and `npm run lint` have zero errors.
- No hard-coded colors outside the tokens file.
- The app runs in mock mode in a normal browser AND is ready for a real LIFF ID (`NEXT_PUBLIC_LIFF_MOCK=false`) without code changes.
- Every screen has a working deep link listed in `docs/DEEP_LINKS.md`.
- No feature depends on a browser API unsupported in the LINE in-app browser without a fallback.

START NOW with **Phase 0** only.

---

## NOTE FOR THE OWNER (not for the agent)

- Figma is optional now. You do not need to connect the Figma MCP. If you still want the agent to look at it for inspiration, you can connect it later (Antigravity → Agent panel → ⋯ → MCP Servers → Manage → View raw config) with the server `https://mcp.figma.com/mcp`.
- LINE setup checklist (OA, Messaging API, LIFF app, publish, testers) is unchanged; ask Claude for the checklist again if needed.
