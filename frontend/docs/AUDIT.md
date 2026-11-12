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

