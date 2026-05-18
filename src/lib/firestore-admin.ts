/**
 * firestore-admin.ts
 * Server-side only — uses Firebase Admin SDK.
 * Import this in API routes (/app/api/**) ONLY.
 * Never import in 'use client' components.
 */
import { getAdminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  Product, Category, Order, User, Review, Coupon,
  Banner, ReturnRequest, ProductFilters, PaginatedResponse, DashboardStats
} from '@/types';

// ── helpers ──────────────────────────────────────────────────
function toData<T>(snap: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!snap.exists) return null;
  const d = snap.data()!;
  const convert = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        v && typeof v === 'object' && 'toDate' in (v as object)
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

const now = () => new Date().toISOString();

// ── CATEGORIES ───────────────────────────────────────────────
export async function adminGetCategories(activeOnly = true): Promise<Category[]> {
  const db = getAdminDb();
  let q = db.collection('categories').orderBy('sortOrder', 'asc') as FirebaseFirestore.Query;
  if (activeOnly) q = q.where('isActive', '==', true);
  return toList<Category>(await q.get());
}

export async function adminCreateCategory(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = getAdminDb();
  const ref = await db.collection('categories').add({
    ...data,
    showOnHome: data.showOnHome ?? true,
    showOnNav:  data.showOnNav  ?? true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function adminUpdateCategory(id: string, data: Partial<Category>): Promise<void> {
  const db = getAdminDb();
  await db.collection('categories').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function adminDeleteCategory(id: string): Promise<void> {
  await getAdminDb().collection('categories').doc(id).delete();
}

// ── PRODUCTS ─────────────────────────────────────────────────
export async function adminGetProducts(filters: ProductFilters = {}): Promise<PaginatedResponse<Product>> {
  const db = getAdminDb();
  const { categoryId, sortBy = 'newest', page = 1, pageSize = 24, search } = filters;

  let q = db.collection('products').where('isActive', '==', true) as FirebaseFirestore.Query;
  if (categoryId) q = q.where('categoryId', '==', categoryId);
  if (filters.isFeatured)  q = q.where('isFeatured',  '==', true);
  if (filters.isNewArrival) q = q.where('isNewArrival','==', true);
  if (filters.isOnSale)    q = q.where('isOnSale',    '==', true);
  if (filters.brand)       q = q.where('brand',       '==', filters.brand);
  if (filters.inStock)     q = q.where('stock',       '>',  0);

  switch (sortBy) {
    case 'price_asc':  q = q.orderBy('price', 'asc');  break;
    case 'price_desc': q = q.orderBy('price', 'desc'); break;
    case 'popular':    q = q.orderBy('totalSold', 'desc'); break;
    case 'rating':     q = q.orderBy('avgRating', 'desc'); break;
    default:           q = q.orderBy('createdAt', 'desc');
  }

  const totalSnap = await q.count().get();
  const total = totalSnap.data().count;

  const offset = (page - 1) * pageSize;
  const snap = await q.limit(pageSize + offset).get();
  let items = snap.docs.slice(offset, offset + pageSize).map(d => toData<Product>(d)!);

  if (search) {
    const s = search.toLowerCase();
    items = items.filter(p =>
      p.name.toLowerCase().includes(s) ||
      p.sku?.toLowerCase().includes(s) ||
      p.brand?.toLowerCase().includes(s) ||
      p.tags?.some(t => t.toLowerCase().includes(s))
    );
  }

  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

export async function adminGetProductById(id: string): Promise<Product | null> {
  return toData<Product>(await getAdminDb().collection('products').doc(id).get());
}

export async function adminGetProductBySlug(slug: string): Promise<Product | null> {
  const snap = await getAdminDb().collection('products').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  return toData<Product>(snap.docs[0]);
}

export async function adminCreateProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await getAdminDb().collection('products').add({
    ...data,
    avgRating: 0,
    totalReviews: 0,
    totalSold: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function adminUpdateProduct(id: string, data: Partial<Product>): Promise<void> {
  await getAdminDb().collection('products').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function adminDeleteProduct(id: string): Promise<void> {
  await getAdminDb().collection('products').doc(id).delete();
}

// ── ORDERS ───────────────────────────────────────────────────
export async function adminGetAllOrders(status?: string, page = 1, pageSize = 20): Promise<PaginatedResponse<Order>> {
  const db = getAdminDb();
  let q = db.collection('orders').orderBy('createdAt', 'desc') as FirebaseFirestore.Query;
  if (status && status !== 'all') q = db.collection('orders').where('status', '==', status).orderBy('createdAt', 'desc');

  const totalSnap = await q.count().get();
  const total = totalSnap.data().count;

  const offset = (page - 1) * pageSize;
  const snap = await q.limit(pageSize + offset).get();
  const items = snap.docs.slice(offset, offset + pageSize).map(d => toData<Order>(d)!);

  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

export async function adminGetOrderById(id: string): Promise<Order | null> {
  return toData<Order>(await getAdminDb().collection('orders').doc(id).get());
}

export async function adminGetOrderByNumber(orderNumber: string): Promise<Order | null> {
  const snap = await getAdminDb().collection('orders').where('orderNumber', '==', orderNumber).limit(1).get();
  if (snap.empty) return null;
  return toData<Order>(snap.docs[0]);
}

export async function adminUpdateOrderStatus(orderId: string, status: string, note?: string): Promise<void> {
  const historyEntry = { status, note: note || '', createdAt: now() };
  const update: Record<string, unknown> = {
    status,
    statusHistory: FieldValue.arrayUnion(historyEntry),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (status === 'delivered') update.deliveredAt = FieldValue.serverTimestamp();
  if (status === 'cancelled') update.cancelledAt = FieldValue.serverTimestamp();
  await getAdminDb().collection('orders').doc(orderId).update(update);
}

export async function adminUpdateOrderTracking(orderId: string, trackingNumber: string, carrier: string): Promise<void> {
  await getAdminDb().collection('orders').doc(orderId).update({
    trackingNumber,
    shippingCarrier: carrier,
    status: 'shipped',
    statusHistory: FieldValue.arrayUnion({
      status: 'shipped',
      note: `Shipped via ${carrier}. Tracking: ${trackingNumber}`,
      createdAt: now(),
    }),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ── USERS ────────────────────────────────────────────────────
export async function adminGetAllUsers(page = 1, pageSize = 20): Promise<PaginatedResponse<User>> {
  const db = getAdminDb();
  const q = db.collection('users').orderBy('createdAt', 'desc');

  const totalSnap = await q.count().get();
  const total = totalSnap.data().count;

  const offset = (page - 1) * pageSize;
  const snap = await q.limit(pageSize + offset).get();
  const items = snap.docs.slice(offset, offset + pageSize).map(d => toData<User>(d)!);

  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

export async function adminGetUserById(uid: string): Promise<User | null> {
  return toData<User>(await getAdminDb().collection('users').doc(uid).get());
}

// ── DASHBOARD STATS ──────────────────────────────────────────
export async function adminGetDashboardStats(): Promise<DashboardStats> {
  const db = getAdminDb();
  const n = new Date();
  const startThisMonth = new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  const startLastMonth = new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString();
  const endLastMonth   = startThisMonth;
  const ago14days      = new Date(n.getTime() - 14 * 864e5).toISOString();
  const ago1year       = new Date(n.getFullYear() - 1, n.getMonth(), n.getDate()).toISOString();

  const [totalOrders, totalProducts, totalCustomers,
         recentSnap, thisMonthSnap, lastMonthSnap, last14Snap, yearSnap] = await Promise.all([
    db.collection('orders').count().get(),
    db.collection('products').where('isActive','==',true).count().get(),
    db.collection('users').where('role','==','customer').count().get(),
    db.collection('orders').orderBy('createdAt','desc').limit(10).get(),
    db.collection('orders').where('createdAt','>=',startThisMonth).orderBy('createdAt','desc').get(),
    db.collection('orders').where('createdAt','>=',startLastMonth).where('createdAt','<',endLastMonth).orderBy('createdAt','desc').get(),
    db.collection('orders').where('createdAt','>=',ago14days).orderBy('createdAt','desc').get(),
    db.collection('orders').where('createdAt','>=',ago1year).orderBy('createdAt','desc').get(),
  ]);

  const recentOrders    = toList<Order>(recentSnap);
  const thisMonthOrders = toList<Order>(thisMonthSnap);
  const lastMonthOrders = toList<Order>(lastMonthSnap);
  const last14Orders    = toList<Order>(last14Snap);
  const yearOrders      = toList<Order>(yearSnap);

  const paid = (list: Order[]) => list.filter(o => o.paymentStatus === 'paid').reduce((s,o) => s + o.total, 0);
  const thisRevenue = paid(thisMonthOrders);
  const lastRevenue = paid(lastMonthOrders);
  const totalRevenue = paid(yearOrders);

  const revenueChange = lastRevenue ? ((thisRevenue - lastRevenue) / lastRevenue) * 100 : 100;
  const ordersChange  = lastMonthOrders.length ? ((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100 : 100;

  const ordersByStatus: Record<string, number> = {};
  for (const o of last14Orders) ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;

  const revenueByDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayOrders = last14Orders.filter(o => o.createdAt?.startsWith(dateStr));
    return { date: dateStr, revenue: paid(dayOrders), orders: dayOrders.length };
  });

  return {
    totalRevenue,
    totalOrders:    totalOrders.data().count,
    totalProducts:  totalProducts.data().count,
    totalCustomers: totalCustomers.data().count,
    revenueChange:  Math.round(revenueChange * 10) / 10,
    ordersChange:   Math.round(ordersChange  * 10) / 10,
    recentOrders,
    topProducts: [],
    ordersByStatus,
    revenueByDay,
  };
}

// ── COUPONS ──────────────────────────────────────────────────
export async function adminValidateCoupon(code: string, orderAmount: number) {
  const snap = await getAdminDb().collection('coupons').where('code', '==', code.toUpperCase()).limit(1).get();
  if (snap.empty) return { valid: false, error: 'Invalid coupon code' };
  const coupon = toData<Coupon>(snap.docs[0])!;
  if (!coupon.isActive)                                         return { valid: false, error: 'Coupon is inactive' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, error: 'Coupon has expired' };
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)  return { valid: false, error: 'Coupon usage limit reached' };
  if (orderAmount < coupon.minOrderAmount) return { valid: false, error: `Minimum order amount is KWD ${coupon.minOrderAmount.toFixed(3)}` };
  let discount = coupon.type === 'percentage' ? (orderAmount * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  return { valid: true, coupon, discount: Math.round(discount * 1000) / 1000 };
}

// ── RETURNS ──────────────────────────────────────────────────
export async function adminGetAllReturns(): Promise<ReturnRequest[]> {
  return toList<ReturnRequest>(
    await getAdminDb().collection('returns').orderBy('createdAt', 'desc').get()
  );
}

// ── SEARCH ───────────────────────────────────────────────────
export async function adminSearchProducts(term: string, max = 10): Promise<Product[]> {
  const snap = await getAdminDb()
    .collection('products')
    .where('isActive', '==', true)
    .orderBy('name')
    .limit(150)
    .get();
  const s = term.toLowerCase();
  return snap.docs
    .map(d => toData<Product>(d)!)
    .filter(p => p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.tags?.some(t => t.toLowerCase().includes(s)))
    .slice(0, max);
}

// ── BANNERS ──────────────────────────────────────────────────
export async function adminGetBanners(): Promise<Banner[]> {
  return toList<Banner>(
    await getAdminDb().collection('banners').where('isActive','==',true).orderBy('sortOrder','asc').get()
  );
}

// ── REVIEWS ──────────────────────────────────────────────────
export async function adminGetProductReviews(productId: string): Promise<Review[]> {
  const snap = await getAdminDb().collection('reviews')
    .where('productId','==',productId)
    .where('isApproved','==',true)
    .orderBy('createdAt','desc')
    .get();
  return toList<Review>(snap);
}

export async function adminAddReview(data: Omit<Review,'id'>): Promise<string> {
  const db  = getAdminDb();
  const ref = await db.collection('reviews').add({ ...data, createdAt: FieldValue.serverTimestamp() });
  // Incremental avg — no full refetch
  await db.runTransaction(async tx => {
    const pRef  = db.collection('products').doc(data.productId);
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists) return;
    const { avgRating = 0, totalReviews = 0 } = pSnap.data()!;
    const newTotal = totalReviews + 1;
    const newAvg   = Math.round(((avgRating * totalReviews + data.rating) / newTotal) * 10) / 10;
    tx.update(pRef, { avgRating: newAvg, totalReviews: newTotal });
  });
  return ref.id;
}

// ── USER / PROFILE ────────────────────────────────────────────
export async function adminUpdateUser(uid: string, data: Partial<User>): Promise<void> {
  await getAdminDb().collection('users').doc(uid).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

// ── ORDERS (extra) ────────────────────────────────────────────
export async function adminCreateReturnRequest(data: Omit<ReturnRequest,'id'>): Promise<string> {
  const ref = await getAdminDb().collection('returns').add({
    ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  await getAdminDb().collection('orders').doc(data.orderId).update({ status: 'return_requested', updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function adminGetUserReturns(userId: string): Promise<ReturnRequest[]> {
  return toList<ReturnRequest>(
    await getAdminDb().collection('returns').where('userId','==',userId).orderBy('createdAt','desc').get()
  );
}

export async function adminUpdateReturnStatus(id: string, status: string, note?: string): Promise<void> {
  await getAdminDb().collection('returns').doc(id).update({
    status, adminNote: note || '', updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function adminUpdateOrder(id: string, data: Record<string, unknown>): Promise<void> {
  await getAdminDb().collection('orders').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

// ── COUPONS (admin CRUD) ──────────────────────────────────────
export async function adminGetAllCoupons(): Promise<Coupon[]> {
  return toList<Coupon>(await getAdminDb().collection('coupons').orderBy('createdAt','desc').get());
}

export async function adminCreateCoupon(data: Omit<Coupon,'id'|'usedCount'|'createdAt'>): Promise<string> {
  const ref = await getAdminDb().collection('coupons').add({
    ...data, usedCount: 0, createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function adminUpdateCoupon(id: string, data: Partial<Coupon>): Promise<void> {
  await getAdminDb().collection('coupons').doc(id).update(data);
}

export async function adminDeleteCoupon(id: string): Promise<void> {
  await getAdminDb().collection('coupons').doc(id).delete();
}

// ── BANNERS (admin CRUD) ──────────────────────────────────────
export async function adminGetAllBanners(): Promise<Banner[]> {
  return toList<Banner>(
    await getAdminDb().collection('banners').orderBy('sortOrder','asc').get()
  );
}

export async function adminCreateBanner(data: Omit<Banner,'id'|'createdAt'>): Promise<string> {
  const ref = await getAdminDb().collection('banners').add({
    ...data, createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function adminUpdateBanner(id: string, data: Partial<Banner>): Promise<void> {
  await getAdminDb().collection('banners').doc(id).update(data);
}

export async function adminDeleteBanner(id: string): Promise<void> {
  await getAdminDb().collection('banners').doc(id).delete();
}
