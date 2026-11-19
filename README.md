# Florida United Kuwait: online store

Next.js 14 store for hardware and electrical supplies. Bilingual (English and Arabic, right-to-left), prices in KWD, Firestore database, cash on delivery and optional online card payment, AI shopping assistant, admin panel.

This is the only README. Everything you need to run, set up and deploy is below.

---

## 1. Run it on your computer (or Codespaces)

```bash
npm install
cp .env.example .env.local      # then fill in the values from section 2
npm run dev                     # http://localhost:3000
npm test                        # 74 automated checks, no database needed
npm run build                   # production build
```

Make yourself an admin: register on the site, open Firestore (Firebase console), collection `users`, your document, set `role` to `admin`. Sign out and in again. Then open `/admin/dashboard`.

Optional sample data: `npm run db:seed` (categories and products) and `npm run db:seed:uoms` (units like pcs, kg, m).

---

## 2. Settings (environment variables)

Put these in `.env.local` on your computer, and in **Vercel > Project > Settings > Environment Variables** when deployed. After changing them on Vercel, redeploy.

| Name | Needed? | What it is |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Your real address, e.g. `https://yourdomain.com`. Used for links, sitemap, emails, payment returns |
| `NEXTAUTH_URL` | yes | Same address as above |
| `NEXTAUTH_SECRET` | yes | Any long random text (`openssl rand -base64 32`) |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | yes | From the service account JSON (section 3). The private key must keep its `\n` line breaks and the `-----BEGIN PRIVATE KEY-----` line |
| `NEXT_PUBLIC_FIREBASE_*` (6 values) | yes | Firebase console > Project settings > Your apps |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | optional | Order emails and password reset. Gmail needs an app password |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | recommended | Image storage (section 4). Without them uploads go to Firebase Storage |
| `GEMINI_API_KEY` | optional | AI assistant and the Arabic Translate button. Key from aistudio.google.com |
| `GEMINI_MODEL` | optional | A model to try first. Others are tried automatically (section 6) |
| `ANTHROPIC_API_KEY` | optional | Turns on **Claude** for the assistant, Translate and "Write with AI" (Gemini stays as backup). Key from console.anthropic.com |
| `ANTHROPIC_MODEL` / `ANTHROPIC_FAST_MODEL` | optional | Defaults `claude-sonnet-5-5` / `claude-haiku-5-5` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional | Card payments with Stripe (charged in USD) |
| `TAP_SECRET_KEY` | optional | Card payments with Tap (charged in KWD) |
| `MYFATOORAH_API_KEY`, `MYFATOORAH_BASE_URL` | optional | Card payments with MyFatoorah. Base URL only for the test server: `https://apitest.myfatoorah.com` |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | optional | WhatsApp order messages and the chat link |
| `CRON_SECRET` | recommended | Protects the cleanup job for unpaid card orders. Vercel sends it automatically |
| `LOG_LEVEL` | optional | `warn` (default), `info`, `debug`, `silent` (section 9) |

Card payment shows at checkout **only** when the chosen provider has its key. No key, no card option, so customers never see a broken payment button.

---

## 3. Firebase (database)

1. Firebase console > create a project > Build > **Firestore Database** > create (production mode).
2. Project settings > **Service accounts** > Generate new private key. Copy `project_id`, `client_email`, `private_key` into the three `FIREBASE_ADMIN_*` settings.
3. Firestore > Rules > paste the contents of `firestore.rules` (it blocks all direct browser access; the app uses the server key) > Publish. If you use Firebase Storage as the image fallback, paste `storage.rules` in Storage > Rules.

---

## 4. Cloud images with Cloudflare R2

Why: product photos must live outside the app. On Vercel the app's own files are read-only after deploy, so uploads cannot be saved in the `public` folder. R2 gives 10 GB free per month, no charge for downloads, and the image address can be on your own domain (good for Google Images).

**Step by step**

1. Create a free account at cloudflare.com. Dashboard > **R2 Object Storage** > subscribe to the free plan (a payment card is asked for, nothing is charged within the free limits).
2. **Create bucket**: name it for example `florida-images`. Location: automatic.
3. **Make images public** (choose one):
   - Quick start: bucket > Settings > Public access > allow the **r2.dev subdomain**. Copy the address like `https://pub-abc123.r2.dev`.
   - Recommended for SEO: bucket > Settings > **Custom domains** > add `img.yourdomain.com` (your domain must be on Cloudflare DNS). Use `https://img.yourdomain.com`.
4. R2 overview page > **Manage API tokens** > Create API token > permission **Object Read & Write** > limit it to your bucket > Create. Copy the **Access Key ID** and **Secret Access Key** (shown once). The **Account ID** is on the R2 overview page.
5. Add the five settings (locally and on Vercel), then redeploy:
   ```
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=florida-images
   R2_PUBLIC_URL=https://img.yourdomain.com
   ```
6. Test: Admin > Products > edit a product > upload an image. It should appear, and the link should start with your `R2_PUBLIC_URL`.

**What the app does with each upload:** converts it to WebP, limits it to 1600 px wide, and names it after the product, for example `products/led-flood-light-50w-k3j9x2.webp`. Product pages list the images for Google and carry alt text. Images already uploaded keep working after you switch.

Startup warns "R2 image storage... not set" until the five settings exist.

---

## 5. Payments

Admin > Settings > **Online card payment** picks the provider: Automatic (first with keys), Stripe, Tap, MyFatoorah or Off. The same screen shows which providers have keys on the server.

- **Stripe**: Dashboard > Developers > API keys. Add a webhook to `https://YOUR-DOMAIN/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`. Charged in USD at the rate in Settings.
- **Tap** and **MyFatoorah**: add the key. Charged in KWD. The app never trusts the browser redirect: it asks the provider server to server before marking an order paid. These two are written to the providers' documentation but have not been run against their live servers, so test each in test mode first.
- Card orders left unpaid for 2 hours are cancelled and their stock released. Vercel Hobby runs the cleanup once a day (`vercel.json`), and it also runs whenever a new order is placed.
- Refunds: Stripe refunds are automatic on cancel. For Tap and MyFatoorah the order is flagged "needs refund" and you refund in their dashboard.

---

## 6. AI assistant and Arabic translation (Gemini)

Needs `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`. With the Claude key, Claude answers first and Gemini is the backup. The assistant chat button appears on every page, including the admin area, so staff can ask it for orders, stock, product copy and translations. **Admin > Products > Write with AI** drafts the English and Arabic descriptions, meta text and tags from the name and facts you type (it is told not to invent specifications; always read before saving). The shopper assistant answers product and delivery questions and can look up orders. For admins it can also change order status, add tracking, adjust stock, check customers and returns.

If a model is busy ("high demand", 429 or 503), retired, or the network fails, the next model is tried automatically (`gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`) and the busy one is skipped for a minute. Only a bad API key stops it. Shoppers see a friendly message; **admins also see the technical reason** marked `[admin only]`, in the assistant, at checkout and on invoices. Google retires model names over time. If every model fails with "does not exist", set `GEMINI_MODEL` to a current name from aistudio.google.com.

The **Translate to Arabic** button on admin forms sends the English text to Gemini and fills the Arabic fields.

---

## 7. Running the store (Admin)

| Page | What for |
|---|---|
| Dashboard | Sales, orders, low stock |
| Products | Add and edit. Prices, stock, extra selling units (box, carton), images, Arabic text. A product with order history is **archived**, never deleted |
| **Import** | Upload an Excel (.xlsx) or CSV for all products. Download the template, fill it, upload, read the preview (new, update, problem per row), then import. Existing SKU updates only the columns you fill; new categories and units are created for you |
| Orders | Change status, tracking, refunds. Unpaid card orders cannot be shipped |
| Categories, Units, Bundles | Catalogue structure. A category with products or a unit in use cannot be deleted |
| Flash Deals | Percent, amount or buy-one-get-one, for all, categories (subcategories included) or chosen products. Shows under the home page hero banner and on `/deals` |
| Coupons | Codes with limits. A used coupon is switched off, not deleted |
| **Popups** | Create popups: headline, message, image, coupon code, button. Choose when (after seconds, on scroll, on leaving), who (everyone, visitors, signed-in), how often, which pages, dates, shape and colour. Start from a ready template such as "20% off first order". Shows views and clicks. Create the coupon under Coupons first |
| Banners | Home page hero slides |
| Shipping Zones | Delivery cost by governorate, free-delivery threshold |
| **Issues** | Every server problem from anywhere in the app (login, register, orders, coupons, deals, bundles, search, uploads...), saved with the reason, how many times, and who. Works even for login and register failures. Dismiss or clear |
| Settings | Company name, logo, favicon, colours, contact details, online payment provider, USD rate |

**Admin-only error detail (whole app):** shoppers always get a short friendly message. When you are signed in as admin, every failed API call also shows a red `[admin only] METHOD /api/... status: reason` message on screen, the error page shows the technical text, and the same reason is saved under Issues. This is automatic for every API route.

**Brand and theme** (Settings): the company name, logo and colours change the browser tab, header, footer, emails, invoices, WhatsApp text and the assistant, within about a minute of saving. Export theme saves name, logo and colours to a file; Import theme loads it for another client.

Checkout shows a "free delivery progress" bar, a coupon box with the discount line, and "You may also need" suggestions. The cart suggests related products.

---

## 8. Deploy on Vercel

1. Push the project to GitHub, import it on vercel.com.
2. Add the settings from section 2. `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` must be your final address.
3. Deploy. `vercel.json` already contains the daily cleanup job (Hobby plan allows one run a day).
4. After the first deploy: submit `https://YOUR-DOMAIN/sitemap.xml` in Google Search Console. Both English and Arabic (`/ar/...`) pages are listed.

---

## 9. Seeing problems (logging)

By default only warnings and errors are printed: missing settings at startup, any API response with status 400 or above, crashes, failed emails, failed payments, bad logins. Passwords, keys and card data are masked. Set `LOG_LEVEL=info` for one line per request, `debug` to include request bodies. On Vercel: Project > Logs (or Observability) and filter by "error". In the browser console filter by `[app]`.

---

## 10. SEO

Every public page has its own title, description and canonical link. English and Arabic versions (`/ar/...`) point to each other with `hreflang`. The sitemap lists both and only active products. Product pages carry price and stock data; the home page carries organisation and search-box data; product and category pages carry breadcrumbs. A default share image and app icons are included. Order tracking, cart, checkout and account pages are kept out of search results.

---

## 11. Troubleshooting

| You see | Do this |
|---|---|
| Sign-up or login returns 500 | Firebase settings missing or the private key lost its `\n` breaks. Check startup log |
| `/admin` shows 404 | Your user's `role` is not exactly `admin`. Sign out and in after changing it |
| Card option missing at checkout | No provider key set, or Settings > Online card payment is Off |
| Upload fails | Check the five `R2_*` values, the token has Object Read & Write, and `R2_PUBLIC_URL` is public |
| Assistant says it is busy | All models were busy. Wait a minute. Admins see the exact reason |
| Invoice fails | Admins see the reason in the message; the server log has details |
| Vercel cron error on deploy | Keep the daily schedule in `vercel.json`; Hobby cannot run it more often |
| Changed an environment value on Vercel | Redeploy |

---

## 12. Project layout

`src/app` pages and API routes (`/ar/...` are the Arabic twins) · `src/components` screens · `src/lib` business logic (orders, payments, brand, popups, import, SEO, Gemini) · `tests` automated checks with an in-memory database · `public` logo and icons · `firestore.rules`, `storage.rules`, `vercel.json`.


## Keeping image storage cheap (Cloudflare R2)

R2 bills by stored size and by write/read operations, so the app keeps files small: every upload is converted to WebP and shrunk (products 1200 px, banners 1920 px, categories 800 px, return photos 1000 px), GIFs over 1 MB are refused, a product can hold 8 images, and an image you add and then remove before saving is deleted from the bucket straight away. Old images from before this version are untouched; delete unused ones in the Cloudflare dashboard if you want the total to drop.
`R2_PUBLIC_URL` must start with `https://`. If it does not, the app now adds it, but fix the value in Vercel anyway.


## Mobile app (Android and iOS)

The `mobile/` folder wraps the live website in a real app (Capacitor). It is the same store, not a copy: shop, cart, checkout, account, returns, admin and the assistant all work exactly as on the website, and every deploy updates the app instantly with no new release. Customers can sign in with email and password; "Continue with Google" is hidden inside the app because Google blocks it in app web views.

**Android (easiest, free):** push the project to GitHub, open **Actions > Build Android app > Run workflow**, keep the site address (or change it), wait about 6 minutes, then download `florida-kuwait-app` from the run page. Unzip it and install `app-debug.apk` on a phone to test. For Google Play you need a signed release build: open the generated `mobile/android` folder in Android Studio, choose Build > Generate Signed Bundle, and upload the `.aab` in Play Console (one-time US$25 developer fee).

**On your own computer:** `cd mobile && npm install && npx cap add android && npx capacitor-assets generate --android && npx cap sync && npx cap open android`. For iPhone use `add ios` and `open ios`; it needs a Mac with Xcode and an Apple Developer account (US$99/year). Apple sometimes rejects apps that only show a website, so for the App Store plan to add native features (push notifications, barcode scanner) first.

Change `server.url` in `mobile/capacitor.config.json` if your website address changes.
