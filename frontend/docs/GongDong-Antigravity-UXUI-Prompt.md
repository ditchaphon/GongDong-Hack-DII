# PROMPT FOR ANTIGRAVITY — GongDong (กองดอง) UX/UI Build

> Copy everything below the line into Antigravity (Agent panel).
> Before sending: connect the Figma MCP server (see the setup note at the bottom of this file).

---

## 0. ROLE

You are a senior front-end engineer and UX/UI implementer.
Your job: turn the finished Figma design of **GongDong (กองดอง)** into a working, clickable front-end prototype.
The user is a **beginner developer** and is not strong in English. So:
- Explain every step in **simple English** (short sentences, no jargon without a one-line explanation).
- Work in **small phases**. After each phase, stop, show a short summary, and wait for "continue".
- Never delete or rewrite files outside the project folder.

## 1. PRODUCT CONTEXT (read first)

GongDong is a C2C marketplace for **second-hand books in Thailand**, running inside **LINE** (LINE OA + Rich Menu + LIFF web app + chatbot Flex Messages).
There is **no escrow**. Trust is built with:
1. Mandatory real photos of each book (with a paper name tag + spine photo).
2. Standardised condition grading (checklist → grade → suggested price).
3. Same-seller bundle cart (shared shipping).
4. Free-shipping **meetup** (campus / BTS / MRT) — buyer checks the real book first.
5. Seller identity check (bank-slip name must match PromptPay name) + blacklist check.
6. Wishlist ("ฝากตามหา") with auto-alert.

Business model: **free to list, pay-to-accept**. Seller lists for free; when a buyer orders, the seller uses **1 credit** to accept the order and unlock contact/payment details. Credit packages: Starter ฿20 = 3 credits, Bookworm ฿50 = 10, Merchant ฿100 = 25. New users get 1 free credit.

Users (6 personas): Sky (cautious student, wants meetup + seeing real item), Tham (mint-condition reader, 200 baht limit, fears damaged parcels), Bio (hates chatting, wants one-tap buy), IQ (beginner, afraid of scams), Bank (rare-book hunter, needs wishlist + alert), Mintra (collector, must see back cover + synopsis).
Core insight: *the market does not lack demand, it lacks trust. The UI must remove worry about scams, damage and wrong condition.*

## 2. SOURCE OF TRUTH

1. **Figma file (highest priority for anything visual or any screen flow):**
   - URL: https://www.figma.com/design/tPARViRjMjfbZLmofgP7m1/Untitled?node-id=0-1
   - fileKey: `tPARViRjMjfbZLmofgP7m1`  — Page 1 (node `0:1`)
   - Use the Figma MCP tools (`get_metadata`, `get_design_context`, `get_screenshot`) to read each frame by node id (section 5).
2. Markdown/Word specs in `/docs` (I will put them there): business rules, states, copy, SLA timers, DB fields.
3. If the Figma and a spec disagree, follow **section 4 (conflict rules)**. If still unclear, **ask me** — do not guess.

Do NOT recreate the design from memory. Always read the frame from Figma first.

## 3. TECH STACK & CONSTRAINTS

- **Next.js (App Router) + TypeScript + Tailwind CSS**. Mobile-first.
- LIFF screens are web pages inside LINE: design width **390 × 844**, max content width ~430px, safe-area padding on top and bottom.
- Admin screens are desktop web: **1280 × 800**.
- **UI first, but LIFF-ready from day one.** Use typed **mock data** (`/src/mocks`) and a thin service layer (`/src/services`) so Supabase / SlipOK can be plugged in later. No real payments yet. LINE login is **real-capable**: build a `useLiff()` hook that wraps the real LIFF SDK and also has a **mock mode** (`NEXT_PUBLIC_LIFF_MOCK=true`) that returns a fake user, so the app runs in a normal browser during development and in LINE in production. Read section 3A before writing any code.
- Thai UI. Use one Thai-friendly font (check the Figma text style; if it is not available, use `Noto Sans Thai` / `IBM Plex Sans Thai`).
- Design tokens (colors, radius, spacing, font sizes) must be **read from Figma** and put in one file: `tailwind.config.ts` + `/src/styles/tokens.css`. Never hard-code hex values in components.
- Accessibility: touch targets ≥ 44px, text contrast ≥ 4.5:1, visible focus, Thai text must not be clipped (line-height ≥ 1.5).
- Keep components small and reusable. No giant files.

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
6. Handle: user not logged in, token expired, user denied permission (screen E1 in Figma), user not yet friends with the Official Account (show an add-friend prompt using `liff.getFriendship()`).

**C. Routing & deep links**
7. Every screen must open from a link like `https://liff.line.me/{LIFF_ID}/<path>` (used by Rich Menu, Flex Messages, notifications). Make sure the path and query string survive login redirects (LIFF puts them in `liff.state`) and test it. Keep a table of routes → deep links in `docs/DEEP_LINKS.md`.
8. Back button: handle the LINE header back button and a screen's own back button without trapping the user. Use `liff.closeWindow()` only in the LINE browser (it is unreliable in an external browser).
9. Use `liff.openWindow({ url, external: true })` for outside links (parcel tracking, PromptPay app); never navigate away from the LIFF page for those.

**D. Features that differ inside LIFF (important)**
10. **Barcode / ISBN scan (S2, S2B):** use `liff.scanCodeV2()` as the primary method (works only in the LINE browser and must be switched on in the LIFF settings). Do NOT depend on camera libraries such as `html5-qrcode` inside LINE — they can fail in the in-app browser. Always provide the fallback screens that already exist in Figma: manual ISBN (S2M) and manual info (S2N). In an external browser, use only the manual fallback.
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

## 4. CONFLICT RULES (documents disagree — follow these)

| Topic | Rule |
|---|---|
| Credit model | **Free listing. 1 credit is spent when the seller ACCEPTS an order** (MVP spec + Figma S4A/S5). Ignore "deduct credit on publish" and "฿20 at onboarding" from the older flow docs. |
| Payment order | Buyer sends request → seller accepts (uses credit) → buyer pays/attaches slip (shipping) or pays at meetup. Do **not** use "pay within 2 hours before seller accepts". Keep the 48-hour shipping SLA and 7-day auto-complete as copy/timers only if Figma shows them. |
| Condition checklist | Figma says **5-point check + 4 grade levels** (S3C, GRADE). Follow Figma, not the "4-point" text in the markdown. |
| Meetup location | Figma uses a **zone picker** (ZONE) and a time picker (TIME). Google Maps link is optional extra info. Follow Figma. |
| Escrow | The persona PDF mentions escrow. The product has **no escrow**. Never draw an escrow UI. |
| Photos | Follow Figma S3P (4 photos + defect photos). Paper-tag photo is mandatory. |
| Anything not in Figma | Do not invent screens. List it under "Questions for the owner". |

## 5. SCREEN INVENTORY (80 frames, all on Page 1)

Frame node ids are `28:xx`. Fetch each with `get_design_context` (fileKey above).
Mobile frames = 390×844. Admin frames = 1280×800.

### 5.1 Buyer — LINE OA → Rich Menu → LIFF → Chatbot (21 frames)
| Code | Node | Screen | Type |
|---|---|---|---|
| L0 | 28:6 | LINE chat + Rich Menu | LINE native (asset + config only) |
| LL | 28:1550 | LINE chat list | LINE native (reference only) |
| E1 | 28:48 | LIFF permission request (first time) | LINE native (reference only) |
| B0 | 28:64 | Onboarding (first open) | LIFF page |
| B1 | 28:90 | Home / search | LIFF page |
| B1R | 28:1576 | Search results / filters | LIFF page |
| B2 | 28:182 | Book detail | LIFF page |
| B2S | 28:1647 | Seller shop page | LIFF page |
| B3 | 28:235 | Cart + choose delivery method | LIFF page |
| B3D | 28:1709 | Cart: choose parcel delivery | LIFF page |
| B3S | 28:283 | Request sent | LIFF page |
| C1 | 28:298 | Buyer chatbot | **Flex Message** templates |
| B5 | 28:334 | Order status (buyer) | LIFF page |
| B5P | 28:392 | Attach slip (parcel) | LIFF page |
| B5S | 28:1742 | Slip sent | LIFF page |
| B8 | 28:416 | Purchase complete + rating | LIFF page |
| B4 | 28:432 | Wishlist (ฝากตามหา) | LIFF page |
| B4OK | 28:483 | Wishlist saved | LIFF page |
| B6 | 28:505 | Notification center | LIFF page |
| B7 | 28:549 | Address manager (max 5) | LIFF page |
| B7E | 28:1753 | Add / edit address | LIFF page |

### 5.2 Seller — Verify → List → Accept → Top-up → Close (26 frames)
| Code | Node | Screen |
|---|---|---|
| S1 | 28:584 | Seller identity verification (first time) |
| S2 | 28:614 | List step 1: choose single/set + scan ISBN |
| S2B | 28:670 | Set listing step 1: scan every volume |
| S2M | 28:1788 | Type ISBN manually |
| S2N | 28:1830 | Enter book info manually (no ISBN) |
| S3P | 28:749 | Step 2: 4 photos + defects |
| S3PB | 28:806 | Set step 2: photos of whole set |
| S3C | 28:863 | Step 3: 5-point condition check |
| S3CB | 28:932 | Set step 3: 5-point check |
| S3 | 28:1001 | Step 4: price + delivery options |
| S3B | 28:1052 | Set step 4: price + delivery |
| S3S | 28:1105 | Listing success |
| C2 | 28:1124 | Seller chatbot: new order (**Flex Message**) |
| S4 | 28:1157 | My orders (seller) |
| S4A | 28:1209 | Confirm using 1 credit |
| S4B | 28:1225 | Order accepted |
| S4W | 28:1857 | My shop: waiting for payment |
| S4C | 28:1900 | My shop: closed |
| S4L | 28:1949 | My shop: listings |
| S5 | 28:1254 | Top-up: choose package |
| S5Q | 28:1286 | Scan to pay + attach slip |
| S5OK | 28:1308 | Top-up success |
| S6 | 28:1319 | Meetup day / close sale |
| S7 | 28:1346 | Sale closed |
| S6R | 28:2012 | Report a problem |
| S6RS | 28:2038 | Report sent |

### 5.3 Admin — desktop web (7 frames, 1280×800)
| Code | Node | Screen |
|---|---|---|
| A1 | 28:1360 | Overview dashboard |
| A2 | 28:1411 | Top-up slips list |
| A2D | 28:1474 | Slip review (detail) |
| A3 | 28:1506 | Seller reports |
| A3D | 28:1531 | Account suspended |
| A4 | 28:2047 | Users |
| A5 | 28:2092 | Microsoft Clarity |

### 5.4 Popups / bottom sheets / toasts (26 frames) — open OVER the previous page
`M1 28:2128` LIFF ⋯ menu · `ZONE 28:2141` zone/category picker · `PRICE 28:2156` price filter · `GAL 28:2171` photo gallery · `TSAVE 28:2178` saved toast · `TIME 28:2187` meetup date/time · `CANCEL 28:2208` confirm cancel order · `CALL 28:2218` phone call (system) · `PHOTO 28:2227` choose photo · `TPHOTO 28:2238` photo attached toast · `TRATE 28:2247` 5-star toast · `WMANAGE 28:2256` manage wishlist · `DELADDR 28:2267` confirm delete address · `PROV 28:2276` province/district picker · `TPRICE 28:2287` suggested price applied · `GRADE 28:2296` auto-grade criteria (4 levels) · `DEFECT 28:2319` describe defect + photo · `TGRADE 28:2334` grade recalculated · `TMISSING 28:2343` mark missing volumes · `TCOD 28:2352` COD enabled · `REJECT 28:2361` reject order · `TSHARE 28:2375` link copied · `TFILTER 28:2384` admin: filtered (desktop) · `TWARN 28:2393` admin: warning sent (desktop) · `TDISMISS 28:2402` admin: report dismissed (desktop) · `TCLARITY 28:2411` admin: open Clarity (desktop)

## 6. WHAT YOU MUST DELIVER

**Phase 0 — Setup & Audit (do this first, then STOP)**
1. Read the Figma page (`get_metadata` on `0:1`). Confirm you can see all 80 frames.
2. Open `/docs`. Write `docs/AUDIT.md`: (a) any Figma-vs-spec conflicts you found beyond section 4, (b) missing screens or states, (c) your questions for me (max 10, simplest first).
3. Create the Next.js project, Tailwind, folder structure, and ESLint/Prettier.
4. Show me the folder tree and wait.

**Phase 1 — Design system**
- Extract tokens from Figma → `tokens.css` + Tailwind config.
- Build base components (with all states: default, pressed, disabled, loading, error): Button, Chip/Filter, Input, SearchBar, Card (BookCard, OrderCard), TrustBadge, StatusBadge, BottomTab, TopBar, BottomSheet, Modal, Toast, Stepper, Countdown, PhotoUploader, ConditionChecklist, PriceSuggest, EmptyState, Skeleton.
- Build the LIFF foundation now (section 3A): `<LiffProvider>`, `useLiff()` with mock mode, `/api/auth/line` stub, `/debug` page, `.env.example`, and a mobile-safe `<AppShell>` (safe-area, bottom tab, bottom-sheet container).
- Add a `/design-system` page that shows every component. Wait for my review.

**Phase 2 — Buyer flow** (5.1, LIFF pages only): B0 → B1 → B1R → B2/B2S → B3/B3D → B3S → B5/B5P/B5S → B8, then B4/B4OK, B6, B7/B7E. Wire the popups from 5.4 that belong to each page.

**Phase 3 — Seller flow** (5.2): S1 → listing wizard (single and set versions share ONE wizard component, S2 → S3P → S3C → S3 → S3S) → S4 family → S5 family → S6/S7 → S6R/S6RS.

**Phase 4 — Chatbot & LINE assets**: Build the Flex Message JSON templates for C1 and C2 (+ Rich Menu spec for L0) in `/src/line/flex/*.json`, with a `/line-preview` page that renders them. Do not call the real LINE API.

**Phase 5 — Admin** (5.3 + desktop toasts): separate layout under `/admin`, desktop-first.

**Phase 6 — QA & polish**
- Clickable end-to-end journeys: (1) buyer buys by parcel, (2) buyer buys by meetup, (3) seller lists a set, (4) seller tops up credits and accepts an order, (5) admin approves a slip.
- Pixel check each page against its Figma screenshot (`get_screenshot`). List any difference > 4px.
- Test at 360, 390, and 430px width. Thai text must not overflow.
- Write `README.md` (how to run, in simple English) and `docs/SCREEN_MAP.md` (Figma code → route → component file).

**Phase 7 — LIFF go-live preparation** (after Phase 6)
1. Replace remaining mock-only assumptions with the `useLiff()` real path; keep mock mode for local work.
2. Write `docs/DEEP_LINKS.md` (route → `https://liff.line.me/{LIFF_ID}/path` → used by Rich Menu / Flex Message / notification).
3. Write `docs/LIFF_SETUP.md` in **simple English, step by step with exact field values**, for me (a beginner) to follow: create the LINE Login channel, create the LIFF app (size, endpoint URL, scopes, Scan QR on, share target picker on, bot link), link the Official Account, set Rich Menu URLs, add testers, publish the channel.
4. Write `docs/DEPLOY.md`: deploy to a free HTTPS host (e.g. Vercel), set environment variables, set the LIFF endpoint URL, and a rollback plan.
5. Write `docs/LIFF_TEST_CHECKLIST.md` and run what can be run locally. The checklist must cover: iOS + Android LINE app, external browser, fresh login, denied permission, not-friend user, deep link from Rich Menu, deep link from Flex Message, ISBN scan + manual fallback, photo upload of a big photo, share, back button, keyboard on forms, safe areas, slow network.
6. List anything that only I can do on a real phone as "HUMAN TEST" items.

## 7. WORKING RULES

- One phase at a time. End each phase with: ✅ done list · ⚠️ problems · ❓ questions · ▶️ next step.
- Route names are English kebab-case (`/book/[id]`, `/seller/list/step-3`), but all visible text is **Thai exactly as in Figma**. Do not translate or reword copy.
- Every screen needs: loading, empty, and error states (even if Figma shows only the happy path) — make them simple and consistent, and list them in `docs/AUDIT.md` so I can approve.
- Money format: `฿1,234`. Dates in Thai (Buddhist year) only if Figma shows it.
- Do not add libraries without telling me why in one sentence.
- If a Figma call fails or is rate-limited, tell me immediately and use the fallback: read PNG exports from `/design/exports/<code>.png`.

## 8. DEFINITION OF DONE

- All 80 frames are mapped in `docs/SCREEN_MAP.md` (built, or marked "LINE native" / "reference only").
- All 5 journeys in Phase 6 can be clicked from start to finish with mock data.
- `npm run build` has zero errors; `npm run lint` has zero errors.
- No hard-coded colors outside the tokens file.
- The app runs in mock mode in a normal browser AND is ready to run with a real LIFF ID (`NEXT_PUBLIC_LIFF_MOCK=false`) without code changes.
- Every screen has a working deep link listed in `docs/DEEP_LINKS.md`.
- No feature depends on a browser API that is unsupported in the LINE in-app browser without a fallback (scan, camera, share, clipboard).

START NOW with **Phase 0** only.

---

## SETUP NOTE (for you, not for the agent)

**Connect Figma to Antigravity (so no screenshots are needed):**
1. In Antigravity open the **Agent panel → "⋯" (Additional options) → MCP Servers → Manage MCP Servers → View raw config**. This opens `mcp_config.json` (usually `~/.gemini/antigravity/mcp_config.json`).
2. Add the Figma server. A working config reported by the community (needs Node.js installed):
```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.figma.com/mcp"],
      "env": {}
    }
  }
}
```
   (Some versions of Antigravity let you install "Figma" directly from the MCP Servers list — try that first.)
3. Save, press refresh, log in to Figma in the browser when asked, and allow access.
4. Test by asking the agent: "Use Figma MCP to list the frames on Page 1 of fileKey tPARViRjMjfbZLmofgP7m1." It should return ~80 frames.

**Fallback (if MCP does not work or hits a free-plan limit):**
In Figma select a group of frames → right-click → *Export* → PNG @2x. Save as `/design/exports/B1.png`, `/design/exports/S3C.png`, etc. (file name = frame code). Put the folder in the project; the agent can read image files in the workspace.

---

## GO-LIVE CHECKLIST (for you, not for the agent)

A website alone is not enough. LIFF only works when these things exist. Do them in order (the agent's `docs/LIFF_SETUP.md` will give exact values):

1. **LINE Official Account (OA)** — you already plan to have one. Turn on the Messaging API for it (this creates a Messaging API channel).
2. **LINE Developers Console** (developers.line.biz) → use one **Provider** for everything (the Login channel and the Messaging API channel must be in the same provider, otherwise user ids will not match).
3. **LINE Login channel** → add a **LIFF app**:
   - Endpoint URL: your **HTTPS** website address (for example your Vercel domain).
   - Size: **Full**.
   - Scopes: `profile`, `openid` (add `chat_message.write` only if needed).
   - Turn on **Scan QR** and **Share target picker** if you use them.
   - Bot link: link your Official Account (so the add-friend prompt works).
   - Copy the **LIFF ID** → put it in `NEXT_PUBLIC_LIFF_ID`.
4. **Deploy the website** to an HTTPS host (Vercel is the easiest for Next.js). Put the environment variables there.
5. **Rich Menu**: set each button to open `https://liff.line.me/<LIFF_ID>/<path>`.
6. **Test with real phones** (iPhone and Android) inside the LINE app. While the LINE Login channel is in **Development** status, only people you add as testers/admins can open the app. Switch the channel to **Published** before real users come.
7. **Server secrets** (channel secret, channel access token, Supabase keys, SlipOK key) live only in server environment variables. Never in the front-end code.

**Answer to "will LIFF support every kind of website?"** — No. LIFF opens your web page inside LINE's built-in browser. Normal pages, forms, images, and navigation work well. But a few things are different: the barcode scanner must use LINE's own scanner (`scanCodeV2`), camera libraries can fail, sharing and closing the window use LIFF functions, and the cache cannot be cleared by you. That is why section 3A exists and why the app has manual fallbacks (S2M, S2N).
