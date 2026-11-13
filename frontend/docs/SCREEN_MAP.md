# GongDong (กองดอง) — Screen Map (Phase 7)

Mobile-first LIFF app. Width target 390px, max 430px. All routes open as
`https://liff.line.me/{LIFF_ID}<path>`.

## Buyer

| Route | Purpose | Phase |
|---|---|---|
| `/` | Feed, search entry, categories, cart/bell | 2 |
| `/search` | Search + filters (grade, price, delivery, single/set) | 2 |
| `/book/[id]` | Book detail, gallery, grade, seller card, add to cart | 2 |
| `/seller/[sellerId]` | Public shop page (rating, reviews, report shop) | 2 |
| `/cart` | Cart split by shop, request rules | 2 |
| `/cart/success` | Request sent confirmation | 2 |
| `/wishlist` | Wishlist | 2 |
| `/addresses` | Address list | 2 |
| `/addresses/edit` | Address form (buyer's own phone only) | 2 |
| `/orders` | Tabs ที่ซื้อ / ที่ขาย, action badges, timers | 4 |
| `/orders/[id]` | Order detail for every status, next action, chat inline | 4 |
| `/orders/[id]/schedule` | Meetup time + map pin confirm | 4 |
| `/orders/[id]/handover` | Buyer code / seller code input | 4 |
| `/orders/[id]/tracking` | Parcel tracking (buyer read-only) | 4 |
| `/orders/[id]/no-show` | Seller report + buyer rebuttal | 4 |
| `/orders/[id]/review` | Rate shop + grade match | 4 |
| `/notifications` | Notification list | 2 |
| `/help` | Help / FAQ | 2 |

## Seller

| Route | Purpose | Phase |
|---|---|---|
| `/seller` | Shop hub (header, credits, tabs, reviews, settings) | 3 |
| `/seller/setup` | Shop setup (shop info, schedule, national-ID KYC) | 3 |
| `/seller/list` | Listing wizard step 1 (single/set, ISBN scan/manual) | 3 |
| `/seller/list/details` | Step 2: title, author, description, categories | 3 |
| `/seller/list/step-2` | Step 3: 4 photos (camera or gallery) + defects | 3 |
| `/seller/list/step-3` | Step 4: 5-point checklist → grade | 3 |
| `/seller/list/step-4` | Step 5: price + delivery | 3 |
| `/seller/list/success` | Listing success + share | 3 |
| `/seller/listings/[id]/edit` | Edit / hide listing | 3 |
| `/seller/credits` | Credit packs + history | 3 |
| `/seller/credits/pay` | Credit QR + slip | 3 |
| `/seller/credits/success` | Credit result | 3 |
| `/seller/credits/verify` | First-order verification top-up gate | 3/4 |
| `/seller/report` | Report a problem | 4 |
| `/seller/report/sent` | Report sent confirmation | 4 |

## Admin (not built — skipped per request)

Phase 5 scope (`/admin`, slips, disputes, shops, users/blacklist) is intentionally
not implemented.

## Foundations / tooling

| Route | Purpose | Phase |
|---|---|---|
| `/onboarding` | Value props → setup | 1/2 |
| `/setup` | Nickname/avatar setup | 1/2 |
| `/debug` | LIFF diagnostics (dev/staging only) | 1 |
| `/design-system` | Component gallery + v4 showcase | 1 |
| `/line-preview` | Rich Menu + Flex templates (spec only) | 6 |

## Notes

- Chat is embedded in `/orders/[id]`; there is no separate `/orders/[id]/chat` route.
- Legacy phone-number routes `/seller/orders`, `/seller/orders/[id]/accepted`,
  and `/seller/meetup/*` were deleted in Phase 4.
- `/seller/verify` (heavy KYC) was deleted; verification moved to first order.
- No `tel:` links, phone numbers, LINE IDs, bank account numbers, QR codes, or
  payment slips are shown to the other party anywhere in the app. Orders use cash
  on delivery only.
- Seller KYC collects national ID number and legal name only; it is never shown
  on the public shop page.
