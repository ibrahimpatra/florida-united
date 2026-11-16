/**
 * stats-server.ts — SERVER ONLY. Dashboard analytics WITHOUT scanning orders.
 *
 * Data model (maintained transactionally by placeOrder / cancelOrder):
 *   statsDaily/{YYYY-MM-DD}  { revenue, orders, units }          ← revenue/AOV/trends
 *   categoryStats/{catId}    { name, revenue, units }            ← category performance
 *   products/{id}.totalSold / .totalRevenue                      ← top products, dead stock
 *   users/{id}.totalSpent / .orderCount                          ← customer lifetime value
 * Counts (orders by status, totals) use Firestore count() aggregation queries.
 *
 * Cost of one dashboard load ≈ 62 daily docs + ~12 count aggregates + ~40 small docs,
 * independent of how many orders exist.
 *
 * adminRebuildStats() recomputes all rollups from existing orders ONCE (needed for
 * orders placed before this update). Safe to re-run.
 */
import { getAdminDb } from './firebase-admin';
import type { Order, DashboardStats } from '@/types';

const kuwaitDay = (d: Date) => new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 10);
const dayKeyBack = (n: number) => kuwaitDay(new Date(Date.now() - n * 864e5));
const iso = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);
const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

export async function adminGetDashboardStats(): Promise<DashboardStats> {
  const db = getAdminDb();
  const warnings: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (e: any) { console.error(`[stats:${label}]`, e); warnings.push(`${label}: ${e?.message || 'failed'}`); return fallback; }
  };

  // 62 days of rollups → this month vs last month, last 30d, last 14d chart
  const keys = Array.from({ length: 62 }, (_, i) => dayKeyBack(i));
  const daily = await safe('daily', async () => {
    const snaps = await db.getAll(...keys.map(k => db.collection('statsDaily').doc(k)));
    const m = new Map<string, { revenue: number; orders: number; units: number }>();
    snaps.forEach((s, i) => { const d: any = s.data() || {}; m.set(keys[i], { revenue: d.revenue || 0, orders: d.orders || 0, units: d.units || 0 }); });
    return m;
  }, new Map<string, { revenue: number; orders: number; units: number }>());

  const sum = (ks: string[]) => ks.reduce((a, k) => {
    const d = daily.get(k); return d ? { revenue: a.revenue + d.revenue, orders: a.orders + d.orders } : a;
  }, { revenue: 0, orders: 0 });

  const today = kuwaitDay(new Date());
  const monthPrefix = today.slice(0, 7);
  const prevMonthDate = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1));
  const prevPrefix = prevMonthDate.toISOString().slice(0, 7);
  const thisMonth = sum(keys.filter(k => k.startsWith(monthPrefix)));
  const lastMonth = sum(keys.filter(k => k.startsWith(prevPrefix)));
  const last30 = sum(keys.slice(0, 30));
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : a > 0 ? 100 : 0);

  const revenueByDay = Array.from({ length: 14 }, (_, i) => {
    const k = dayKeyBack(13 - i); const d = daily.get(k);
    return { date: k, revenue: d?.revenue || 0, orders: d?.orders || 0 };
  });

  const [totalOrders, totalProducts, totalCustomers] = await Promise.all([
    safe('orders count', async () => (await db.collection('orders').count().get()).data().count, 0),
    safe('products count', async () => (await db.collection('products').where('isActive', '==', true).count().get()).data().count, 0),
    safe('customers count', async () => (await db.collection('users').where('role', '==', 'customer').count().get()).data().count, 0),
  ]);

  const ordersByStatus: Record<string, number> = {};
  await Promise.all(STATUSES.map(st => safe(`status ${st}`, async () => {
    const c = (await db.collection('orders').where('status', '==', st).count().get()).data().count;
    if (c) ordersByStatus[st] = c;
  }, undefined)));

  const topProducts = await safe('top products', async () => {
    const s = await db.collection('products').orderBy('totalSold', 'desc').limit(8).get();
    return s.docs.map(d => { const p: any = d.data(); return { id: d.id, name: p.name, units: p.totalSold || 0, revenue: p.totalRevenue || 0, image: p.images?.[0] }; })
      .filter(p => p.units > 0);
  }, [] as any[]);

  const deadStock = await safe('dead stock', async () => {
    const s = await db.collection('products').where('totalSold', '==', 0).limit(60).get();
    return s.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(p => p.isActive !== false && (p.stock || 0) > 0)
      .slice(0, 12).map(p => ({ id: p.id, name: p.name, stock: p.stock, image: p.images?.[0], price: p.price }));
  }, [] as any[]);

  const categoryPerformance = await safe('categories', async () => {
    const s = await db.collection('categoryStats').orderBy('revenue', 'desc').limit(8).get();
    return s.docs.map(d => { const c: any = d.data(); return { name: c.name || 'Uncategorised', revenue: Math.max(0, c.revenue || 0), units: Math.max(0, c.units || 0) }; })
      .filter(c => c.units > 0 || c.revenue > 0);
  }, [] as any[]);

  const topCustomers = await safe('customers', async () => {
    const s = await db.collection('users').orderBy('totalSpent', 'desc').limit(6).get();
    return s.docs.map(d => { const u: any = d.data(); return { id: d.id, name: u.name || u.email, email: u.email, totalSpent: u.totalSpent || 0, orderCount: u.orderCount || 0 }; })
      .filter(u => u.totalSpent > 0);
  }, [] as any[]);

  const recentOrders = await safe('recent orders', async () => {
    const s = await db.collection('orders').orderBy('createdAt', 'desc').limit(10).get();
    return s.docs.map(d => { const o: any = d.data(); return { id: d.id, ...o, createdAt: iso(o.createdAt), updatedAt: iso(o.updatedAt) } as Order; });
  }, [] as Order[]);

  const noRollups = last30.orders === 0 && totalOrders > 0;
  if (noRollups) warnings.unshift('Analytics are empty for existing orders — click "Rebuild analytics" once to backfill them.');

  return {
    totalRevenue: last30.revenue, totalOrders, totalProducts, totalCustomers,
    revenueChange: pct(thisMonth.revenue, lastMonth.revenue), ordersChange: pct(thisMonth.orders, lastMonth.orders),
    recentOrders, topProducts, categoryPerformance, deadStock, topCustomers,
    avgOrderValue: last30.orders ? last30.revenue / last30.orders : 0,
    ordersByStatus, revenueByDay, warnings,
  } as DashboardStats;
}

/** One-off (re-runnable) backfill of every rollup from existing orders. Chunked, memory-light. */
export async function adminRebuildStats(): Promise<{ orders: number; products: number; days: number }> {
  const db = getAdminDb();

  // product → category lookup for legacy order items that lack categoryId
  const pSnap = await db.collection('products').get();
  const prodMeta = new Map<string, { categoryId?: string; categoryName?: string }>();
  pSnap.docs.forEach(d => { const p: any = d.data(); prodMeta.set(d.id, { categoryId: p.categoryId, categoryName: p.categoryName }); });

  const daily = new Map<string, { revenue: number; orders: number; units: number }>();
  const cats = new Map<string, { name: string; revenue: number; units: number }>();
  const prods = new Map<string, { sold: number; revenue: number }>();
  const users = new Map<string, { spent: number; count: number }>();
  const dayFix: Array<[FirebaseFirestore.DocumentReference, string]> = [];
  let orders = 0;

  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db.collection('orders').orderBy('__name__').limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const o: any = doc.data();
      if (['cancelled', 'returned', 'refunded'].includes(o.status)) continue;
      const created: Date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || Date.now());
      const day = kuwaitDay(created);
      orders++;
      if (o.statsDay !== day) dayFix.push([doc.ref, day]);
      const units = (o.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0);
      const dd = daily.get(day) || { revenue: 0, orders: 0, units: 0 };
      dd.revenue += o.total || 0; dd.orders += 1; dd.units += units; daily.set(day, dd);
      const u = users.get(o.userId) || { spent: 0, count: 0 }; u.spent += o.total || 0; u.count += 1; users.set(o.userId, u);
      for (const i of (o.items || []) as any[]) {
        const bundle = Array.isArray(i.bundleItems) || String(i.productId).startsWith('bundle:');
        const meta = prodMeta.get(i.productId);
        const cid = bundle ? 'bundles' : (i.categoryId || meta?.categoryId || 'uncategorised');
        const cname = bundle ? 'Bundles' : (i.categoryName || meta?.categoryName || 'Uncategorised');
        const c = cats.get(cid) || { name: cname, revenue: 0, units: 0 }; c.revenue += i.total || 0; c.units += i.quantity || 0; cats.set(cid, c);
        if (bundle) { (i.bundleItems || []).forEach((b: any) => { const p = prods.get(b.productId) || { sold: 0, revenue: 0 }; p.sold += b.quantity * i.quantity; prods.set(b.productId, p); }); }
        else { const p = prods.get(i.productId) || { sold: 0, revenue: 0 }; p.sold += i.quantity || 0; p.revenue += i.total || 0; prods.set(i.productId, p); }
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }

  // wipe + rewrite rollup collections
  const wipe = async (col: string) => {
    const s = await db.collection(col).get();
    for (let i = 0; i < s.docs.length; i += 400) { const b = db.batch(); s.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
  };
  await Promise.all([wipe('statsDaily'), wipe('categoryStats')]);

  type Op = (b: FirebaseFirestore.WriteBatch) => void;
  const ops: Op[] = [];
  daily.forEach((v, k) => ops.push(b => b.set(db.collection('statsDaily').doc(k), { date: k, ...v })));
  cats.forEach((v, k) => ops.push(b => b.set(db.collection('categoryStats').doc(k), v)));
  pSnap.docs.forEach(d => { const p = prods.get(d.id) || { sold: 0, revenue: 0 }; ops.push(b => b.update(d.ref, { totalSold: p.sold, totalRevenue: p.revenue })); });
  users.forEach((v, uid) => ops.push(b => b.set(db.collection('users').doc(uid), { totalSpent: v.spent, orderCount: v.count }, { merge: true })));
  dayFix.forEach(([ref, day]) => ops.push(b => b.update(ref, { statsDay: day })));
  for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach(f => f(b)); await b.commit(); }

  return { orders, products: pSnap.size, days: daily.size };
}
