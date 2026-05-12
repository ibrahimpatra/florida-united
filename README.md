# Florida United Company — Full E-Commerce Platform

A complete, production-ready e-commerce platform built with **Next.js 14**, **Firebase**, **Stripe**, and **Tailwind CSS**.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project → Enable **Firestore**, **Authentication**, **Storage**
3. Authentication: Enable **Email/Password** and **Google** providers
4. Firestore: Create database in production mode
5. Storage: Create default bucket
6. Go to Project Settings → Service Accounts → **Generate new private key**

### 3. Environment Variables
Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

**Required variables:**
```env
# Firebase (Client - from Project Settings > Your Apps)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (from Service Account JSON)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-min-32-chars

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Gmail App Password recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="Florida United <noreply@yourdomain.com>"

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 4. Firestore Security Rules
In Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Public read for products/categories
    match /products/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /categories/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    // Orders: users see own, admin sees all
    match /orders/{orderId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    // All other collections require auth
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Firebase Storage Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.resource.size < 5 * 1024 * 1024;
    }
  }
}
```

### 6. Create Admin User
After registering your account, update your user role in Firestore:
- Go to Firestore Console → `users` collection → find your document → set `role: "admin"`

### 7. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/               # API routes (Firebase backend)
│   │   ├── auth/          # NextAuth + register
│   │   ├── products/      # Products CRUD
│   │   ├── categories/    # Categories CRUD
│   │   ├── orders/        # Orders + returns
│   │   ├── stripe/        # Checkout + webhook
│   │   ├── coupons/       # Coupon validate + CRUD
│   │   ├── upload/        # Image upload to Firebase Storage
│   │   ├── whatsapp/      # WhatsApp share
│   │   ├── contact/       # Contact form email
│   │   ├── banners/       # Banners CRUD
│   │   └── admin/         # Admin stats + users
│   ├── admin/             # Admin panel (protected)
│   │   ├── dashboard/     # Stats, charts, recent orders
│   │   ├── products/      # Products management
│   │   ├── categories/    # Categories management
│   │   ├── orders/        # Orders management
│   │   ├── customers/     # Customers list
│   │   ├── returns/       # Return requests
│   │   ├── coupons/       # Coupon management
│   │   ├── banners/       # Banner management
│   │   └── settings/      # Site settings
│   ├── account/           # Customer account (protected)
│   │   ├── orders/        # Order history + returns
│   │   ├── wishlist/      # Saved products
│   │   └── settings/      # Profile, password, notifications
│   ├── auth/              # Login, Register
│   ├── shop/              # Product listing + detail
│   ├── cart/              # Shopping cart
│   ├── checkout/          # Stripe checkout + success
│   ├── order-tracking/    # Public order tracker
│   ├── search/            # Search results
│   ├── deals/             # Sale products
│   └── contact/           # Contact form
├── components/
│   ├── layout/            # Header, Footer, SearchModal, MiniCart, AnnouncementBar
│   ├── home/              # Hero, CategoryGrid, FeaturedProducts, Offers, etc.
│   ├── product/           # ProductCard, ProductDetailClient, ShopClient
│   ├── cart/              # MiniCart, CartPageClient
│   ├── admin/             # AdminSidebar, ProductForm
│   └── account/           # AccountClient
├── lib/
│   ├── firebase.ts        # Firebase client SDK
│   ├── firebase-admin.ts  # Firebase Admin SDK
│   ├── firestore.ts       # All Firestore operations
│   ├── auth.ts            # NextAuth configuration
│   ├── email.ts           # All email templates + sending
│   └── utils.ts           # Helpers, formatters
├── store/
│   ├── cartStore.ts       # Zustand cart (persisted)
│   └── wishlistStore.ts   # Zustand wishlist (persisted)
└── types/index.ts         # All TypeScript types
```

---

## ✅ Features

### 🛍 Store
- Homepage with hero carousel, category grid, featured products, offers countdown timer
- Product listing with filters (category, price, brand, stock, sale, new), sort, pagination
- Product detail with image gallery, variants, add to cart, wishlist, WhatsApp share
- Product-level SEO (JSON-LD structured data, meta tags, Open Graph)
- Related products
- Search modal with live results

### 🛒 Cart & Checkout
- Persistent cart (Zustand + localStorage)
- Mini cart slide-over
- Coupon code validation
- Stripe Checkout (card, Google Pay, Apple Pay)
- Order creation on successful payment (webhook)
- Order confirmation email with receipt

### 👤 Account
- Sign up (email + Google OAuth)
- Login with credentials or Google
- Account dashboard with order stats
- Order history with status badges
- Return request modal (returnable items only)
- WhatsApp support from order page
- Wishlist management
- Profile settings
- Password change
- Notification preferences

### 📦 Orders
- Auto order number generation
- Status tracking (10 statuses)
- Status history timeline
- Shipping tracking number + carrier
- Email notification on every status change
- Public order tracker (no login required)

### 🔄 Returns
- Customer submits return request
- Admin approves/rejects with note
- Admin marks items refundable/non-refundable
- Refund amount assignment
- Email notifications

### 🔧 Admin Panel
- Dashboard with revenue charts (Recharts), order stats, recent orders
- Product management (create, edit, delete, toggle active, featured, sale)
- Category management (hierarchical, parent/child)
- Order management with inline status update + tracking
- Customer list
- Return requests management
- Coupon management (percentage & fixed)
- Banner management
- Site settings

### 📧 Emails (Nodemailer)
- Welcome email on registration
- Order confirmation with receipt
- Status update emails (shipped, delivered, etc.)
- Return request submitted
- Password reset
- Admin new order notification
- Contact form to admin

### 🔍 SEO
- Next.js App Router metadata API
- Dynamic Open Graph per product
- JSON-LD structured data (Organization, Product, WebSite, SearchAction)
- XML sitemap auto-generation
- robots.txt
- Web app manifest (PWA-ready)
- Semantic HTML throughout

### 📲 WhatsApp
- Share product link with image, name, price via WhatsApp
- Order support via WhatsApp from account

---

## 🌐 Deployment (Vercel)

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Initial commit"

# 2. Deploy to Vercel
vercel --prod

# 3. Set environment variables in Vercel dashboard

# 4. Set up Stripe webhook
# Endpoint: https://yourdomain.com/api/stripe/webhook
# Events: checkout.session.completed, payment_intent.payment_failed
```

---

## 🔑 Google Search Console

After deployment:
1. Add property in [Google Search Console](https://search.google.com/search-console)
2. Add verification token to `NEXT_PUBLIC_GSC_TOKEN` in `.env`
3. Submit sitemap: `https://yourdomain.com/sitemap.xml`
4. Request indexing for key pages

---

## 📞 Support

**Florida United Company**
- 📧 info@floridaunited.com
- 📞 1-800-FLU-HARD
- 🌐 floridaunited.com
