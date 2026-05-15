// src/lib/firestore.ts
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, DocumentSnapshot,
  writeBatch, increment, serverTimestamp, Timestamp, setDoc,
  getCountFromServer, runTransaction, QueryConstraint,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Product, Category, Order, User, Review, Coupon,
  Banner, Offer, ReturnRequest, ProductFilters,
  PaginatedResponse, DashboardStats
} from '@/types';

// ─── HELPERS ────────────────────────────────────────────────
const toData = <T>(snap: DocumentSnapshot): T | null => {
  if (!snap.exists()) return null;
  const d = snap.data();
  // Convert Firestore Timestamps to ISO strings
  const convert = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        v instanceof Timestamp ? v.toDate().toISOString()
          : v && typeof v === 'object' && !Array.isArray(v) ? convert(v as Record<string, unknown>)
          : v,
      ])
    );
  return { id: snap.id, ...convert(d) } as T;
};

const toDataList = <T>(snaps: DocumentSnapshot[]): T[] =>
  snaps.map((s) => toData<T>(s)).filter(Boolean) as T[];

// ─── CATEGORIES ──────────────────────────────────────────────
export const categoriesCollection = collection(db, 'categories');

export async function getCategories(activeOnly = true): Promise<Category[]> {
  const constraints: QueryConstraint[] = [orderBy('sortOrder', 'asc')];
  if (activeOnly) constraints.unshift(where('isActive', '==', true));
  const snap = await getDocs(query(categoriesCollection, ...constraints));
  return snap.docs.map((d) => toData<Category>(d)!);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const snap = await getDocs(query(categoriesCollection, where('slug', '==', slug), limit(1)));
  if (snap.empty) return null;
  return toData<Category>(snap.docs[0]);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  return toData<Category>(await getDoc(doc(db, 'categories', id)));
}

export async function createCategory(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(categoriesCollection, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  await updateDoc(doc(db, 'categories', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'categories', id));
}

// ─── PRODUCTS ────────────────────────────────────────────────
export const productsCollection = collection(db, 'products');

export async function getProducts(filters: ProductFilters = {}): Promise<PaginatedResponse<Product>> {
  const {
    categoryId, categorySlug, minPrice, maxPrice, brand,
    inStock, isFeatured, isNewArrival, isOnSale, search,
    sortBy = 'newest', page = 1, pageSize = 24
  } = filters;

  const constraints: QueryConstraint[] = [where('isActive', '==', true)];

  if (categoryId) constraints.push(where('categoryId', '==', categoryId));
  if (isFeatured) constraints.push(where('isFeatured', '==', true));
  if (isNewArrival) constraints.push(where('isNewArrival', '==', true));
  if (isOnSale) constraints.push(where('isOnSale', '==', true));
  if (brand) constraints.push(where('brand', '==', brand));
  if (inStock) constraints.push(where('stock', '>', 0));
  if (minPrice !== undefined) constraints.push(where('price', '>=', minPrice));
  if (maxPrice !== undefined) constraints.push(where('price', '<=', maxPrice));

  // Sort
  switch (sortBy) {
    case 'price_asc': constraints.push(orderBy('price', 'asc')); break;
    case 'price_desc': constraints.push(orderBy('price', 'desc')); break;
    case 'name_asc': constraints.push(orderBy('name', 'asc')); break;
    case 'name_desc': constraints.push(orderBy('name', 'desc')); break;
    case 'popular': constraints.push(orderBy('totalSold', 'desc')); break;
    case 'rating': constraints.push(orderBy('avgRating', 'desc')); break;
    default: constraints.push(orderBy('createdAt', 'desc'));
  }

  const countSnap = await getCountFromServer(query(productsCollection, ...constraints));
  const total = countSnap.data().count;

  // Pagination
  const offset = (page - 1) * pageSize;
  const pageConstraints = [...constraints, limit(pageSize + offset)];
  const snap = await getDocs(query(productsCollection, ...pageConstraints));
  const pageDocs = snap.docs.slice(offset, offset + pageSize);

  let items = pageDocs.map((d) => toData<Product>(d)!);

  // Client-side search filter (Firestore doesn't support full-text)
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s) ||
        p.tags?.some((t) => t.toLowerCase().includes(s))
    );
  }

  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const snap = await getDocs(query(productsCollection, where('slug', '==', slug), limit(1)));
  if (snap.empty) return null;
  return toData<Product>(snap.docs[0]);
}

export async function getProductById(id: string): Promise<Product | null> {
  return toData<Product>(await getDoc(doc(db, 'products', id)));
}

export async function getRelatedProducts(categoryId: string, excludeId: string, count = 6): Promise<Product[]> {
  const snap = await getDocs(
    query(productsCollection,
      where('categoryId', '==', categoryId),
      where('isActive', '==', true),
      orderBy('totalSold', 'desc'),
      limit(count + 1)
    )
  );
  return snap.docs
    .map((d) => toData<Product>(d)!)
    .filter((p) => p.id !== excludeId)
    .slice(0, count);
}

export async function getFeaturedProducts(count = 8): Promise<Product[]> {
  const snap = await getDocs(
    query(productsCollection,
      where('isFeatured', '==', true),
      where('isActive', '==', true),
      orderBy('totalSold', 'desc'),
      limit(count)
    )
  );
  return snap.docs.map((d) => toData<Product>(d)!);
}

export async function getNewArrivals(count = 8): Promise<Product[]> {
  const snap = await getDocs(
    query(productsCollection,
      where('isNewArrival', '==', true),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(count)
    )
  );
  return snap.docs.map((d) => toData<Product>(d)!);
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(productsCollection, {
    ...data,
    avgRating: 0,
    totalReviews: 0,
    totalSold: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  await updateDoc(doc(db, 'products', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id));
}

export async function searchProducts(searchTerm: string, maxResults = 10): Promise<Product[]> {
  // Search by name prefix (basic Firestore search)
  const term = searchTerm.toLowerCase();
  const snap = await getDocs(
    query(productsCollection,
      where('isActive', '==', true),
      orderBy('name'),
      limit(100)
    )
  );
  return snap.docs
    .map((d) => toData<Product>(d)!)
    .filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.brand?.toLowerCase().includes(term) ||
      p.tags?.some((t) => t.toLowerCase().includes(term))
    )
    .slice(0, maxResults);
}

// ─── ORDERS ──────────────────────────────────────────────────
export const ordersCollection = collection(db, 'orders');

export async function createOrder(data: Omit<Order, 'id'>): Promise<string> {
  const ref = await addDoc(ordersCollection, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update product stock & sold counts
  const batch = writeBatch(db);
  for (const item of data.items) {
    const pRef = doc(db, 'products', item.productId);
    batch.update(pRef, {
      stock: increment(-item.quantity),
      totalSold: increment(item.quantity),
    });
  }
  await batch.commit();

  return ref.id;
}

export async function getOrderById(id: string): Promise<Order | null> {
  return toData<Order>(await getDoc(doc(db, 'orders', id)));
}


export async function updateOrder(id: string, data: Partial<Order>): Promise<void> {
  await updateDoc(doc(db, 'orders', id), { ...data, updatedAt: serverTimestamp() });
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const snap = await getDocs(
    query(ordersCollection, where('orderNumber', '==', orderNumber), limit(1))
  );
  if (snap.empty) return null;
  return toData<Order>(snap.docs[0]);
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  const snap = await getDocs(
    query(ordersCollection, where('userId', '==', userId), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => toData<Order>(d)!);
}

export async function getAllOrders(
  status?: string, page = 1, pageSize = 20
): Promise<PaginatedResponse<Order>> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (status && status !== 'all') constraints.unshift(where('status', '==', status));

  const countSnap = await getCountFromServer(query(ordersCollection, ...constraints));
  const total = countSnap.data().count;

  // Cursor-based: fetch first N*page docs then slice the last page — avoids downloading everything
  const offset = (page - 1) * pageSize;
  const snap = await getDocs(query(ordersCollection, ...constraints, limit(offset + pageSize)));
  const items = snap.docs.slice(offset).map((d) => toData<Order>(d)!);

  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  note?: string
): Promise<void> {
  const orderRef = doc(db, 'orders', orderId);
  const historyEntry = {
    status,
    note: note || '',
    createdAt: new Date().toISOString(),
  };
  await updateDoc(orderRef, {
    status,
    statusHistory: arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
    ...(status === 'delivered' && { deliveredAt: serverTimestamp() }),
    ...(status === 'cancelled' && { cancelledAt: serverTimestamp() }),
  });
}

export async function updateOrderTracking(
  orderId: string,
  trackingNumber: string,
  carrier: string
): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), {
    trackingNumber,
    shippingCarrier: carrier,
    status: 'shipped',
    statusHistory: arrayUnion({
      status: 'shipped',
      note: `Shipped via ${carrier}. Tracking: ${trackingNumber}`,
      createdAt: new Date().toISOString(),
    }),
    updatedAt: serverTimestamp(),
  });
}

// ─── USERS ───────────────────────────────────────────────────
export const usersCollection = collection(db, 'users');

export async function getUserById(uid: string): Promise<User | null> {
  return toData<User>(await getDoc(doc(db, 'users', uid)));
}

export async function createUser(uid: string, data: Omit<User, 'uid' | 'createdAt' | 'updatedAt'>): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateUser(uid: string, data: Partial<User>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
}

export async function getAllUsers(page = 1, pageSize = 20): Promise<PaginatedResponse<User>> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  const countSnap = await getCountFromServer(query(usersCollection, ...constraints));
  const total = countSnap.data().count;
  const offset = (page - 1) * pageSize;
  const snap = await getDocs(query(usersCollection, ...constraints, limit(pageSize + offset)));
  const items = snap.docs.slice(offset, offset + pageSize).map((d) => toData<User>(d)!);
  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

// ─── REVIEWS ─────────────────────────────────────────────────
export const reviewsCollection = collection(db, 'reviews');

export async function getProductReviews(productId: string): Promise<Review[]> {
  const snap = await getDocs(
    query(reviewsCollection,
      where('productId', '==', productId),
      where('isApproved', '==', true),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map((d) => toData<Review>(d)!);
}

export async function addReview(data: Omit<Review, 'id'>): Promise<string> {
  const ref = await addDoc(reviewsCollection, { ...data, createdAt: serverTimestamp() });

  // Update product avg rating incrementally — no need to refetch all reviews
  await runTransaction(db, async (tx) => {
    const pRef = doc(db, 'products', data.productId);
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists()) return;
    const { avgRating = 0, totalReviews = 0 } = pSnap.data();
    const newTotal = totalReviews + 1;
    const newAvg = Math.round(((avgRating * totalReviews + data.rating) / newTotal) * 10) / 10;
    tx.update(pRef, { avgRating: newAvg, totalReviews: newTotal });
  });

  return ref.id;
}

// ─── COUPONS ─────────────────────────────────────────────────
export const couponsCollection = collection(db, 'coupons');

export async function validateCoupon(code: string, orderAmount: number): Promise<{ valid: boolean; coupon?: Coupon; discount?: number; error?: string }> {
  const snap = await getDocs(
    query(couponsCollection, where('code', '==', code.toUpperCase()), limit(1))
  );
  if (snap.empty) return { valid: false, error: 'Invalid coupon code' };

  const coupon = toData<Coupon>(snap.docs[0])!;

  if (!coupon.isActive) return { valid: false, error: 'Coupon is inactive' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, error: 'Coupon has expired' };
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return { valid: false, error: 'Coupon usage limit reached' };
  if (orderAmount < coupon.minOrderAmount) return { valid: false, error: `Minimum order amount is KWD ${coupon.minOrderAmount.toFixed(3)}` };

  let discount = coupon.type === 'percentage'
    ? (orderAmount * coupon.value) / 100
    : coupon.value;

  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);

  return { valid: true, coupon, discount: Math.round(discount * 100) / 100 };
}

export async function incrementCouponUsage(couponId: string): Promise<void> {
  await updateDoc(doc(db, 'coupons', couponId), { usedCount: increment(1) });
}

// ─── BANNERS ─────────────────────────────────────────────────
export async function getBanners(): Promise<Banner[]> {
  const snap = await getDocs(
    query(collection(db, 'banners'), where('isActive', '==', true), orderBy('sortOrder', 'asc'))
  );
  return snap.docs.map((d) => toData<Banner>(d)!);
}

// ─── OFFERS ──────────────────────────────────────────────────
export async function getActiveOffers(): Promise<Offer[]> {
  const now = new Date().toISOString();
  const snap = await getDocs(
    query(collection(db, 'offers'),
      where('isActive', '==', true),
      where('startDate', '<=', now),
      orderBy('startDate', 'desc')
    )
  );
  return snap.docs
    .map((d) => toData<Offer>(d)!)
    .filter((o) => o.endDate >= now);
}

// ─── RETURNS ─────────────────────────────────────────────────
export async function createReturnRequest(data: Omit<ReturnRequest, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'returns'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateOrderStatus(data.orderId, 'return_requested', 'Return request submitted by customer');
  return ref.id;
}

export async function getUserReturns(userId: string): Promise<ReturnRequest[]> {
  const snap = await getDocs(
    query(collection(db, 'returns'), where('userId', '==', userId), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => toData<ReturnRequest>(d)!);
}

export async function getAllReturns(): Promise<ReturnRequest[]> {
  const snap = await getDocs(
    query(collection(db, 'returns'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => toData<ReturnRequest>(d)!);
}

export async function updateReturnStatus(
  returnId: string,
  status: string,
  refundAmount?: number,
  adminNote?: string,
  isRefundable?: boolean,
  adminImages?: string[],
  photoVerified?: boolean
): Promise<void> {
  await updateDoc(doc(db, 'returns', returnId), {
    status,
    ...(refundAmount !== undefined && { refundAmount }),
    ...(adminNote && { adminNote }),
    ...(isRefundable !== undefined && { isRefundable }),
    ...(adminImages && { adminImages }),
    ...(photoVerified !== undefined && { photoVerified }),
    updatedAt: serverTimestamp(),
  });
}

// ─── WISHLIST ────────────────────────────────────────────────
export async function getUserWishlist(userId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'wishlists', userId));
  if (!snap.exists()) return [];
  return snap.data()?.productIds || [];
}

export async function toggleWishlist(userId: string, productId: string): Promise<boolean> {
  const ref = doc(db, 'wishlists', userId);
  const snap = await getDoc(ref);
  const productIds: string[] = snap.exists() ? snap.data()?.productIds || [] : [];
  const isInWishlist = productIds.includes(productId);

  if (isInWishlist) {
    await setDoc(ref, { productIds: arrayRemove(productId) }, { merge: true });
  } else {
    await setDoc(ref, { productIds: arrayUnion(productId) }, { merge: true });
  }
  return !isInWishlist;
}

// ─── DASHBOARD STATS ────────────────────────────────────────
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfThisMonth  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const fourteenDaysAgo   = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const oneYearAgo        = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();

  // ── Fire all queries in parallel — zero full-table scans ──
  const [
    totalOrdersSnap,
    productsSnap,
    usersSnap,
    recentOrdersSnap,
    thisMonthSnap,
    lastMonthSnap,
    last14DaysSnap,
    yearlyOrdersSnap,
  ] = await Promise.all([
    getCountFromServer(query(ordersCollection)),
    getCountFromServer(query(productsCollection, where('isActive', '==', true))),
    getCountFromServer(query(usersCollection, where('role', '==', 'customer'))),
    getDocs(query(ordersCollection, orderBy('createdAt', 'desc'), limit(10))),
    getDocs(query(ordersCollection, where('createdAt', '>=', startOfThisMonth), orderBy('createdAt', 'desc'))),
    getDocs(query(ordersCollection, where('createdAt', '>=', startOfLastMonth), where('createdAt', '<', startOfThisMonth), orderBy('createdAt', 'desc'))),
    getDocs(query(ordersCollection, where('createdAt', '>=', fourteenDaysAgo), orderBy('createdAt', 'desc'))),
    getDocs(query(ordersCollection, where('createdAt', '>=', oneYearAgo), orderBy('createdAt', 'desc'))),
  ]);

  const recentOrders      = recentOrdersSnap.docs.map((d) => toData<Order>(d)!);
  const thisMonthOrders   = thisMonthSnap.docs.map((d) => toData<Order>(d)!);
  const lastMonthOrders   = lastMonthSnap.docs.map((d) => toData<Order>(d)!);
  const last14DaysOrders  = last14DaysSnap.docs.map((d) => toData<Order>(d)!);
  const yearlyOrders      = yearlyOrdersSnap.docs.map((d) => toData<Order>(d)!);

  // Revenue from last 12 months (covers all meaningful history for charts)
  const totalRevenue = yearlyOrders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((s, o) => s + o.total, 0);

  const thisRevenue = thisMonthOrders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);
  const lastRevenue = lastMonthOrders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);

  const revenueChange = lastRevenue
    ? ((thisRevenue - lastRevenue) / lastRevenue) * 100
    : 100;
  const ordersChange = lastMonthOrders.length
    ? ((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100
    : 100;

  // Orders by status from the 14-day window (recent picture)
  const ordersByStatus: Record<string, number> = {};
  for (const o of last14DaysOrders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
  }

  // Revenue by day — last 14 days only (we already have the data)
  const revenueByDay: Array<{ date: string; revenue: number; orders: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOrders = last14DaysOrders.filter((o) => o.createdAt.startsWith(dateStr));
    revenueByDay.push({
      date: dateStr,
      revenue: dayOrders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0),
      orders: dayOrders.length,
    });
  }

  return {
    totalRevenue,
    totalOrders: totalOrdersSnap.data().count,
    totalProducts: productsSnap.data().count,
    totalCustomers: usersSnap.data().count,
    revenueChange: Math.round(revenueChange * 10) / 10,
    ordersChange: Math.round(ordersChange * 10) / 10,
    recentOrders,
    topProducts: [],
    ordersByStatus,
    revenueByDay,
  };
}

// ─── NOTIFICATIONS ───────────────────────────────────────────
export async function createNotification(data: Omit<import('@/types').Notification, 'id'>): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    ...data,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export async function getUserNotifications(userId: string): Promise<import('@/types').Notification[]> {
  const snap = await getDocs(
    query(collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    )
  );
  return snap.docs.map((d) => toData<import('@/types').Notification>(d)!);
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('userId', '==', userId), where('isRead', '==', false))
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}
