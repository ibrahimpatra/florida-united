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
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | recommended | Image storage (section 4). Without them uploads go to Firebase Storage |
| `GEMINI_API_KEY` | optional | AI assistant and the Arabic Translate button. Key from aistudio.google.com |
| `GEMINI_MODEL` | optional | A model to try first. Others are tried automatically (section 6) |
| `OPENAI_API_KEY` | optional | Second AI provider. **Not free** (pay-as-you-go, platform.openai.com). Gemini serves customers and live buttons first; OpenAI does background jobs first; each backs up the other |
| `OPENAI_MODEL` / `AI_BULK_PROVIDER` | optional | Default `gpt-4o-mini` / `openai` |
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
3. **Leave the bucket private.** Since v20 the shop serves every picture itself from `https://YOUR-SITE/media/...` (read from R2 with your API key, cached for a year in the browser and on Vercel's network). Customers never see an `r2.dev` or `cloudflarestorage` address, browsers do not flag it as a suspicious link, and old pictures that were saved with a wrong address (the `img.yourdomain.com` problem) are repaired automatically when they are read. You do not need a public bucket, a custom domain or `R2_PUBLIC_URL`.
4. R2 overview page > **Manage API tokens** > Create API token > permission **Object Read & Write** > limit it to your bucket > Create. Copy the **Access Key ID** and **Secret Access Key** (shown once). The **Account ID** is on the R2 overview page.
5. Add the five settings (locally and on Vercel), then redeploy:
   ```
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=florida-images
   ```
   (`R2_PUBLIC_URL` is no longer used. If it is still set on Vercel you can delete it.)
6. Test: Admin > Products > edit a product > upload an image. The picture appears and its address starts with `/media/products/`.

**If an upload fails:** big phone photos are shrunk in the browser before sending (so they stay under Vercel's 4.5 MB limit) and retried automatically. Every failure is written to **Admin > Issues** (super admin), including failures that happen in the browser, with the page and reason.

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

Needs `GEMINI_API_KEY` and/or `OPENAI_API_KEY`. Gemini answers first for live chat; if it fails or is slow, OpenAI answers. The assistant chat button appears on every page, including the admin area, so staff can ask it for orders, stock, product copy and translations. **Admin > Products > Write with AI** drafts the English and Arabic descriptions, meta text and tags from the name and facts you type (it is told not to invent specifications; always read before saving). The shopper assistant answers product and delivery questions and can look up orders. For admins it can also change order status, add tracking, adjust stock, check customers and returns.

If a model is busy ("high demand", 429 or 503), retired, or the network fails, the next model is tried automatically (`gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`) and the busy one is skipped for a minute. Only a bad API key stops it. Shoppers see a friendly message; **admins also see the technical reason** marked `[admin only]`, in the assistant, at checkout and on invoices. Google retires model names over time. If every model fails with "does not exist", set `GEMINI_MODEL` to a current name from aistudio.google.com.

The **Translate to Arabic** button on admin forms sends the English text to Gemini and fills the Arabic fields.


---

## 6b. WhatsApp order messages (Meta Cloud API)

The shop sends a WhatsApp message to the customer when an order is placed or its status changes. It uses Meta's free **WhatsApp Business Cloud API**. Without the two settings below nothing is sent and the log says so (the rest of the shop works).

1. Go to **developers.facebook.com** > My Apps > **Create app** > type **Business** > connect (or create) your **Meta Business account** (business.facebook.com).
2. In the app, **Add product > WhatsApp > Set up**. Meta gives a **test number** and a **Phone number ID** straight away (WhatsApp > API Setup).
3. **Add your real number**: WhatsApp > API Setup > *Add phone number*. Verify it by SMS or call. The number must not be in use in the normal WhatsApp app (or delete it there first). Under WhatsApp > Configuration set the display name (your store name) and wait for approval.
4. **Permanent token** (the 24-hour token in API Setup stops working): business.facebook.com > Settings > Users > **System users** > Add (role Admin) > **Add assets**: your app (full control) and the WhatsApp account > **Generate token**, expiry *Never*, permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Copy it.
5. Put the values in Vercel (Settings > Environment Variables), then redeploy:
   ```
   WHATSAPP_ACCESS_TOKEN=the-permanent-token
   WHATSAPP_PHONE_NUMBER_ID=the-phone-number-id
   NEXT_PUBLIC_WHATSAPP_NUMBER=965XXXXXXXX      (the "Chat with us" link, digits only)
   ```
6. **Rules from Meta:** a message to a customer who has not written to you in the last 24 hours must be a pre-approved **template**. Create the templates in WhatsApp Manager > Message templates (category *Utility*) and wait for approval (usually minutes). Free-text messages only reach customers who messaged you in the last 24 hours. Until the templates exist, status messages to new customers can be rejected by Meta; the log (Admin > Issues) shows the reason Meta gave.
7. Test: place a test order with your own phone number, then change its status in Admin > Orders.

## 6c. Email for order updates and password reset

Order confirmations, status updates, return updates and password-reset emails are sent with normal SMTP. Easiest options:

**Gmail (free, about 500 emails a day):**
1. Use a Google account for the shop. Turn on 2-step verification (myaccount.google.com > Security).
2. myaccount.google.com/apppasswords > create an app password named "Florida shop". Copy the 16 letters.
3. In Vercel add:
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=yourshop@gmail.com
   EMAIL_PASSWORD=the-16-letter-app-password
   EMAIL_FROM="Florida Kuwait <yourshop@gmail.com>"
   ADMIN_EMAIL=where-staff-notifications-go@yourdomain.com
   ```
4. Redeploy. Test with **Forgot password** on the login page, then change an order status.

**Your own domain (better delivery):** use a sender such as Resend, Brevo or Zoho. They show an SMTP host, port 587, a user name and a password: put them in the same `EMAIL_*` settings, and add the SPF/DKIM records the provider shows to your domain's DNS so mail does not land in spam. `EMAIL_FROM` must use an address on that domain.

If email or WhatsApp is not set up the order still goes through; the problem is written to **Admin > Issues**.

---

## 6d. AI providers: Gemini and OpenAI

You can use one or both. Set `GEMINI_API_KEY` and/or `OPENAI_API_KEY` in Vercel.

| Job | First | Backup |
|---|---|---|
| Customer / staff chat assistant, Translate button, Write with AI (someone is waiting) | Gemini (has a free tier) | OpenAI |
| Background jobs: SEO fill-in, bulk descriptions | OpenAI (very cheap, nobody is waiting) | Gemini |

If one fails (busy, quota, bad key) the other answers automatically; with only one key it does everything. `AI_BULK_PROVIDER=gemini` makes Gemini go first for background jobs. **Be aware: the OpenAI API is not free.** It is pay-as-you-go from platform.openai.com (a ChatGPT subscription does not include API credit). With the default model `gpt-4o-mini` one product's text costs a fraction of a cent. Add a small credit (for example 5 USD) and set a monthly limit under Billing > Limits. Claude (Anthropic) was removed.

**Chat assistant:** the round button opens a full-screen chat. History stays in the browser, "New chat" starts again, and each answer offers two follow-up questions to tap. "Track my last order" reads the customer's newest order and answers with status, tracking number, carrier and a link. The reply has a 50-second limit, so Vercel's 60-second cut-off no longer shows as "connection problem": the customer gets a clear "took too long" message instead.

**SEO text:** *Write with AI* in the product form fills description, Arabic description, short lines, meta title, meta description and tags. When a product is saved with any of those empty, a **background job** fills only the empty ones (nothing a person wrote is overwritten). See the next section.

## 6e. Roles, jobs and logs (super admin)

* **Roles:** customer, admin, **superadmin**. Only a superadmin sees the **Jobs**, **Issues** and **Settings** tabs (and their data). Admins see everything else. Admin-only error details stay visible to admins and superadmins; customers only see friendly messages.
* **Make the first superadmin:** Firestore console > `users` > your document > change `role` to `superadmin`, sign out and in. Until one exists every admin counts as a superadmin, so nobody is locked out. After that, a superadmin changes roles in **Admin > Customers** (role drop-down), and the last superadmin cannot be demoted. The person must sign out and in again.
* **Jobs** (Admin > Jobs): shows each background job, its result or error, and a *Run again* button. *Queue all products missing SEO* queues every product with empty fields. Jobs start right after a save; anything still waiting is picked up by the daily cron (`/api/cron/jobs`, needs `CRON_SECRET`), by *Run queued jobs*, and automatically while the Jobs page is open. Vercel Hobby has no always-on worker, which is why it works this way.
* **Issues** (Admin > Issues): server errors, failed emails/WhatsApp/payments/uploads and errors reported from customers' browsers.
* **View store** button at the top of the admin menu opens the shop in a new tab.

## 6f. Loyalty points

Admin > **Loyalty**: switch it on and set the rules. Defaults: 1 point per 1 KWD, 100 points = 1 KWD, minimum 100 points, points may pay up to 50% of the goods; optional tiers (Silver/Gold) give bonus points by lifetime spending.
* Points are **earned when an order is marked Delivered** (once per order, on the amount after discounts, not on shipping).
* At **checkout** a "Use my points" box shows the balance and the saving; the server re-checks the balance inside the order transaction, so points cannot be spent twice.
* **Cancelling** an order gives the used points back; a **refunded return** takes back the points earned on the refunded part. Balances never go below 0.
* The account page shows balance, tier and history; orders and invoices show the points discount. Admin can add or remove points for one customer by email.

## 6g. Home page and shop extras

* **Banners and flash deals** have two picture modes: *Full background* (the picture fills the banner, text on top) or *Small side picture* (coloured banner with the picture beside the text). Choose in Admin > Banners and Admin > Flash deals.
* **Promo tiles** (Admin > Promo tiles): small clickable boxes under the offers on the home page (Clearance sale, New in, Bundles...) with title, label, picture or colour and any link.
* **Recently viewed** strip on product pages, the cart, the shop and the home page. It is stored in the visitor's browser (no account needed, no database reads except one small request to show them).
* Product cards show **- 1 +** once the item is in the cart, and the checkout summary has + and - buttons too.
* In **Admin > Orders** the status can be changed straight from the table on a computer, and clicking anywhere on a row opens the order.

## 6h. Pictures, Arabic and SEO everywhere (v21)

* **Upload buttons everywhere:** products, categories, banners, flash deals, bundles, promo tiles and popups all have *Upload* (with drag and drop, automatic shrinking and retry). Pasting a link still works in the product form.
* **Blank Arabic and SEO are filled for you.** Leave Arabic or SEO empty and save: a background job (Admin > Jobs) writes only the empty fields for products, categories, banners, flash deals, bundles, promo tiles and popups. In every form the **Fill ... with AI** button does the same instantly, before you save.
* **SEO fields on everything:** categories, flash deals and bundles have meta title, meta description and keywords; banners, flash deals, bundles and promo tiles have a picture description in English and Arabic (used as the picture's alt text, which Google Images and screen readers read). Category pages use the keywords and meta text in Google results.
* **Product descriptions:** *Fill short text with AI* and *Fill long text with AI* sit next to each field. The long description accepts plain text or simple HTML (toolbar for bold, heading, list, link, with a Preview). Shoppers only ever see a safe subset (no scripts, no unsafe links).
* **Excel assistant** (Admin > Import): choose *Products* or *Categories and sub-categories*, tick *Complete my sheet with AI*, and drop an unfinished file. The AI writes only the blank cells (Arabic names, short and long descriptions, tags, categories, meta text), shows the preview, and gives you the completed sheet to download. Nothing is saved until you press Import. Up to 300 rows per run; if time runs out it says how many rows are left, and you upload the completed sheet again. Missing categories, sub-categories and units are created on import. The category template is *Download Excel template* on the Categories tab (columns: name, nameAr, parent, description, descriptionAr, image, metaTitle, metaDesc, tags, sortOrder, showOnHome, showOnNav, isActive).

* **Brands (v22):** Admin > Brands works like Categories: logo upload, Arabic name, description, SEO (meta title, description, keywords, logo picture text), sort order, show-on-homepage. Each active brand has its own page `/brands/<slug>` (and `/ar/brands/<slug>`) listing its products, with canonical and Arabic links, and is in the sitemap. The homepage brand strip shows logos and links there. Products keep the brand as text; the product form suggests your brands and any new brand typed on a product (or in an import) is added to Brands automatically. Renaming a brand renames it on its products. Import: Admin > Import > *Brands* tab (columns: name, nameAr, description, descriptionAr, image, imageAlt, imageAltAr, website, metaTitle, metaDesc, tags, sortOrder, showOnHome, isActive), including *Complete my sheet with AI*.
* **Background fill and the cron job:** every item that can have Arabic or SEO text (categories, brands, banners, flash deals, bundles, promo tiles, popups with a picture, products) is queued when saved with blanks. The daily cron (`/api/cron/jobs`, needs `CRON_SECRET`) re-queues anything still blank and runs it; on the Hobby plan crons run once a day, so use Admin > Jobs > *Run queued jobs* for an immediate run. Popups are not web pages, so they only get picture text, not meta tags. **Faster than daily (free):** `.github/workflows/run-jobs.yml` calls `/api/cron/jobs?only=queue` every 15 minutes from GitHub Actions; add repository secrets `APP_URL` and `CRON_SECRET` (same value as on Vercel). Saving an item already starts its job immediately, so this is only the safety net for retries.
* **Arabic SEO (v22):** categories, brands, flash deals, bundles and products have Arabic meta title and description (`metaTitleAr`, `metaDescAr`). The background job and the cron fill them when blank, and the Arabic pages (`/ar/...`) use them in Google results.
* **Arabic links and Deals/Bundles SEO (v23):** inside `/ar` pages every public link (shop, categories, products, brands, deals, bundles, search, info pages) stays on the Arabic site (`src/components/ui/LocLink.tsx`). The Deals and Bundles pages take their title, description and keywords from the live flash deals / bundles (English and Arabic).
* **Share links (v22):** the share button on product cards and pages, WhatsApp, sitemap and e-mails never use `localhost`. They use `NEXT_PUBLIC_APP_URL` when it is a real address, otherwise the address the visitor is on, otherwise `https://floridakuwait.com` (`src/lib/site-url.ts`).

## Architecture

**Graphify graph (3D):** super admins can open it inside the admin at **Admin > Code graph** (`/admin/graph`, served by the server from the deployed `docs/graphify/graph-3d.html`; it shows the code as of the last deploy). It also opens on its own: `docs/graphify/graph-3d.html` in any browser (no install, no internet). It shows every file, function and component as a glowing node, coloured by community; drag to rotate, scroll to zoom, click a node to light up what it connects to, search, or click a legend entry to isolate a community. It is built from the real [graphify](https://github.com/safishamsi/graphify) graph (`pip install graphifyy`, then `graphify update .`, which needs no API key for code); `docs/graphify/GRAPH_REPORT.md` lists the hubs and communities and `graph-2d.html` is graphify's own 2D view. To refresh after changes: `graphify update . && python3 docs/graphify/build3d.py graphify-out/graph.json docs/graphify/graph-3d.html` (build3d needs `npm i 3d-force-graph esbuild` next to `app3d.js`, saved as `app.js`).

![Architecture](docs/architecture.png)

Made with Graphviz from `docs/architecture.dot` (edit it and run `dot -Tpng docs/architecture.dot -o docs/architecture.png`; the `.svg` is included for zooming).

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
3. Deploy. `vercel.json` already contains two daily jobs: cleanup of unpaid card orders and the background-jobs worker (Hobby allows one run a day per job). Set `CRON_SECRET` to any long random text.
4. After the first deploy: submit `https://YOUR-DOMAIN/sitemap.xml` in Google Search Console. Both English and Arabic (`/ar/...`) pages are listed.

---

## 9. Seeing problems (logging)

By default only warnings and errors are printed: missing settings at startup, any API response with status 400 or above, crashes, failed emails, failed payments, bad logins. Passwords, keys and card data are masked. Set `LOG_LEVEL=info` for one line per request, `debug` to include request bodies. On Vercel: Project > Logs (or Observability) and filter by "error". In the browser console filter by `[app]`.

---

## 9b. What changed in v25 (stock, roles, order flow, logging)

- **Stock and database reads.** Product pages are cached for an hour and refreshed by the server only when something changes (an item sells out, comes back, or an admin edits it). The product list stays in server memory for 10 minutes; a tiny marker (`config/catalog`) tells other servers to refresh, checked at most every 20 seconds. Shoppers see only "In stock" / "Out of stock" (the number is capped at about 10 and never shown). The cart does one batched check (`/api/stock`) when the cart or checkout opens; sold-out lines are greyed out and not counted. The final stock check at order time is unchanged. No `.env` changes.
- **Super admin only.** Settings, Issues, Jobs, Code graph, Shipping and Loyalty settings are blocked on the server for normal admins. If no one is a `superadmin` yet, the **oldest admin account becomes the owner automatically**. If that is the wrong account, set `role` = `superadmin` on the right user in Firestore. Role changes apply within about 5 minutes (or on next sign-in).
- **Order status flow.** Pending → Confirmed → Processing → Shipped (needs carrier + tracking) → Out for delivery → Delivered. Return: Requested → Approved → Picked up → Received back → Refunded. Cancelled, Rejected and Refunded are locked. Shipped orders cannot be cancelled by anyone. Admin screens show only the valid next steps; the server enforces it.
- **Issues.** Every technical error (API 5xx, `log.error`, background jobs, webhooks, browser crashes and failed network calls) goes to Admin > Issues, grouped with counts, kept 30 days. Expected 4xx answers (for example "cancelled order cannot be changed") are not logged. Technical detail is shown to admins only for real server errors and only when it adds something.

## 9c. What changed in v26 (admin menu, forms, loyalty)

- **Admin menu.** `/admin` is now a full-page grid of small tiles, grouped (Sales, Catalog, Marketing, Reports, Settings), with search, recent pages and badges (orders waiting, returns waiting). There is no sidebar: every admin page has a slim top bar and the grid button returns to the menu. Add a page in `src/lib/admin-nav.ts` and it appears everywhere. Super-admin-only tiles are hidden from normal admins (and still blocked on the server).
- **Product form.** Save and Cancel are at the top and stay visible. Brand, Category and Sub-category are one-to-one pills with "Create ..." inline when it does not exist. SEO, extra units and returns are collapsed. A new product keeps a draft in the browser until saved.
- **Categories and Brands.** Save/Cancel on top, optional parts collapsed, keywords as pills, parent category as a pill.
- **Busy layer.** A grey full-screen layer with a spinner appears for important actions (placing an order, saving a product, changing an order status). It clears when the next page opens. Small actions keep their button spinner.
- **Rewards.** Customers are not enrolled automatically: they open Account > Rewards and tap Join. Points from a delivered order are shown as *pending* and are added to the balance after the order's return window ends (the longest item `returnDays`, else the store default). A return in progress holds them; a refund before release cancels them. Points are released when the customer opens Rewards or checkout (no extra cron).

## 9d. What changed in v27 (bundles, recently viewed, AI usage, deals)

- **Bundle pages.** Each bundle has its own page at `/shop/bundles/<name>-<id>` (and `/ar/...`) with gallery, price and saving, what is inside (each part opens its product), In stock / Out of stock from the parts, add to cart, share, SEO and structured data. Bundles are in the sitemap, the listing, search and the cart. Renaming a bundle never breaks an old link.
- **Recently viewed.** Signed-in customers: the browser list is merged into their account on login (one write, only if it changed) and later views are saved in one batched write a few seconds after the last one. Signed-out: browser only. Ids and times only, newest first, 20 max.
- **AI usage (super admin).** Admin > Settings > AI usage shows calls, tokens, failures, backup use, estimated cost and the daily background cap, per day, provider and model. Counted by the app itself. Optional: add an OpenAI **admin** key as `OPENAI_ADMIN_KEY` on Vercel to show OpenAI's own billing as a cross-check (Google has no such call). No change is needed if you skip it.
- **Deals.** Home page shows a "Deals right now" product row when an offer is live (hidden otherwise). Each offer links to `/deals?deal=<id>`, which lists only the products that offer covers. New limits per offer: most units per order at the offer price, and "cannot be combined with a coupon". Existing limits (minimum cart, total uses, uses per customer) are unchanged and still checked again when the order is placed.
- **Translations.** Fixed the missing `newArrivalsSub` heading text, and a test now scans every `t('...')` key in the app for English and Arabic.

## 9e. What changed in v28 part 1 (dashboard revenue, coupon rules, search)

**Revenue is now counted correctly.** Money is "earned" only when an order is delivered, its return period has ended, and it was not cancelled, returned or refunded. Until then it shows separately as *On its way* or *Return period open*. A part-refund keeps only the share the customer kept. Refunds are shown as their own figure.
- New files/fields: `src/lib/revenue.ts`; order fields `revenueState` (`held` / `recognized` / `void`), `revenueDueAt`, `revenueAmount`; collection `revenueDaily/{YYYY-MM-DD}`; `recRevenue` / `recUnits` on products and `categoryStats`.
- Orders are "held" when marked delivered (`order-actions.ts`), booked by `settleDueRevenue()` (runs on each dashboard load, reads only still-held orders), and refunds go through `applyRefund()` (return route and status flow). Dashboard cost stays flat: about 124 daily docs + counts, no order scans.
- **After deploying, open Admin → Dashboard and click "Rebuild analytics" once.** It re-books older orders with the new rule. Safe to repeat. No env changes, no new indexes.
- Dashboard shows: earned today / 7 days / this month (vs last month), average order, on its way, return period open, refunds, orders placed (before returns), shipping and discounts on earned orders, all 12 order statuses, open returns, top products and categories by earned revenue.

**Coupons with rules** (Admin → Coupons): percentage, fixed, free delivery, buy X get Y free (cheapest items free); apply to whole cart, chosen categories (with sub-categories) or products; start and end dates; total and per-customer limits; minimum order; who can use it (everyone, new, returning, VIP KD 200+, not ordered for 90+ days); optional "show in matching customers' accounts" (account page card **Offers for you**). Same rule function (`computeCoupon`) is used by cart preview, checkout quote and the placed order, so the three always agree. Existing coupons keep working unchanged. Flash deals marked "no coupons" still block coupons.

**Search**: Arabic spellings are normalised (alef, ya, ta marbuta, diacritics, Arabic digits). A search with no results offers "Did you mean …" (English and Arabic). The shop and search page now have a brand filter next to price, category and in-stock.

Purchasing and accounting are not in this release (planned for v28 part 2).

## 9f. What changed in v28 part 2a (storefront redesign, UI only)

A new look for every customer-facing page. No logic, server, database or env changes.
- **Theme colours are unchanged**: everything still follows the colours chosen in Admin → Settings → Theme (`brand-*` / `accent-*` variables).
- **Design system** (`tailwind.config.js`, `src/styles/globals.css`): rounder corners, soft shadows, pill buttons and chips, filled inputs, pill badges, Plus Jakarta Sans for Latin text (Arabic keeps IBM Plex Sans Arabic). Because these are shared classes, admin pages pick up the softer look too; admin pages are restyled properly in part 2b.
- **Phones**: floating bottom bar (Home, Shop, Cart, Saved, Account) in `src/components/layout/MobileNav.tsx`, hidden on checkout, sign-in, order-success and admin; a sticky price + Add to cart bar on product pages; category chips in the shop; horizontally scrolling categories on the home page.
- **Restyled**: header and menu, announcement bar, hero banner (rounded card), trust strip, category tiles, product cards, shop filters and toolbar, product page, cart, page headers, footer.
- Works in Arabic (right-to-left) and English.

### 9g. v28 part 2b: back-button memory, single product bar, admin polish

- **Back from a product returns to the same page and row.** The shop URL mirrors page/filters (`/shop?page=3`); clicking a product saves the list and scroll position in `sessionStorage` (`fk-shop-return`); on Back the saved list shows instantly and scrolls to the exact spot, then refreshes quietly. Works for shop, search, deals, brands, categories. Code: `src/components/product/ShopClient.tsx`.
- **Product page has one bottom bar** (cart icon + price + Add to cart / "Cart"); the floating site nav hides on `/shop/products/*`. Code: `ProductDetailClient.tsx`, `MobileNav.tsx`.
- **Admin** restyled to the same look (top bar, home tiles, dashboard panels, `bg-concrete`). UI only.
- **Bug fix:** `tailwind.config.js` now scans `src/lib`, so admin home tile colours (Sales/Marketing/Reports) show.

### 9i. v28 part 3: smart UX, fewer reads, notifications (v28p3)

**Database reads (Firebase Spark limit is 50K/day)**
- Product list is kept in memory per server and updated by *delta*: `config/catalog` holds a short history of what changed (product ids / categories). A server that is behind re-reads only those products (`getAll`), not the whole catalogue. Full re-read only when cold, too far behind or told "everything". Code: `catalog-sync.ts`, `firestore-admin.ts` (`syncCatalog`, `applyIds`).
- Categories are cached the same way; brands 2 min; running deals and active bundles 1 min (`memo.ts`). Admin lists use the cache; **Refresh** buttons force a re-read (`fresh=1`).
- Browser side: `client-cache.ts` keeps categories/brands/searches in memory + sessionStorage (browser refresh does not download them again). Admin saves call `dropCached()` so new categories/brands show at once (the old "needs full refresh" bug was the 30 s network cache on `/api/categories`; admin now uses `?admin=1`, no-store).
- Jobs page reads the newest 60 jobs only; dashboard numbers are remembered 2 min; import reads the catalogue once.

**Storefront**
- Product card: pictures cross-fade on hover (desktop) and swipe on phones. Product page: swipe gallery, arrows, thumbnails, full-screen view, gentle auto-slide until touched (`CardSlides.tsx`, `ProductGallery.tsx`).
- Right-click / long-press save / drag of shop pictures is blocked (`ImageGuard.tsx`). This is a deterrent only: screenshots and page source still work, and Google Images is unaffected.
- **Google Images**: `/image-sitemap.xml` (listed in robots) with every product picture, title and caption; pictures are served from our own `/media` address as WebP/JPEG, both indexable; every image has alt text.
- Category bar scrolls sideways with a thin scrollbar when there are many; hovering a category shows its sub-categories (mobile menu has an accordion).
- Shop filter panel is sticky and scrolls inside itself; wider page and 5 columns on large screens. Recently viewed removed from the shop page. Home spacing tightened.
- Product page phone bar: save, share, WhatsApp, Add to cart with price (no cart icon).
- Checkout on phones: summary starts folded, address fields stack, sticky Place order button; last payment method remembered.
- Add to cart shows an Undo / View cart toast.
- Chat assistant uses Gemini only (no OpenAI).

**Notifications (bell)** for customers (order/return updates, offers) and admin (new order, new return). Data: `users/{uid}/notifications`, `adminNotifications`, `broadcasts`, read marker `notifState/{uid}`. The bell asks at most every 5 min (about 25 reads). Admin > Notifications sends offers to every customer. Code: `notifications.ts`, `api/notifications`, `NotificationBell.tsx`.

**Admin**: categories form asks Main/Sub first and links a sub-category to the main category just created (or use the + button on a row); Orders/Products remember filters and page for the tab; Recent on the admin home is collapsible.

### 9j. v28 fix round (feedback from testing)
- **Fewer reads on a cold start.** Every server instance used to re-read all products when it woke up (about 400 reads each; this was the 4.4K reads on first load). Now one shared copy of the catalogue is kept in Vercel's data cache (`sharedSnapshot` in `src/lib/firestore-admin.ts`, up to 1 hour old). A cold instance starts from it with **0 product reads**, then catches up through the change log (1 marker read plus only the products that changed). If the shared copy is too far behind, or you press Refresh in admin, it does one full read and refreshes the shared copy. It is free on Vercel Hobby today; from 10 Dec 2026 Vercel counts cache reads (Hobby includes 1M read units per month; 1 unit = 8 KB). The platform keeps entries up to 2 MB; the app logs a warning if the catalogue snapshot passes 1.8 MB.
- **Admin > Products rebuilt.** Always-visible filters (search, category, sub-category, brand, status, stock, tag, sort; folded behind a button on phones), list/grid switch (remembered), tick products and use the bulk bar: activate, deactivate, archive, feature, mark out of stock, move to category, set brand, change price (% or KWD), set stock, delete (anything ever ordered is archived, products inside a bundle are skipped). "Select all N that match" works across pages. Export downloads the listed products as CSV. Bulk code: `adminBulkProducts` and `POST /api/admin/products/bulk` (admin only, 500 ids per call, one write batch per 400 products, no per-product reads).
- **Bulk photos.** Admin > Products > Photos: drop pictures named by SKU (`SKU.jpg`, `SKU-2.jpg`, `SKU_3.png`, `SKU (2).jpg`); they are matched, shrunk to WebP, stored on your own storage and attached in order (add after existing, or replace).
- **Excel import and picture links.** The `image` column takes several links separated by `;` or `|` (template example shows three). After the import, every link to another website is copied onto your own storage by a background job per product (Admin > Jobs, or the "Copy pictures now" button on the import result). If a link cannot be fetched, the original link stays so the product keeps a picture. Only public http(s) pictures are fetched (private addresses are refused), max 8 MB each.
- **Bundles show live data.** A bundle's parts always display the product's current name, picture and price (the copy saved with the bundle is only a fallback if the product is gone). Checkout still prices the bundle by its own bundle price.
- **Order lines keep their snapshot on purpose.** Name, SKU, price and quantity are saved on every order so old invoices, returns and revenue never change when a product is renamed, repriced or deleted. Reading them from products instead would cost more reads and change history.
- **Tighter layout.** Smaller page padding, gaps and section spacing in the shop and in admin (cards are slightly less rounded in admin). Mobile checkout: the Place order button no longer floats over the form fields.

## 10. SEO

Every public page has its own title, description and canonical link. English and Arabic versions (`/ar/...`) point to each other with `hreflang`. The sitemap lists both and only active products. Product pages carry price and stock data; the home page carries organisation and search-box data; product and category pages carry breadcrumbs. A default share image and app icons are included. Order tracking, cart, checkout and account pages are kept out of search results.

---

## 11. Troubleshooting

| You see | Do this |
|---|---|
| Sign-up or login returns 500 | Firebase settings missing or the private key lost its `\n` breaks. Check startup log |
| `/admin` shows 404 | Your user's `role` is not exactly `admin`. Sign out and in after changing it |
| Card option missing at checkout | No provider key set, or Settings > Online card payment is Off |
| Upload fails | Check the five `R2_*` values, the token has Object Read & Write, and the bucket name is right |
| Assistant says it is busy | All models were busy. Wait a minute. Admins see the exact reason |
| Invoice fails | Admins see the reason in the message; the server log has details |
| Vercel cron error on deploy | Keep the daily schedule in `vercel.json`; Hobby cannot run it more often |
| Changed an environment value on Vercel | Redeploy |

---

## 12. Project layout

`src/app` pages and API routes (`/ar/...` are the Arabic twins) · `src/components` screens · `src/lib` business logic (orders, payments, brand, popups, import, SEO, Gemini) · `tests` automated checks with an in-memory database · `public` logo and icons · `firestore.rules`, `storage.rules`, `vercel.json`.


## Keeping image storage cheap (Cloudflare R2)

R2 bills by stored size and by write/read operations, so the app keeps files small: every upload is converted to WebP and shrunk (products 1200 px, banners 1920 px, categories 800 px, return photos 1000 px), GIFs over 1 MB are refused, a product can hold 8 images, and an image you add and then remove before saving is deleted from the bucket straight away. Old images from before this version are untouched; delete unused ones in the Cloudflare dashboard if you want the total to drop.


## Mobile app (Android and iOS)

The `mobile/` folder wraps the live website in a real app (Capacitor). It is the same store, not a copy: shop, cart, checkout, account, returns, admin and the assistant all work exactly as on the website, and every deploy updates the app instantly with no new release. Customers can sign in with email and password; "Continue with Google" is hidden inside the app because Google blocks it in app web views.

**Android (easiest, free):** push the project to GitHub, open **Actions > Build Android app > Run workflow**, keep the site address (or change it), wait about 6 minutes, then download `florida-kuwait-app` from the run page. Unzip it and install `app-debug.apk` on a phone to test. For Google Play you need a signed release build: open the generated `mobile/android` folder in Android Studio, choose Build > Generate Signed Bundle, and upload the `.aab` in Play Console (one-time US$25 developer fee).

**On your own computer:** `cd mobile && npm install && npx cap add android && npx capacitor-assets generate --android && npx cap sync && npx cap open android`. For iPhone use `add ios` and `open ios`; it needs a Mac with Xcode and an Apple Developer account (US$99/year). Apple sometimes rejects apps that only show a website, so for the App Store plan to add native features (push notifications, barcode scanner) first.

Change `server.url` in `mobile/capacitor.config.json` if your website address changes.
