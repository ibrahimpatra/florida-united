# Graph Report - florida-united-fixed  (2026-11-21)

## Corpus Check
- 332 files · ~400,351 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 2, .ttf 2, .rules 2)

## Summary
- 2099 nodes · 6075 edges · 102 communities (87 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 166 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- utils.ts
- shipping-admin.ts
- app/shop/products/[slug]/page.tsx
- public/route.ts
- react
- login/page.tsx
- ProductDetailClient.tsx
- popups.ts
- getAdminDb
- FakeDb
- dependencies
- stats-server.ts
- formatPrice
- v20.test.ts
- firebase.ts
- react
- place-order-handler.ts
- returns/route.ts
- mobile/package.json
- ProductError
- logger.ts
- steps
- package.json
- payments/index.ts
- import-assist.ts
- tools.ts
- firestore.ts
- Communities (100 total, 18 thin omitted)
- next
- jobs.ts
- shippingService.ts
- assist/route.ts
- agent/route.ts
- brand.ts
- useLanguage
- Florida United Kuwait: online store
- settings/route.ts
- brands/[id]/route.ts
- types/index.ts
- next-auth
- arabicMeta
- getBrand
- app3d.js
- bundles/[id]/route.ts
- invoice-pdf.ts
- order-actions.ts
- v18.test.ts
- legal-content.ts
- ar.ts
- compilerOptions
- upload/route.ts
- seo.ts
- r2.ts
- promo-tiles/route.ts
- admin/settings/page.tsx
- products/route.ts
- v21.test.ts
- orders-server.ts
- manifest.json
- addresses/[id]/route.ts
- Header
- brands.ts
- app/layout.tsx
- import/categories/route.ts
- recommend.ts
- PopupManager.tsx
- app/shop/[category]/page.tsx
- ai.ts
- react-dom@^18.3.1
- scripts
- shipping.ts
- seed.js
- firebase-admin
- import/page.tsx
- products/[id]/route.ts
- template/route.ts
- uoms/[id]/route.ts
- bundles/route.ts
- shipping/page.tsx
- admin/loyalty/route.ts
- FlashDealsSection.tsx
- Graph Report - florida-united-fixed  (2026-11-20)
- reviews/route.ts
- clsx
- getBrand
- next.config.js
- config/route.ts
- forgot/route.ts
- app/returns-policy/page.tsx
- localize.ts
- globals.css.d.ts
- vercel.json
- sharp
- graph/page.tsx
- @stripe/react-stripe-js@^2.7.3
- framer-motion@^11.3.2
- qrcode.react@^3.2.0

## God Nodes (most connected - your core abstractions)
1. `getAdminDb()` - 177 edges
2. `next` - 152 edges
3. `useLanguage()` - 111 edges
4. `next-auth` - 84 edges
5. `Communities (100 total, 18 thin omitted)` - 83 edges
6. `react` - 83 edges
7. `withLog()` - 82 edges
8. `formatPrice()` - 81 edges
9. `lucide-react` - 80 edges
10. `authOptions` - 68 edges

## Surprising Connections (you probably didn't know these)
- `God Nodes (most connected - your core abstractions)` --references--> `Header()`  [INFERRED]
  docs/graphify/GRAPH_REPORT.md → src/components/layout/Header.tsx
- `God Nodes (most connected - your core abstractions)` --references--> `getAdminDb()`  [INFERRED]
  docs/graphify/GRAPH_REPORT.md → src/lib/firebase-admin.ts
- `God Nodes (most connected - your core abstractions)` --references--> `withLog()`  [INFERRED]
  docs/graphify/GRAPH_REPORT.md → src/lib/logger.ts
- `God Nodes (most connected - your core abstractions)` --references--> `formatPrice()`  [INFERRED]
  docs/graphify/GRAPH_REPORT.md → src/lib/utils.ts
- `Surprising Connections (you probably didn't know these)` --references--> `__setAdminDbForTests()`  [INFERRED]
  docs/graphify/GRAPH_REPORT.md → src/lib/firebase-admin.ts

## Import Cycles
- None detected.

## Communities (102 total, 15 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.06
Nodes (45): react-hot-toast, OrderDetailPage(), STEP_ORDER, STEPS, OrdersPage(), STATUS_COLOR, AdminCustomersPage(), AdminDashboard() (+37 more)

### Community 1 - "shipping-admin.ts"
Cohesion: 0.10
Nodes (35): __GET(), __POST(), save(), __DELETE(), DELETE, guard(), __PUT(), PUT (+27 more)

### Community 2 - "app/shop/products/[slug]/page.tsx"
Cohesion: 0.15
Nodes (18): generateMetadata(), revalidate, BrandPage(), generateMetadata(), Props, revalidate, BASE, ProductPage() (+10 more)

### Community 3 - "public/route.ts"
Cohesion: 0.28
Nodes (7): dynamic, __GET(), GET, __POST(), loadShippingSettings(), onlineProvider(), DEFAULT_RETURN_DAYS

### Community 4 - "react"
Cohesion: 0.14
Nodes (20): react, HomePage(), revalidate, BrandsSection(), HomeBrand, CategoryGrid(), CategorySkeleton(), GRADIENTS (+12 more)

### Community 5 - "login/page.tsx"
Cohesion: 0.29
Nodes (12): LoginForm(), LoginPage(), FormData, RegisterPage(), AdminSidebar(), nav, SidebarContent(), BrandMark() (+4 more)

### Community 6 - "ProductDetailClient.tsx"
Cohesion: 0.12
Nodes (31): zustand, WishlistPage(), CartPageClient(), MiniCart(), Props, AIRecommendations(), Props, REASON_KEYS (+23 more)

### Community 7 - "popups.ts"
Cohesion: 0.09
Nodes (36): dynamic, __POST(), POST, Ctx, __DELETE(), DELETE, dynamic, __PUT() (+28 more)

### Community 8 - "getAdminDb"
Cohesion: 0.08
Nodes (32): __PUT(), __GET(), __PUT(), load(), __GET(), __DELETE(), __PUT(), __GET() (+24 more)

### Community 9 - "FakeDb"
Cohesion: 0.10
Nodes (7): FakeCol, FakeDb, FakeQuery, FakeRef, FakeSnap, seedShop(), charged()

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (35): dependencies, bcryptjs@^2.4.3, date-fns@^3.6.0, firebase-admin@^12.2.0, @hookform/resolvers@^3.9.0, lucide-react@^0.400.0, next@14.2.5, next-auth@^4.24.7 (+27 more)

### Community 11 - "stats-server.ts"
Cohesion: 0.21
Nodes (12): dynamic, maxDuration, __POST(), POST, __GET(), adminGetDashboardStats(), adminRebuildStats(), dayKeyBack() (+4 more)

### Community 12 - "formatPrice"
Cohesion: 0.23
Nodes (15): lucide-react, AdminProductsPage(), CheckoutPage(), useLoyaltyPlan(), FreeShippingNudge(), QtyStepper(), CheckoutSuggestions(), CouponBox() (+7 more)

### Community 13 - "v20.test.ts"
Cohesion: 0.19
Nodes (19): dynamic, __GET(), GET, adjustPoints(), awardForDelivered(), DEFAULT_LOYALTY, earnPoints(), LoyaltySettings (+11 more)

### Community 14 - "firebase.ts"
Cohesion: 0.25
Nodes (6): firebase@^10.12.2, firebase, auth, db, firebaseConfig, storage

### Community 15 - "react"
Cohesion: 0.06
Nodes (66): AdminBannersPage(), EMPTY, AdminBrandsPage(), EMPTY, AdminBundlesPage(), Bundle, BundleItem, EMPTY_BUNDLE (+58 more)

### Community 16 - "place-order-handler.ts"
Cohesion: 0.10
Nodes (28): dynamic, __GET(), GET, dynamic, __POST(), POST, convert(), dynamic (+20 more)

### Community 17 - "returns/route.ts"
Cohesion: 0.17
Nodes (15): dynamic, GET, OPEN, __PATCH(), PATCH, __POST(), POST, round3() (+7 more)

### Community 18 - "mobile/package.json"
Cohesion: 0.09
Nodes (29): dependencies, @capacitor/android@^6.1.2, @capacitor/app@^6.0.1, @capacitor/core@^6.1.2, @capacitor/ios@^6.1.2, @capacitor/splash-screen@^6.0.2, @capacitor/status-bar@^6.0.1, description (+21 more)

### Community 19 - "ProductError"
Cohesion: 0.12
Nodes (30): __POST(), __DELETE(), DELETE, __PUT(), PUT, __POST(), __DELETE(), __PUT() (+22 more)

### Community 20 - "logger.ts"
Cohesion: 0.08
Nodes (24): dynamic, __GET(), GET, DELETE, PUT, POST, DELETE, PUT (+16 more)

### Community 21 - "steps"
Cohesion: 0.07
Nodes (27): defaults, runs-on, steps, run, SITE, site_url, jobs, apk (+19 more)

### Community 22 - "package.json"
Cohesion: 0.10
Nodes (27): description, devDependencies, autoprefixer@^10.4.19, eslint@^8.57.0, eslint-config-next@14.2.5, postcss@^8.4.39, tailwindcss@^3.4.6, @types/bcryptjs@^2.4.6 (+19 more)

### Community 23 - "payments/index.ts"
Cohesion: 0.15
Nodes (15): PROVIDERS, base(), key(), mf(), myfatoorahProvider, stripeProvider, key(), tap() (+7 more)

### Community 24 - "import-assist.ts"
Cohesion: 0.11
Nodes (24): dynamic, maxDuration, __POST(), POST, dynamic, maxDuration, __POST(), POST (+16 more)

### Community 25 - "tools.ts"
Cohesion: 0.12
Nodes (24): __GET(), __POST(), __GET(), ADMIN_DECLS, lim(), order(), pend(), preview() (+16 more)

### Community 26 - "firestore.ts"
Cohesion: 0.06
Nodes (33): categoriesCollection, couponsCollection, createReturnRequest(), getActiveOffers(), getAllOrders(), getAllReturns(), getAllUsers(), getBanners() (+25 more)

### Community 27 - "Communities (100 total, 18 thin omitted)"
Cohesion: 0.02
Nodes (83): Communities (100 total, 18 thin omitted), Community 0 - "utils.ts", Community 10 - "dependencies", Community 11 - "stats-server.ts", Community 12 - "formatPrice", Community 13 - "v20.test.ts", Community 14 - "firebase.ts", Community 15 - "react" (+75 more)

### Community 28 - "next"
Cohesion: 0.09
Nodes (22): bcryptjs, PUT, dynamic, GET, PUT, __POST(), POST, dynamic (+14 more)

### Community 29 - "jobs.ts"
Cohesion: 0.13
Nodes (29): @vercel/functions, dynamic, __GET(), GET, guard(), maxDuration, __POST(), POST (+21 more)

### Community 30 - "shippingService.ts"
Cohesion: 0.10
Nodes (5): calculateShipping(), DEFAULT_UOMS, getShippingConfig(), getShippingZones(), haversineKm()

### Community 31 - "assist/route.ts"
Cohesion: 0.12
Nodes (21): dynamic, maxDuration, __POST(), POST, boolOrUndef(), CatCtx, CATEGORY_COLUMNS, CATEGORY_TEMPLATE_ROWS (+13 more)

### Community 32 - "agent/route.ts"
Cohesion: 0.21
Nodes (10): viaGemini(), call(), cooling, FALLBACK_MODELS, GeminiError, geminiModels(), generate(), GenOpts (+2 more)

### Community 33 - "brand.ts"
Cohesion: 0.15
Nodes (22): BrandThemeSection(), ColourField(), ImageField(), PRESETS, Vals, BLACK, Brand, colourScale() (+14 more)

### Community 34 - "useLanguage"
Cohesion: 0.17
Nodes (16): God Nodes (most connected - your core abstractions), ForgotPasswordPage(), ResetForm(), ResetPasswordPage(), GlobalError(), BrandHero(), CategoryHero(), Crumbs() (+8 more)

### Community 35 - "Florida United Kuwait: online store"
Cohesion: 0.08
Nodes (23): 10. SEO, 11. Troubleshooting, 12. Project layout, 1. Run it on your computer (or Codespaces), 2. Settings (environment variables), 3. Firebase (database), 4. Cloud images with Cloudflare R2, 5. Payments (+15 more)

### Community 36 - "settings/route.ts"
Cohesion: 0.11
Nodes (22): __DELETE(), DELETE, dynamic, __GET(), GET, __GET(), GET, __POST() (+14 more)

### Community 37 - "brands/[id]/route.ts"
Cohesion: 0.43
Nodes (6): __DELETE(), DELETE, isAdmin(), __PUT(), PUT, deleteBrand()

### Community 38 - "types/index.ts"
Cohesion: 0.06
Nodes (35): react-hook-form, AddressBookPage(), EMPTY, AdminCouponsPage(), EMPTY, AdminReturnsPage(), STATUS_COLORS, FormData (+27 more)

### Community 39 - "next-auth"
Cohesion: 0.06
Nodes (44): next, next-auth, SuperOnly(), dynamic, GET(), SuperOnly(), SuperOnly(), AdminLayout() (+36 more)

### Community 40 - "arabicMeta"
Cohesion: 0.14
Nodes (13): generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), revalidate, generateMetadata(), metadata (+5 more)

### Community 41 - "getBrand"
Cohesion: 0.29
Nodes (15): __POST(), baseTemplate(), emailPort, esc(), fmtKWD(), sendAdminNewOrderNotification(), sendContactEmail(), sendMailLogged() (+7 more)

### Community 42 - "app3d.js"
Cohesion: 0.13
Nodes (16): btn, byId, cname, comms, ctl, deg, el, G (+8 more)

### Community 43 - "bundles/[id]/route.ts"
Cohesion: 0.27
Nodes (9): __DELETE(), DELETE, __GET(), GET, __PUT(), PUT, adminDeleteBundle(), adminGetBundleById() (+1 more)

### Community 44 - "invoice-pdf.ts"
Cohesion: 0.18
Nodes (17): asDate(), buildInvoicePdf(), clean(), kd(), PAY_METHOD, PAY_STATUS, bidiWidth(), drawBidiLine() (+9 more)

### Community 45 - "order-actions.ts"
Cohesion: 0.15
Nodes (17): __PATCH(), __POST(), adminUpdateOrderTracking(), bad(), ChangeInput, changeOrderStatus(), FLOW, VALID_STATUSES (+9 more)

### Community 46 - "v18.test.ts"
Cohesion: 0.14
Nodes (9): __setAdminDbForTests(), applyWrite(), clone(), kind(), admin, cust, ENV, saved (+1 more)

### Community 47 - "legal-content.ts"
Cohesion: 0.15
Nodes (16): metadata, Page(), generateMetadata(), generateMetadata(), metadata, Page(), metadata, Page() (+8 more)

### Community 48 - "ar.ts"
Cohesion: 0.18
Nodes (11): ar, baseAr, baseEn, en, Translations, p1Ar, p1En, p2Ar (+3 more)

### Community 49 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 50 - "upload/route.ts"
Cohesion: 0.13
Nodes (15): dynamic, __POST(), POST, ADMIN_FOLDERS, CUSTOMER_FOLDERS, DELETE, dynamic, __POST() (+7 more)

### Community 51 - "seo.ts"
Cohesion: 0.24
Nodes (12): generateMetadata(), metadata, applyLang(), isAdminPath(), LanguageProvider(), lookup(), hasArabicTwin(), isArabicPath() (+4 more)

### Community 52 - "r2.ts"
Cohesion: 0.21
Nodes (14): @aws-sdk/client-s3@^3.1169.0, @aws-sdk/client-s3, __DELETE(), dynamic, GET(), TYPES, fixImageUrl(), ownStorageHost() (+6 more)

### Community 53 - "promo-tiles/route.ts"
Cohesion: 0.19
Nodes (16): __DELETE(), DELETE, dynamic, __GET(), GET, isAdmin(), __PATCH(), PATCH (+8 more)

### Community 54 - "admin/settings/page.tsx"
Cohesion: 0.18
Nodes (10): AdminSettingsPage(), DEFAULT_SETTINGS, Field(), NumField(), Section(), Settings, alt, contentType (+2 more)

### Community 55 - "products/route.ts"
Cohesion: 0.15
Nodes (18): Suggested Questions, __GET(), __GET(), GET, __POST(), POST, dynamic, __GET() (+10 more)

### Community 56 - "v21.test.ts"
Cohesion: 0.35
Nodes (9): ALLOWED, attrsOf(), esc(), renderDescription(), safeUrl(), sanitizeHtml(), stripHtml(), unesc() (+1 more)

### Community 57 - "orders-server.ts"
Cohesion: 0.09
Nodes (40): __POST(), cleanAddress(), kuwaitDay(), loadDeals(), NumberCollision, placeOrder(), PlaceOrderInput, quoteShipping() (+32 more)

### Community 58 - "manifest.json"
Cohesion: 0.17
Nodes (11): background_color, categories, description, display, icons, lang, name, orientation (+3 more)

### Community 59 - "addresses/[id]/route.ts"
Cohesion: 0.21
Nodes (11): __DELETE(), DELETE, __PUT(), PUT, __GET(), GET, __POST(), POST (+3 more)

### Community 60 - "Header"
Cohesion: 0.14
Nodes (28): AccountPage(), metadata, AccountSettingsPage(), metadata, BundlesPage(), CartPage(), metadata, CheckoutSuccessPage() (+20 more)

### Community 61 - "brands.ts"
Cohesion: 0.05
Nodes (60): RFC-4180, admin(), dynamic, __GET(), GET, load(), maxDuration, __POST() (+52 more)

### Community 62 - "app/layout.tsx"
Cohesion: 0.22
Nodes (11): generateMetadata(), revalidate, RootLayout(), AgentChat(), inline(), linkify(), Msg, Pending (+3 more)

### Community 63 - "import/categories/route.ts"
Cohesion: 0.33
Nodes (6): admin(), dynamic, __GET(), GET, maxDuration, POST

### Community 64 - "recommend.ts"
Cohesion: 0.27
Nodes (8): __GET(), GET, loadPairCounts(), Pairs, Rec, scoreRecommendations(), STOP, tokens()

### Community 65 - "PopupManager.tsx"
Cohesion: 0.38
Nodes (8): alreadySeen(), markSeen(), P, pageKey(), PopupCard(), PopupManager(), store(), Providers()

### Community 66 - "app/shop/[category]/page.tsx"
Cohesion: 0.26
Nodes (10): __GET(), generateMetadata(), CategoryPage(), generateMetadata(), Props, BASE, both(), Entry (+2 more)

### Community 67 - "ai.ts"
Cohesion: 0.13
Nodes (28): dynamic, gemini(), maxDuration, __POST(), POST, viaGemini(), systemPrompt(), FOLLOWUP_RULE (+20 more)

### Community 69 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, db:seed, db:seed:uoms, dev, lint, start, test

### Community 70 - "shipping.ts"
Cohesion: 0.21
Nodes (12): ProductVariantSelector(), Props, SelectedUOM, VariantSelection, ProductUOM, ProductVariantGroup, ShippingCalculationResult, ShippingInput (+4 more)

### Community 71 - "seed.js"
Cohesion: 0.33
Nodes (4): app, db, { getFirestore }, { initializeApp, cert }

### Community 72 - "firebase-admin"
Cohesion: 0.35
Nodes (9): firebase-admin, dynamic, __POST(), POST, cardEnabled(), DEFAULT_USD_RATE, getStripe(), getUsdRate() (+1 more)

### Community 73 - "import/page.tsx"
Cohesion: 0.33
Nodes (4): BADGE, Plan, PlanRow, Result

### Community 74 - "products/[id]/route.ts"
Cohesion: 0.19
Nodes (11): __DELETE(), DELETE, __GET(), GET, __PUT(), PUT, __GET(), GET (+3 more)

### Community 75 - "template/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, __GET(), GET, buildTemplateXlsx()

### Community 76 - "uoms/[id]/route.ts"
Cohesion: 0.23
Nodes (9): __DELETE(), DELETE, __PUT(), PUT, GET, POST, adminDeleteUOM(), AdminInputError (+1 more)

### Community 77 - "bundles/route.ts"
Cohesion: 0.29
Nodes (9): dynamic, __GET(), GET, __POST(), POST, adminCreateBundle(), adminGetBundles(), getStorefrontBundles() (+1 more)

### Community 78 - "shipping/page.tsx"
Cohesion: 0.27
Nodes (9): AdminShippingPage(), emptyRate(), emptyZone(), RATE_METHODS, ZONE_TYPES, ShippingConfig, ShippingRate, ShippingZone (+1 more)

### Community 79 - "admin/loyalty/route.ts"
Cohesion: 0.31
Nodes (8): admin(), dynamic, __GET(), GET, __POST(), POST, __PUT(), PUT

### Community 80 - "FlashDealsSection.tsx"
Cohesion: 0.42
Nodes (8): bigText(), Countdown(), FlashDealsSection(), Icon(), MiniLeft(), target(), useRemaining(), FlashDeal

### Community 81 - "Graph Report - florida-united-fixed  (2026-11-20)"
Cohesion: 0.29
Nodes (6): Community Hubs (Navigation), Corpus Check, Graph Report - florida-united-fixed  (2026-11-20), Import Cycles, Knowledge Gaps, Summary

### Community 82 - "reviews/route.ts"
Cohesion: 0.38
Nodes (6): __GET(), GET, __POST(), POST, adminAddReview(), adminGetProductReviews()

### Community 83 - "clsx"
Cohesion: 0.14
Nodes (8): clsx@^2.1.1, exceljs@^4.4.0, nanoid@^5.0.7, nodemailer@^7.0.13, clsx, exceljs, nanoid, nodemailer

### Community 84 - "getBrand"
Cohesion: 0.23
Nodes (13): Surprising Connections (you probably didn't know these), generateMetadata(), revalidate, generateViewport(), generateMetadata(), handleShare(), getBrand(), sendReturnStatusEmail() (+5 more)

### Community 86 - "config/route.ts"
Cohesion: 0.33
Nodes (6): dynamic, __GET(), GET, POST, PUT, adminGetShippingConfig()

### Community 87 - "forgot/route.ts"
Cohesion: 0.47
Nodes (5): dynamic, __POST(), POST, sha(), sendPasswordResetEmail()

### Community 88 - "app/returns-policy/page.tsx"
Cohesion: 0.53
Nodes (4): generateMetadata(), metadata, Page(), RETURNS

## Knowledge Gaps
- **1 isolated node(s):** `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 741 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next-auth` to `utils.ts`, `shipping-admin.ts`, `app/shop/products/[slug]/page.tsx`, `public/route.ts`, `react`, `login/page.tsx`, `ProductDetailClient.tsx`, `popups.ts`, `getAdminDb`, `dependencies`, `stats-server.ts`, `formatPrice`, `v20.test.ts`, `react`, `place-order-handler.ts`, `returns/route.ts`, `ProductError`, `logger.ts`, `package.json`, `import-assist.ts`, `next`, `jobs.ts`, `assist/route.ts`, `useLanguage`, `settings/route.ts`, `brands/[id]/route.ts`, `types/index.ts`, `arabicMeta`, `bundles/[id]/route.ts`, `legal-content.ts`, `upload/route.ts`, `seo.ts`, `r2.ts`, `promo-tiles/route.ts`, `admin/settings/page.tsx`, `products/route.ts`, `addresses/[id]/route.ts`, `Header`, `brands.ts`, `app/layout.tsx`, `import/categories/route.ts`, `recommend.ts`, `PopupManager.tsx`, `app/shop/[category]/page.tsx`, `ai.ts`, `firebase-admin`, `products/[id]/route.ts`, `template/route.ts`, `uoms/[id]/route.ts`, `bundles/route.ts`, `admin/loyalty/route.ts`, `FlashDealsSection.tsx`, `reviews/route.ts`, `config/route.ts`, `forgot/route.ts`, `app/returns-policy/page.tsx`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getAdminDb()` (e.g. with `God Nodes (most connected - your core abstractions)` and `Suggested Questions`) actually correct?**
  _`getAdminDb()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061569416498993966 - nodes in this community are weakly interconnected._
- **Why does `getAdminDb()` connect `getAdminDb` to `shipping-admin.ts`, `app/shop/products/[slug]/page.tsx`, `public/route.ts`, `popups.ts`, `stats-server.ts`, `v20.test.ts`, `place-order-handler.ts`, `returns/route.ts`, `ProductError`, `payments/index.ts`, `tools.ts`, `next`, `jobs.ts`, `assist/route.ts`, `brand.ts`, `useLanguage`, `settings/route.ts`, `brands/[id]/route.ts`, `next-auth`, `bundles/[id]/route.ts`, `order-actions.ts`, `upload/route.ts`, `promo-tiles/route.ts`, `products/route.ts`, `orders-server.ts`, `addresses/[id]/route.ts`, `brands.ts`, `import/categories/route.ts`, `recommend.ts`, `app/shop/[category]/page.tsx`, `firebase-admin`, `products/[id]/route.ts`, `uoms/[id]/route.ts`, `bundles/route.ts`, `reviews/route.ts`, `getBrand`, `config/route.ts`, `forgot/route.ts`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useLanguage()` (e.g. with `God Nodes (most connected - your core abstractions)` and `Suggested Questions`) actually correct?**
  _`useLanguage()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `shipping-admin.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._