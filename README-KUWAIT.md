# Florida United Kuwait — Hardware E-Commerce Platform

## 🇰🇼 Kuwait-Specific Changes

### Payment — TAP
- **TAP Payment Gateway** replaces Stripe for all card/KNET payments
- Supports: KNET, Visa, Mastercard, Apple Pay (via TAP)
- Setup: Get keys from https://dashboard.tap.company
- Set `TAP_SECRET_KEY`, `TAP_PUBLIC_KEY`, `TAP_MERCHANT_ID` in `.env`

### Cash on Delivery (COD)
- Full COD support added — admin can enable/disable per shipping zone
- Optional COD fee configurable in admin → Shipping Settings

### Currency
- All prices in **KWD (Kuwaiti Dinar)** — 3 decimal places (e.g. KWD 1.500)
- No VAT (Kuwait has no general VAT on most goods)
- Currency formatted as `KWD 1.500` using `en-KW` locale

### Address Format
- **Governorate** selector (6 Kuwait governorates) replaces US states
- Kuwait address fields: Block, Street, Building, Floor, Apartment
- Phone: +965 prefix with 8-digit validation (starts with 5, 6, or 9)

### Shipping
- Zones based on **governorate** (not US ZIP codes)
- Default free shipping threshold: **KWD 10**
- Admin can create per-governorate delivery rates in Admin → Shipping

### Units of Measure (UOM)
- **Fully dynamic** — admin-managed via Admin → UOMs
- Metric system (meters, kg, sqm) as defaults instead of imperial
- Products can have a UOM assigned; displayed on product page
- Seed data auto-created on first use

### AI Product Recommendations
- **Scoring algorithm** in `/api/recommendations` uses:
  - `compatibleWith` product IDs (highest weight — accessories for products)
  - `aiTags` overlap (semantic similarity)
  - `tags` overlap
  - Same category, same brand, similar price range, popularity
- Two sections on product page:
  - **Compatible Accessories** (e.g. drill bits for a drill)
  - **You Might Also Like** (similar products)
- To set up compatibility: add `compatibleWith: ['productId1', 'productId2']` to a product
- To set up AI tags: add `aiTags: ['drill', 'cordless', 'makita']` to products

### Smart Returns System
- **Auto-eligibility check**: only delivered orders within 14 days
- **Camera verification**: customer takes a photo on mobile (open camera button)
- **Auto-approval**: orders under KWD 5 with photo are auto-approved
- **Admin verification**: admin can take their own camera photo when reviewing
- Admin dashboard shows pending returns with customer photos

## 🚀 Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env.local

# 3. Fill in your Firebase + TAP credentials
# Edit .env.local

# 4. Run dev server
npm run dev
```

## 📁 Key New Files

| File | Purpose |
|------|---------|
| `src/app/api/tap/checkout/route.ts` | TAP payment session creation |
| `src/app/api/tap/webhook/route.ts` | TAP webhook (CAPTURED/FAILED) |
| `src/app/api/orders/cod/route.ts` | Cash on Delivery order creation |
| `src/app/api/recommendations/route.ts` | AI recommendation engine |
| `src/components/checkout/KuwaitCheckoutForm.tsx` | Kuwait address + TAP/COD form |
| `src/components/product/AIRecommendations.tsx` | Product recommendations UI |
| `src/components/returns/SmartReturnFlow.tsx` | Camera-verified return flow |
| `src/app/admin/returns/page.tsx` | Admin returns with camera |

## 🔧 Admin Setup Checklist

1. **TAP Gateway** → Add keys to `.env.local`
2. **Shipping Zones** → Admin → Shipping → Create zones for each governorate
3. **UOMs** → Admin → UOMs → Seed defaults or add custom units
4. **Product AI Tags** → When adding products, fill `aiTags` field for better recommendations
5. **Product Compatibility** → Link accessories to parent products via `compatibleWith`
