# GongDong (กองดอง) — UI & Architecture Audit (Phase 0)

## 1. Conflict Rules & Spec Alignment

Based on the prompt guidelines (Section 4) and project specifications:

| Topic | Decision / Rule Applied | Notes |
|---|---|---|
| **Credit Model** | **Free listing; 1 credit charged only when seller ACCEPTS an order** | Ignore legacy notes about deducting credit upon publishing or ฿20 onboarding fees. |
| **Payment Flow** | Buyer requests → Seller accepts (-1 credit) → Buyer pays / attaches slip (for shipping) or pays at meetup | Do not enforce "pay within 2 hours before acceptance". |
| **Condition Checklist** | **5-point check + 4 grades** (A, B, C, D) | Standardized: cover intact, no highlights, no water damage, complete pages, no yellowing edges. |
| **Meetup Flow** | **Zone Picker + Time Picker** | Google Maps link is an optional extra note. |
| **Escrow** | **No escrow** | GongDong is direct C2C built on seller verification (PromptPay matching) and physical meetups. |
| **Photos** | **4 required photos + paper name tag + optional defect photos** | Mandatory photo with seller handwritten name tag builds trust without escrow. |

---

## 2. Identified Missing States & Edge Cases

To deliver a production-ready UX, the following states are prepared across all screens:

1. **Empty States**:
   - Buyer Cart: Empty cart with "ไปค้นหาหนังสือ" CTA.
   - Search Results: No matching books found with suggested search terms or "ฝากตามหา" (Wishlist) CTA.
   - Order List (Buyer & Seller): Empty orders tab with illustration and helpful hints.
   - Wishlist (ฝากตามหา): No active wishlist items.
2. **Loading States**:
   - Card skeletons for book feed and order history.
   - Button spinner states for credit deduction, slip uploading, and order acceptance.
3. **Error & Validation States**:
   - Form errors: missing mandatory photos (e.g. paper tag), missing condition checks.
   - Slip upload errors: file too large or invalid format.
   - Credit insufficient modal: prompts seller directly to top-up packages (S5) when trying to accept an order with 0 credits.
4. **SLA & Expiration Timers**:
   - 48-hour countdown for seller shipping parcel after payment.
   - Auto-cancel timer if buyer does not submit slip within specified time.

---

## 3. Top 10 Questions for the Product Owner

1. **Figma Connection**: Have you connected the Figma MCP or plugin so we can fetch the exact vector tokens and pixel designs directly?
2. **Fallback Thai Font**: Should we prioritize `IBM Plex Sans Thai` or `Noto Sans Thai` for the typography token?
3. **Credit Top-up Packages**: Are the 3 packages confirmed as Starter (฿20 = 3 credits), Bookworm (฿50 = 10 credits), and Merchant (฿100 = 25 credits)?
4. **New User Free Credits**: Does a newly registered seller receive 1 free credit automatically upon completing identity verification?
5. **Meetup Zones**: Should the zone picker offer preset popular hubs (e.g., BTS Siam, MRT Sam Yan, Chula, TU Tha Prachan) with an "Other" text field?
6. **Shipping Fee Default**: Is there a standard default parcel shipping fee (e.g., ฿40-50 per single book, ฿80-100 per set)?
7. **Condition Auto-Grading**: Does failing 1 check automatically downgrade from Grade A to Grade B, or is there a specific formula?
8. **LINE Chatbot Flex Messages**: Will chatbot previews be viewed in LIFF simulator mode or purely as interactive UI cards in the browser?
9. **Admin Slip Approval**: When an admin approves a top-up slip in desktop admin, should the seller's credit balance update immediately in mock storage?
10. **Book Cover Aspect Ratio**: Is the standard book card thumbnail ratio 3:4 or 1:1 in the feed?


---

## 4. Phase 3 — Seller flow (implemented)

| Figma | Route | Notes / states |
|---|---|---|
| S1 | `/seller/verify` | Identity form, validation errors, already-verified state, success toast |
| S2 / S2B | `/seller/list` | Single vs set mode, scan via `liff.scanCodeV2` with manual fallback, verification gate (empty state), step-1 validation |
| S2M / S2N | sheets on `/seller/list` | Manual ISBN lookup, manual book info (no ISBN) |
| S3P / S3PB | `/seller/list/step-2` | 4 mandatory photos + defect photos, PHOTO source sheet, DEFECT sheet, missing-photo validation, mock "fill sample photos" helper |
| S3C / S3CB | `/seller/list/step-3` | 5-point checklist, live auto-grade, GRADE criteria sheet, TGRADE toast |
| S3 / S3B | `/seller/list/step-4` | Price + PriceSuggest (TPRICE), meetup/parcel toggles, parcel fee, COD (TCOD), price/delivery validation |
| S3S | `/seller/list/success` | Listing summary, share (LINE share target picker → copy-link fallback) |
| S4 | `/seller/orders` | Tabs (new / active / done), empty state, accept + reject sheets, insufficient-credit modal |
| S4A | sheet on `/seller/orders` | Credit confirmation, balance shown, blocked when 0 credits |
| S4B | `/seller/orders/[id]/accepted` | Buyer phone unlocked, call modal, next steps, credits remaining |
| S4L / S4W / S4C | `/seller` | Shop hub tabs: listings, waiting for payment, closed sales; empty states, verify banner, credit balance |
| S5 | `/seller/credits` | 3 packages, selection, balance |
| S5Q | `/seller/credits/pay` | Mock PromptPay QR, copy id, 30-min countdown, slip upload required |
| S5OK | `/seller/credits/success` | New balance, mock auto-approval note |
| S6 | `/seller/meetup/[id]` | Meetup details, share (TSHARE), call modal, parcel slip + tracking, close-sale confirm |
| S7 | `/seller/meetup/[id]/closed` | Earnings summary, next actions |
| S6R | `/seller/report` | Order selector, reason list, 10-char detail validation, evidence photo |
| S6RS | `/seller/report/sent` | Case number, next-step timeline |

**Shared state:** `useSeller()` (verification, credits, seller orders, listings) and `useListing()` (wizard draft shared across S2 → S3S). Credits use the existing `useLiff()` mock user.

**Mock-only behaviour:** auto-approval of top-up slips, sample photo filler, and the QR image are demo stand-ins; marked in the UI where they appear.
