/**
 * firestore-admin.ts
 * Server-side only — uses Firebase Admin SDK.
 * Import this in API routes (/app/api/**) ONLY.
 * Never import in 'use client' components.
 *
 * QUERY STRATEGY: Firestore composite indexes must be pre-created in the
 * console. To avoid "missing index" silent errors we use a simple base query
 * (isActive + orderBy createdAt) and perform secondary filtering in-memory.
 * For a catalog of up to ~10 000 products this is perfectly fast.
 */
import { getAdminDb } from './firebase-admin';
import { queueFill } from './bg';
import { FieldValue } from 'firebase-admin/firestore';
import { matchScore, computeCoupon } from './pricing';
import type {
  Product, Category, Order, User, Review, Coupon,
  Banner, ReturnRequest, ProductFilters, PaginatedResponse, DashboardStats
} from '@/types';

// ── helpers ──────────────────────────────────────────────────
import { fixImageUrl } from './image-url';

function toData<T>(snap: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!snap.exists) return null;
  const d = snap.data()!;
  const convert = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        (k === 'images' && Array.isArray(v)) ? (v as any[]).map(fixImageUrl)
        : (k === 'image' || k === 'imageUrl' || k === 'logoUrl') ? fixImageUrl(v)
        : v && typeof v === 'object' && 'toDate' in (v as object)
          ? (v as { toDate: () => Date }).toDate().toISOString()
          : v && typeof v === 'object' && !Array.isArray(v)
          ? convert(v as Record<string, unknown>)
          : v,
      ])
    );
  return { id: snap.id, ...convert(d) } as T;
}

function toList<T>(snaps: FirebaseFirestore.QuerySnapshot): T[] {
  return snaps.docs.map(d => toData<T>(d)).filter(Boolean) as T[];
}

// ── CATEGORIES ───────────────────────────────────────────────
// NOTE: no Firestore orderBy here — orderBy silently DROPS documents that lack the
// field (e.g. categories created without sortOrder). We sort in memory instead.
export async function adminGetCategories(activeOnly = true): Promise<Category[]> {
  const snap = await getAdminDb().collection('categories').get();
  let list = toList<Category>(snap);
  if (activeOnly) list = list.filter(c => c.isActive !== false);
  return list.sort((x, y) => (x.sortOrder ?? 999) - (y.sortOrder ?? 999) || x.name.localeCompare(y.name));
}

export async function adminCreateCategory(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = getAdminDb();
  const clean: any = { ...data };
  delete clean.id; delete clean.createdAt; delete clean.updatedAt;
  if (!String(clean.name || '').trim()) throw new ProductError(400, 'Category name is required.');
  clean.name = String(clean.name).trim();
  if (typeof clean.nameAr === 'string') clean.nameAr = clean.nameAr.trim();
  if (clean.parentId) {
    const p = await db.collection('categories').doc(clean.parentId).get();
    if (!p.exists) throw new ProductError(400, 'The selected parent category no longer exists.');
    clean.parentName = (p.data() as any).name || '';
    clean.parentNameAr = (p.data() as any).nameAr || '';
  }
  clean.slug = String(clean.slug || clean.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `category-${Date.now().toString(36)}`;
  const dup = await db.collection('categories').where('slug', '==', clean.slug).limit(1).get();
  if (!dup.empty) clean.slug = `${clean.slug}-${Date.now().toString(36).slice(-4)}`;
  const ref = await db.collection('categories').add({
    ...clean,
    isActive: clean.isActive ?? true,
    sortOrder: Number(clean.sortOrder) || 0,
    showOnHome: clean.showOnHome ?? true,
    showOnNav:  clean.showOnNav  ?? true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  invalidateProductCache();
  queueFill('categories', ref.id);
  return ref.id;
}

export async function adminUpdateCategory(id: string, data: Partial<Category>): Promise<void> {
  const db = getAdminDb();
  const clean: any = { ...data };
  delete clean.id; delete clean.createdAt; delete clean.updatedAt; delete clean.productCount;
  if ('name' in clean) {
    if (!String(clean.name || '').trim()) throw new ProductError(400, 'Category name is required.');
    clean.name = String(clean.name).trim();
  }
  if (typeof clean.nameAr === 'string') clean.nameAr = clean.nameAr.trim();
  if (clean.parentId === id) throw new ProductError(400, 'A category cannot be its own parent.');
  if (clean.parentId) {
    // refuse cycles: the new parent must not be this category's descendant
    let cur: string | undefined = clean.parentId; const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      if (cur === id) throw new ProductError(400, 'A category cannot be moved under one of its own sub-categories.');
      seen.add(cur);
      const d: any = (await db.collection('categories').doc(cur).get()).data();
      if (!d && cur === clean.parentId) throw new ProductError(400, 'The selected parent category no longer exists.');
      cur = d?.parentId;
    }
    const p: any = (await db.collection('categories').doc(clean.parentId).get()).data();
    clean.parentName = p?.name || ''; clean.parentNameAr = p?.nameAr || '';
  } else if ('parentId' in clean) { clean.parentId = ''; clean.parentName = ''; clean.parentNameAr = ''; }
  await db.collection('categories').doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
  queueFill('categories', id);

  // Keep denormalised names in sync (products + child categories) when renamed.
  if ('name' in clean || 'nameAr' in clean) {
    const patchP: any = {}, patchC: any = {};
    if ('name' in clean) { patchP.categoryName = clean.name; patchC.parentName = clean.name; }
    if ('nameAr' in clean) { patchP.categoryNameAr = clean.nameAr || ''; patchC.parentNameAr = clean.nameAr || ''; }
    const [prods, kids] = await Promise.all([
      db.collection('products').where('categoryId', '==', id).get(),
      db.collection('categories').where('parentId', '==', id).get(),
    ]);
    const targets = [...prods.docs.map(d => [d.ref, patchP] as const), ...kids.docs.map(d => [d.ref, patchC] as const)];
    for (let i = 0; i < targets.length; i += 400) {
      const batch = db.batch();
      targets.slice(i, i + 400).forEach(([ref, patch]) => batch.update(ref, patch));
      await batch.commit();
    }
  }
  invalidateProductCache();
}

export async function adminDeleteCategory(id: string): Promise<void> {
  const db = getAdminDb();
  const [kids, prods] = await Promise.all([
    db.collection('categories').where('parentId', '==', id).limit(1).get(),
    db.collection('products').where('categoryId', '==', id).limit(1).get(),
  ]);
  if (!kids.empty) throw new ProductError(409, 'This category has sub-categories. Move or delete them first.');
  if (!prods.empty) throw new ProductError(409, 'This category still has products. Move them to another category first.');
  await db.collection('categories').doc(id).delete();
  invalidateProductCache();
}

export class ProductError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ── PRODUCTS ─────────────────────────────────────────────────
// WHY NO orderBy/where HERE: Firestore silently omits any document that is missing
// the ordered/filtered field (imported products without totalSold/createdAt, etc.)
// which made products "sometimes show, sometimes not". We read the collection with
// no query constraints (always returns every doc, needs no index) and filter/sort in
// memory. A 60s cache keeps reads cheap for the storefront; admin requests bypass it.
// Ceiling: PRODUCT_CAP docs. Beyond that, move search/filter to Algolia/Typesense —
// everything goes through this one function so the swap is local.
const PRODUCT_CAP = 3000;
const PRODUCT_CACHE_MS = 60_000;
let productCache: { at: number; items: Product[] } | null = null;
export function invalidateProductCache() { productCache = null; }

/** Checks a saved product for missing SEO text and queues the background job. Runs after the response (waitUntil on Vercel). */
function queueSeoJob(productId: string) {
  const work = import('./jobs').then(m => m.enqueueSeoIfMissing(productId)).catch(() => {});
  import('@vercel/functions').then(v => v.waitUntil(work)).catch(() => {});
}

async function loadAllProducts(fresh: boolean): Promise<Product[]> {
  if (!fresh && productCache && Date.now() - productCache.at < PRODUCT_CACHE_MS) return productCache.items;
  const snap = await getAdminDb().collection('products').limit(PRODUCT_CAP).get();
  const items = toList<Product>(snap);
  if (!fresh) productCache = { at: Date.now(), items };
  return items;
}

/** categoryId + all of its descendants, so picking a parent also shows sub-category products. */
export function categoryFamily(cats: Category[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of cats) if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); grew = true; }
  }
  return ids;
}

/** Fields only the store owner may see. Applied to everything sent to shoppers (API responses and page props). */
export function publicProduct<T extends Record<string, any>>(p: T): T {
  const { costPrice, ...rest } = p as any;
  return rest as T;
}

export async function adminGetProducts(
  filters: ProductFilters & { admin?: boolean; stockStatus?: 'in' | 'out' | 'low' } = {}
): Promise<PaginatedResponse<Product>> {
  const { sortBy = 'newest', page = 1, pageSize = 24 } = filters;
  let items = await loadAllProducts(!!filters.admin);

  if (!filters.admin) items = items.filter(p => p.isActive !== false);

  // category (+ sub-categories)
  let catId = filters.categoryId;
  if (catId || filters.categorySlug) {
    const cats = await adminGetCategories(false);
    if (!catId && filters.categorySlug) catId = cats.find(c => c.slug === filters.categorySlug)?.id;
    if (catId) { const fam = categoryFamily(cats, catId); items = items.filter(p => p.categoryId && fam.has(p.categoryId)); }
    else items = [];
  }
  if (filters.brand) items = items.filter(p => p.brand?.toLowerCase() === filters.brand!.toLowerCase());
  if (filters.inStock) items = items.filter(p => (p.stock ?? 0) > 0);
  if (filters.stockStatus === 'out') items = items.filter(p => (p.stock ?? 0) <= 0);
  if (filters.stockStatus === 'low') items = items.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.lowStockAlert ?? 5));
  if (filters.isFeatured)   items = items.filter(p => p.isFeatured);
  if (filters.isNewArrival) items = items.filter(p => p.isNewArrival);
  if (filters.isOnSale)     items = items.filter(p => p.isOnSale);
  if (filters.minPrice !== undefined) items = items.filter(p => p.price >= filters.minPrice!);
  if (filters.maxPrice !== undefined) items = items.filter(p => p.price <= filters.maxPrice!);

  // typo-tolerant, synonym-aware search (see pricing.ts → fuzzyScore)
  let scores: Map<string, number> | null = null;
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    scores = new Map();
    items = items.filter(p => {
      const sc = matchScore({ name: p.name, nameAr: p.nameAr, short: p.shortDescription, shortAr: p.shortDescriptionAr, extra: filters.admin ? p.sku : undefined }, q);
      if (sc > 0) scores!.set(p.id, sc);
      return sc > 0;
    });
  }

  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const by: Record<string, (a: Product, b: Product) => number> = {
    price_asc:  (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    popular:    (a, b) => num(b.totalSold) - num(a.totalSold),
    rating:     (a, b) => num(b.avgRating) - num(a.avgRating),
    name_asc:   (a, b) => (a.name || '').localeCompare(b.name || ''),
    name_desc:  (a, b) => (b.name || '').localeCompare(a.name || ''),
    newest:     (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  };
  if (scores && sortBy === 'newest') items = [...items].sort((a, b) => (scores!.get(b.id)! - scores!.get(a.id)!) || by.newest(a, b));
  else items = [...items].sort(by[sortBy] || by.newest);

  const total = items.length;
  const offset = (page - 1) * pageSize;
  const pageItems = items.slice(offset, offset + pageSize);
  return { items: filters.admin ? pageItems : pageItems.map(publicProduct), total, page, pageSize, hasMore: offset + pageSize < total };
}

export async function adminGetProductById(id: string): Promise<Product | null> {
  return toData<Product>(await getAdminDb().collection('products').doc(id).get());
}

export async function adminGetProductBySlug(slug: string): Promise<Product | null> {
  const snap = await getAdminDb().collection('products').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  return toData<Product>(snap.docs[0]);
}

async function resolveCategory(categoryId?: string) {
  if (!categoryId) return { categoryName: '', categoryNameAr: '', categoryPath: [] as string[] };
  const db = getAdminDb();
  const snap = await db.collection('categories').doc(categoryId).get();
  if (!snap.exists) throw new ProductError(400, 'The selected category no longer exists. Please pick another.');
  const c: any = snap.data();
  const path = [categoryId];
  if (c.parentId) path.unshift(c.parentId);
  return { categoryName: c.name || '', categoryNameAr: c.nameAr || '', categoryPath: path };
}

async function uniqueSlug(slug: string, excludeId?: string): Promise<string> {
  const db = getAdminDb();
  const base = (slug || 'product').toLowerCase();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const snap = await db.collection('products').where('slug', '==', candidate).limit(2).get();
    if (snap.docs.every(d => d.id === excludeId)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function assertUniqueSku(sku?: string, excludeId?: string) {
  if (!sku) return;
  const snap = await getAdminDb().collection('products').where('sku', '==', sku).limit(2).get();
  if (snap.docs.some(d => d.id !== excludeId)) throw new ProductError(409, `SKU "${sku}" is already used by another product.`);
}

/** Validates the extra selling units. Throws ProductError on bad input; returns a clean array. */
function cleanUnits(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.map((u: any, i: number) => {
    const name = String(u?.name || '').trim();
    const factor = Number(u?.factor), price = Number(u?.price);
    if (!name) throw new ProductError(400, `Unit ${i + 1}: name is required.`);
    if (!Number.isFinite(factor) || factor < 1 || !Number.isInteger(factor)) throw new ProductError(400, `Unit "${name}": quantity per unit must be a whole number of 1 or more.`);
    if (!Number.isFinite(price) || price < 0) throw new ProductError(400, `Unit "${name}": price must be a valid number.`);
    const id = String(u?.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30) || `u${Date.now().toString(36)}${i}`;
    if (seen.has(id)) throw new ProductError(400, `Unit "${name}" is duplicated.`);
    seen.add(id);
    const nameAr = String(u?.nameAr || '').trim();
    return { id, name, ...(nameAr ? { nameAr } : {}), factor, price: Math.round(price * 1000) / 1000 };
  });
}

const stripServerFields = (d: any) => {
  const c = { ...d };
  for (const k of ['id', 'createdAt', 'updatedAt', 'avgRating', 'totalReviews', 'totalSold', 'totalRevenue']) delete c[k];
  return c;
};

export async function adminCreateProduct(
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const clean: any = stripServerFields(data);
  if (!clean.name?.trim()) throw new ProductError(400, 'Product name is required.');
  if (!(Number(clean.price) >= 0)) throw new ProductError(400, 'Price must be a valid number.');
  if (clean.stock !== undefined && !(Number(clean.stock) >= 0)) throw new ProductError(400, 'Stock cannot be negative.');
  clean.name = clean.name.trim();
  if ('units' in clean) clean.units = cleanUnits(clean.units);
  if (typeof clean.nameAr === 'string') clean.nameAr = clean.nameAr.trim();
  if (!clean.categoryId) throw new ProductError(400, 'Please choose a category.');
  await assertUniqueSku(clean.sku);
  const cat = await resolveCategory(clean.categoryId);
  const ref = await getAdminDb().collection('products').add({
    ...clean,
    slug: await uniqueSlug((clean.slug || clean.name).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product'),
    isActive: clean.isActive ?? true,
    freeShipping: !!clean.freeShipping,
    stock: Number(clean.stock) || 0,
    ...cat,
    avgRating: 0, totalReviews: 0, totalSold: 0, totalRevenue: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  invalidateProductCache();
  if (clean.brand) import('./brands').then(m => m.ensureBrands([clean.brand])).catch(() => {});
  queueSeoJob(ref.id);
  return ref.id;
}

export async function adminUpdateProduct(id: string, data: Partial<Product>): Promise<void> {
  const clean: any = stripServerFields(data);
  if ('name' in clean && !String(clean.name).trim()) throw new ProductError(400, 'Product name is required.');
  if ('price' in clean && !(Number(clean.price) >= 0)) throw new ProductError(400, 'Price must be a valid number.');
  if ('stock' in clean && !(Number(clean.stock) >= 0)) throw new ProductError(400, 'Stock cannot be negative.');
  if ('units' in clean) clean.units = cleanUnits(clean.units);
  if ('sku' in clean) await assertUniqueSku(clean.sku, id);
  if ('slug' in clean) clean.slug = await uniqueSlug(clean.slug, id);
  // ALWAYS re-derive categoryName from the category doc. The edit form posts the OLD
  // categoryName back, so trusting it made category changes appear not to save.
  if ('categoryId' in clean) {
    if (!clean.categoryId) throw new ProductError(400, 'Please choose a category.');
    Object.assign(clean, await resolveCategory(clean.categoryId));
  }
  await getAdminDb().collection('products').doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
  invalidateProductCache();
  if (clean.brand) import('./brands').then(m => m.ensureBrands([clean.brand])).catch(() => {});
  queueSeoJob(id);
}

/** True when any order (new or old) contains this product. Orders keep their own copy of name/price, but history must stay linked. */
export async function productHasOrderHistory(id: string): Promise<boolean> {
  const db = getAdminDb();
  const byField = await db.collection('orders').where('productIds', 'array-contains', id).limit(1).get();
  if (!byField.empty) return true;
  // orders placed before the productIds field existed: bounded scan of recent orders
  const old = await db.collection('orders').limit(2000).get();
  return old.docs.some(d => ((d.data() as any).items || []).some((i: any) => i.productId === id || (i.bundleItems || []).some((b: any) => b.productId === id)));
}

/**
 * Deleting a product that was ever ordered would break order history, reports and returns, so it is ARCHIVED instead:
 * hidden from the shop and from carts, kept for history, restorable by switching it back on. A product that was never
 * ordered is really deleted (and removed from any deal that listed it). A product inside a bundle cannot go at all.
 */
export async function adminDeleteProduct(id: string): Promise<{ deleted?: true; archived?: true; message: string }> {
  const db = getAdminDb();
  const ref = db.collection('products').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ProductError(404, 'Product not found.');

  const bundles = await db.collection('bundles').get();
  const inBundle = bundles.docs.filter(b => ((b.data() as any).items || []).some((i: any) => i.productId === id));
  if (inBundle.length) throw new ProductError(409, `This product is part of the bundle "${(inBundle[0].data() as any).name}". Remove it from the bundle first.`);

  if (await productHasOrderHistory(id)) {
    await ref.update({ isActive: false, isArchived: true, archivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    invalidateProductCache();
    return { archived: true, message: 'This product has order history, so it was archived instead of deleted. It is hidden from the shop and can be restored any time.' };
  }
  const deals = await db.collection('flashDeals').where('productIds', 'array-contains', id).get();
  const batch = db.batch();
  deals.docs.forEach(d => batch.update(d.ref, { productIds: FieldValue.arrayRemove(id) }));
  batch.delete(ref);
  await batch.commit();
  invalidateProductCache();
  return { deleted: true, message: 'Product deleted.' };
}

// ── ORDERS ───────────────────────────────────────────────────
export async function adminGetOrders(filters: {
  status?: string; page?: number; pageSize?: number; search?: string;
} = {}): Promise<PaginatedResponse<Order>> {
  const db = getAdminDb();
  const { status, page = 1, pageSize = 20, search } = filters;
  const offset = (page - 1) * pageSize;
  const done = (items: Order[], total: number) =>
    ({ items, total, page, pageSize, hasMore: offset + pageSize < total });

  // Exact order-number lookup (ABC-1234) — one indexed read, scales to any size.
  if (search && /^[A-Za-z]{3}-\d{4}$/.test(search.trim())) {
    const s = await db.collection('orders').where('orderNumber', '==', search.trim().toUpperCase()).limit(1).get();
    return done(toList<Order>(s), s.size);
  }

  const filtered = status && status !== 'all';
  if (!search) {
    // Preferred: true paginated query (needs composite index status+createdAt when filtered).
    try {
      let q = db.collection('orders') as FirebaseFirestore.Query;
      if (filtered) q = q.where('status', '==', status!);
      const [snap, cnt] = await Promise.all([
        q.orderBy('createdAt', 'desc').offset(offset).limit(pageSize).get(),
        q.count().get(),
      ]);
      return done(toList<Order>(snap), cnt.data().count);
    } catch (e: any) {
      if (e?.code !== 9 /* FAILED_PRECONDITION: index missing */) throw e;
      console.warn('[orders] composite index missing — falling back to in-memory sort. Create index status ASC + createdAt DESC.');
    }
  }
  // Fallback / search: bounded in-memory pass over the latest 500 orders.
  let q = db.collection('orders') as FirebaseFirestore.Query;
  if (filtered) q = q.where('status', '==', status!);
  let items = toList<Order>(await q.limit(500).get())
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(o => o.orderNumber?.toLowerCase().includes(s) || o.userEmail?.toLowerCase().includes(s) || o.userName?.toLowerCase().includes(s));
  }
  return done(items.slice(offset, offset + pageSize), items.length);
}

export async function adminGetOrderById(id: string): Promise<Order | null> {
  return toData<Order>(await getAdminDb().collection('orders').doc(id).get());
}

export async function adminUpdateOrderStatus(id: string, status: string, note?: string): Promise<void> {
  const db = getAdminDb();
  const patch: Record<string, any> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
    statusHistory: FieldValue.arrayUnion({
      status, note: note || '', createdAt: new Date().toISOString(),
    }),
  };
  if (status === 'delivered') {
    // cash on delivery is collected at the door: mark it paid once delivered
    const cur: any = (await db.collection('orders').doc(id).get()).data();
    if (cur && String(cur.paymentMethod).toLowerCase() === 'cod' && cur.paymentStatus !== 'paid') {
      patch.paymentStatus = 'paid'; patch.paidAt = new Date().toISOString();
    }
    patch.deliveredAt = new Date().toISOString(); // starts the return window
  }
  await db.collection('orders').doc(id).update(patch);
}

export async function adminUpdateOrderTracking(id: string, trackingNumber: string, carrier: string): Promise<void> {
  await getAdminDb().collection('orders').doc(id).update({
    trackingNumber, shippingCarrier: carrier, status: 'shipped',
    updatedAt: FieldValue.serverTimestamp(),
    statusHistory: FieldValue.arrayUnion({
      status: 'shipped', note: `Tracking: ${trackingNumber} via ${carrier}`, createdAt: new Date().toISOString(),
    }),
  });
}

// ── USERS / ADDRESSES ────────────────────────────────────────
export async function adminGetUsers(filters: {
  search?: string; role?: string; page?: number; pageSize?: number;
} = {}): Promise<PaginatedResponse<User>> {
  const db = getAdminDb();
  const { role, search, page = 1, pageSize = 20 } = filters;

  // Unconstrained read, filtered/sorted in memory: orderBy('createdAt') would drop users without that
  // field and role+orderBy needs a composite index. Capped for safety.
  const snap = await db.collection('users').limit(3000).get();
  const ser = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);
  let items = snap.docs.map(d => {
    const u: any = d.data();
    // never send credentials/secrets to the browser
    const { password, passwordHash, resetToken, resetTokenExpiry, verificationToken, ...safe } = u;
    return { id: d.id, ...safe, createdAt: ser(u.createdAt), updatedAt: ser(u.updatedAt) } as unknown as User;
  });
  if (role) items = items.filter(u => (u as any).role === role);

  if (search) {
    const s = search.toLowerCase().trim();
    items = items.filter(u =>
      u.name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      String(u.phone || '').toLowerCase().includes(s)
    );
  }
  items.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const total  = items.length;
  const offset = (page - 1) * pageSize;
  return { items: items.slice(offset, offset + pageSize), total, page, pageSize, hasMore: offset + pageSize < total };
}

export async function adminGetUserAddresses(userId: string) {
  const db = getAdminDb();
  const snap = await db.collection('users').doc(userId).collection('addresses').orderBy('isDefault','desc').get();
  return toList<any>(snap);
}

export async function adminSaveAddress(userId: string, address: any): Promise<string> {
  const db = getAdminDb();
  const addrRef = db.collection('users').doc(userId).collection('addresses');
  if (address.isDefault) {
    const existing = await addrRef.where('isDefault', '==', true).get();
    for (const doc of existing.docs) await doc.ref.update({ isDefault: false });
  }
  if (address.id) {
    await addrRef.doc(address.id).set({ ...address, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return address.id;
  }
  const ref = await addrRef.add({ ...address, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function adminDeleteAddress(userId: string, addressId: string): Promise<void> {
  await getAdminDb().collection('users').doc(userId).collection('addresses').doc(addressId).delete();
}

// ── DASHBOARD STATS ──────────────────────────────────────────
export { adminGetDashboardStats, adminRebuildStats } from './stats-server';

// ── COUPONS ──────────────────────────────────────────────────
export async function adminValidateCoupon(code: string, orderAmount: number, userId?: string) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { valid: false, error: 'Enter a coupon code' };
  const snap = await getAdminDb().collection('coupons').where('code', '==', c).limit(1).get();
  const coupon = snap.empty ? null : (toData<Coupon>(snap.docs[0]) as any);
  // same rules placeOrder() applies, so the cart preview and the final charge always agree
  let uses = 0;
  if (coupon?.perUserLimit && userId) uses = Number((await getAdminDb().collection('couponUsage').doc(`${coupon.id}_${userId}`).get()).data()?.count || 0);
  const r = computeCoupon(coupon, Number(orderAmount) || 0, new Date(), uses);
  if (!r.valid) return { valid: false, error: r.error };
  return { valid: true, discount: r.discount, coupon: { code: coupon.code, type: coupon.type, value: coupon.value } };
}

// ── BANNERS ──────────────────────────────────────────────────
export async function adminGetBanners(activeOnly = false): Promise<Banner[]> {
  // unconstrained read, sorted in memory: orderBy('sortOrder') would silently drop banners missing that field
  const all = toList<Banner>(await getAdminDb().collection('banners').get());
  const ser = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);
  return all.filter(b => !activeOnly || b.isActive !== false)
    .map(b => ({ ...b, createdAt: ser(b.createdAt), updatedAt: ser((b as any).updatedAt) }) as Banner)
    .sort((x, y) => (Number(x.sortOrder) || 0) - (Number(y.sortOrder) || 0));
}
export const adminGetAllBanners = adminGetBanners;

function cleanBanner(data: any, partial: boolean) {
  const d: any = { ...data };
  for (const k of ['id', 'createdAt', 'updatedAt']) delete d[k];
  if (!partial || 'title' in d) { if (!String(d.title || '').trim()) throw new ProductError(400, 'Banner title is required.'); d.title = String(d.title).trim(); }
  if (!partial || 'image' in d) { if (!String(d.image || '').trim()) throw new ProductError(400, 'Banner image URL is required.'); d.image = String(d.image).trim(); }
  if ('link' in d && d.link && !/^(\/|https?:\/\/)/.test(String(d.link).trim())) throw new ProductError(400, 'Link must start with "/" or "https://".');
  for (const k of ['subtitle', 'titleAr', 'subtitleAr', 'buttonText', 'buttonTextAr', 'link', 'imageAlt', 'imageAltAr']) if (k in d) d[k] = String(d[k] ?? '').trim().slice(0, 200);
  if ('sortOrder' in d) d.sortOrder = Number(d.sortOrder) || 0;
  if (!partial || 'imageMode' in d) d.imageMode = d.imageMode === 'side' ? 'side' : 'background';
  return d;
}

export async function adminCreateBanner(data: any): Promise<string> {
  const ref = await getAdminDb().collection('banners').add({
    isActive: true, sortOrder: 0, ...cleanBanner(data, false), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  queueFill('banners', ref.id);
  return ref.id;
}

export async function adminUpdateBanner(id: string, data: any): Promise<void> {
  await getAdminDb().collection('banners').doc(id).update({ ...cleanBanner(data, true), updatedAt: FieldValue.serverTimestamp() });
  queueFill('banners', id);
}

export async function adminDeleteBanner(id: string): Promise<void> {
  await getAdminDb().collection('banners').doc(id).delete();
}


// ── RETURN REQUESTS ──────────────────────────────────────────
export async function adminGetReturnRequests(filters: { status?: string } = {}): Promise<ReturnRequest[]> {
  const list = toList<ReturnRequest>(await getAdminDb().collection('returnRequests').get());
  const t = (v: any) => (v ? new Date(v as any).getTime() || 0 : 0);
  return list.filter(r => !filters.status || r.status === filters.status).sort((a, b) => t(b.createdAt) - t(a.createdAt));
}

// ── BUNDLES ──────────────────────────────────────────────────
export async function adminGetBundles(activeOnly = false) {
  // Unconstrained read + in-memory sort/filter: orderBy/where on a field that is
  // missing on some docs would silently drop them (and needs a composite index).
  const all = toList<any>(await getAdminDb().collection('bundles').get());
  const ts = (v: any) => (v ? new Date(v).getTime() || 0 : 0);
  return all.filter(b => !activeOnly || b.isActive !== false).sort((x, y) => ts(y.createdAt) - ts(x.createdAt));
}

/** Public view: adds live availability (min over components) and free-shipping flag. */
export async function getStorefrontBundles() {
  const db = getAdminDb();
  const bundles = await adminGetBundles(true);
  const ids = [...new Set(bundles.flatMap((b: any) => (b.items || []).map((i: any) => i.productId)))] as string[];
  const snaps = ids.length ? await db.getAll(...ids.map(id => db.collection('products').doc(id))) : [];
  const prods = new Map(snaps.filter(s => s.exists).map(s => [s.id, s.data() as any]));
  return bundles.map((b: any) => {
    const comps = (b.items || []) as any[];
    let available = comps.length ? Infinity : 0, allFree = comps.length > 0, valid = comps.length > 0;
    for (const c of comps) {
      const p = prods.get(c.productId);
      if (!p || p.isActive === false) { valid = false; continue; }
      available = Math.min(available, Math.floor(Number(p.stock || 0) / (Number(c.quantity) || 1)));
      if (!p.freeShipping) allFree = false;
    }
    return { ...b, available: valid && Number.isFinite(available) ? available : 0, freeShipping: allFree };
  });
}

export async function adminGetBundleById(id: string) {
  return toData<any>(await getAdminDb().collection('bundles').doc(id).get());
}

/** Validate a bundle and rebuild its component snapshot from the live products (never trust the browser). */
async function normaliseBundle(data: any, partial: boolean) {
  const d: any = { ...data };
  for (const k of ['id', 'createdAt', 'updatedAt', 'available', 'freeShipping']) delete d[k];
  if (!partial || 'name' in d) {
    if (!String(d.name || '').trim()) throw new ProductError(400, 'Bundle name is required.');
    d.name = String(d.name).trim();
  }
  if (typeof d.nameAr === 'string') d.nameAr = d.nameAr.trim();
  if (!partial || 'bundlePrice' in d) {
    d.bundlePrice = Number(d.bundlePrice);
    if (!(d.bundlePrice > 0)) throw new ProductError(400, 'Bundle price must be greater than zero.');
  }
  if (d.comparePrice !== undefined && d.comparePrice !== null && d.comparePrice !== '') d.comparePrice = Number(d.comparePrice) || null;
  if (!partial || 'items' in d) {
    const raw: any[] = Array.isArray(d.items) ? d.items : [];
    if (!raw.length) throw new ProductError(400, 'Add at least one product to the bundle.');
    const db = getAdminDb();
    const merged = new Map<string, number>();
    for (const i of raw) {
      const q = Math.floor(Number(i.quantity));
      if (!i.productId || !(q >= 1)) throw new ProductError(400, 'Every bundle item needs a product and a quantity of at least 1.');
      merged.set(String(i.productId), (merged.get(String(i.productId)) || 0) + q);
    }
    const ids = [...merged.keys()];
    const snaps = await db.getAll(...ids.map(id => db.collection('products').doc(id)));
    d.items = snaps.map((sn, idx) => {
      if (!sn.exists) throw new ProductError(400, 'One of the selected products no longer exists.');
      const p: any = sn.data();
      return {
        productId: ids[idx], quantity: merged.get(ids[idx]),
        productName: p.name, name: p.name, productNameAr: p.nameAr || '', nameAr: p.nameAr || '',
        price: Number(p.price) || 0, image: p.images?.[0] || '',
      };
    });
  }
  if (!d.slug && d.name) d.slug = String(d.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return d;
}

export async function adminCreateBundle(data: any): Promise<string> {
  const clean = await normaliseBundle(data, false);
  const ref = await getAdminDb().collection('bundles').add({
    isActive: true, ...clean,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  queueFill('bundles', ref.id);
  return ref.id;
}

export async function adminUpdateBundle(id: string, data: any): Promise<void> {
  const clean = await normaliseBundle(data, true);
  await getAdminDb().collection('bundles').doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
  queueFill('bundles', id);
}

export async function adminDeleteBundle(id: string): Promise<void> {
  await getAdminDb().collection('bundles').doc(id).delete();
}

// ── ALIASES & MISSING EXPORTS ─────────────────────────────────
// These are used by existing API routes and must stay exported.

export const adminGetAllOrders = adminGetOrders;

export async function adminGetOrderByNumber(orderNumber: string): Promise<Order | null> {
  const snap = await getAdminDb().collection('orders').where('orderNumber', '==', orderNumber).limit(1).get();
  if (snap.empty) return null;
  return toData<Order>(snap.docs[0]);
}

export async function adminUpdateOrder(id: string, data: Partial<Order>): Promise<void> {
  await getAdminDb().collection('orders').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function adminUpdateUser(id: string, data: Partial<User>): Promise<void> {
  await getAdminDb().collection('users').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export const adminGetAllUsers = (filters: Parameters<typeof adminGetUsers>[0] = {}) => adminGetUsers(filters);

export async function adminSearchProducts(query: string, limit = 10): Promise<Product[]> {
  const result = await adminGetProducts({ search: query, pageSize: limit, admin: true });
  return result.items;
}

/** Bundles whose name or short description matches the query (storefront: active bundles only). */
export async function searchBundles(query: string, limit = 6, includeInactive = false) {
  const q = query.trim();
  if (!q) return [];
  const all = await adminGetBundles(!includeInactive);
  return all
    .map((b: any) => ({ b, sc: matchScore({ name: b.name, nameAr: b.nameAr, short: b.description, shortAr: b.descriptionAr }, q) }))
    .filter(x => x.sc > 0).sort((a, c) => c.sc - a.sc).slice(0, limit).map(x => x.b);
}

// ── BANNERS (full CRUD) ───────────────────────────────────────

// ── COUPONS (full CRUD) ───────────────────────────────────────
export async function adminGetAllCoupons(): Promise<Coupon[]> {
  const list = toList<Coupon>(await getAdminDb().collection('coupons').get());
  const t = (v: any) => (v ? new Date(v as any).getTime() || 0 : 0);
  return list.sort((a, b) => t(b.createdAt) - t(a.createdAt));
}

async function normaliseCoupon(data: any, partial: boolean, selfId?: string) {
  const d: any = { ...data };
  for (const k of ['id', 'createdAt', 'updatedAt', 'usedCount']) delete d[k];
  if (!partial || 'code' in d) {
    d.code = String(d.code || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9_-]{3,30}$/.test(d.code)) throw new ProductError(400, 'Coupon code must be 3-30 letters, numbers, "-" or "_".');
    const dup = await getAdminDb().collection('coupons').where('code', '==', d.code).limit(3).get();
    if (dup.docs.some(x => x.id !== selfId)) throw new ProductError(409, `The code "${d.code}" already exists.`);
  }
  if (!partial || 'type' in d) { if (!['percentage', 'fixed'].includes(d.type)) throw new ProductError(400, 'Choose a coupon type.'); }
  if (!partial || 'value' in d) {
    d.value = Number(d.value);
    if (!(d.value > 0)) throw new ProductError(400, 'Discount value must be greater than zero.');
    if (d.type === 'percentage' && d.value > 100) throw new ProductError(400, 'A percentage discount cannot exceed 100.');
  }
  for (const k of ['minOrderAmount', 'maxDiscount', 'usageLimit', 'perUserLimit']) if (k in d) {
    if (d[k] === '' || d[k] === null || d[k] === undefined) { d[k] = k === 'minOrderAmount' ? 0 : null; continue; }
    d[k] = Number(d[k]);
    if (!(d[k] >= 0)) throw new ProductError(400, `${k} cannot be negative.`);
  }
  if ('expiresAt' in d) {
    if (!d.expiresAt) d.expiresAt = null;
    else {
      // a plain date means "valid through the end of that day" in Kuwait time (UTC+3)
      const raw = String(d.expiresAt);
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T20:59:59.999Z` : raw;
      if (isNaN(new Date(iso).getTime())) throw new ProductError(400, 'Invalid expiry date.');
      d.expiresAt = iso;
    }
  }
  if ('isActive' in d) d.isActive = !!d.isActive;
  return d;
}

export async function adminCreateCoupon(data: any): Promise<string> {
  const clean = await normaliseCoupon(data, false);
  const ref = await getAdminDb().collection('coupons').add({
    isActive: true, minOrderAmount: 0, ...clean, usedCount: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function adminUpdateCoupon(id: string, data: any): Promise<void> {
  const clean = await normaliseCoupon(data, true, id);
  await getAdminDb().collection('coupons').doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

/** A coupon that customers already used keeps its usage record: it is switched off instead of deleted. */
export async function adminDeleteCoupon(id: string): Promise<{ archived?: true; message: string }> {
  const ref = getAdminDb().collection('coupons').doc(id);
  const snap = await ref.get();
  if (snap.exists && Number((snap.data() as any).usedCount || 0) > 0) {
    await ref.update({ isActive: false });
    return { archived: true, message: 'This coupon was already used in orders, so it was switched off instead of deleted.' };
  }
  await ref.delete();
  return { message: 'Coupon deleted.' };
}

// ── REVIEWS ───────────────────────────────────────────────────
export async function adminGetProductReviews(productId: string): Promise<Review[]> {
  const snap = await getAdminDb().collection('reviews')
    .where('productId', '==', productId).orderBy('createdAt', 'desc').get();
  return toList<Review>(snap);
}

export async function adminAddReview(data: Omit<Review, 'id' | 'createdAt'>): Promise<string> {
  const db  = getAdminDb();
  const ref = await db.collection('reviews').add({ ...data, createdAt: FieldValue.serverTimestamp() });
  // Update product avg rating
  const allReviews = await db.collection('reviews').where('productId', '==', data.productId).get();
  const ratings    = allReviews.docs.map(d => (d.data().rating as number) || 0);
  const avg        = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  await db.collection('products').doc(data.productId).update({
    avgRating: Math.round(avg * 10) / 10,
    totalReviews: ratings.length,
  });
  return ref.id;
}

// ── RETURN REQUESTS (full CRUD) ───────────────────────────────
export const adminGetAllReturns = (filters: Parameters<typeof adminGetReturnRequests>[0] = {}) =>
  adminGetReturnRequests(filters);

export async function adminGetUserReturns(userId: string): Promise<ReturnRequest[]> {
  const snap = await getAdminDb().collection('returnRequests').where('userId', '==', userId).get();
  const t = (v: any) => (v ? new Date(v as any).getTime() || 0 : 0);
  return toList<ReturnRequest>(snap).sort((a, b) => t(b.createdAt) - t(a.createdAt));
}

export async function adminCreateReturnRequest(data: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await getAdminDb().collection('returnRequests').add({
    ...data, status: 'pending',
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function adminUpdateReturnStatus(id: string, status: string, note?: string): Promise<void> {
  await getAdminDb().collection('returnRequests').doc(id).update({
    status, note: note || '', updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Most common brands among active products (for the home page brand strip). */
export async function getTopBrands(limit = 12): Promise<string[]> {
  const snap = await getAdminDb().collection('products').select('brand', 'isActive').get();
  const counts = new Map<string, number>();
  snap.docs.forEach(d => {
    const x = d.data() as any;
    const b = String(x.brand || '').trim();
    if (b && x.isActive !== false) counts.set(b, (counts.get(b) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([b]) => b);
}
