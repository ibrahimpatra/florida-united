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
import { settleDueRevenue, revenueParts } from './revenue';
import { returnWindowDays, deliveredAtOf } from './returns';

import { AggregateField } from 'firebase-admin/firestore';
import { kuwaitDay } from './revenue';
const dayKeyBack = (n: number) => kuwaitDay(new Date(Date.now() - n * 864e5));
const iso = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);
const ALL_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'return_requested', 'return_approved', 'return_rejected', 'return_picked_up', 'returned', 'refunded', 'cancelled'];
const IN_PROGRESS = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery'];
const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export async function adminGetDashboardStats(): Promise<DashboardStats> {
  const db = getAdminDb();
  const warnings: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (e: any) { console.error(`[stats:${label}]`, e); warnings.push(`${label}: ${e?.message || 'failed'}`); return fallback; }
  };

  // book any revenue whose return window has just ended (cheap: reads only orders still "held")
  await safe('settle revenue', () => settleDueRevenue(), 0);

  // 62 days of recognised revenue + 30 days of placed orders
  const keys = Array.from({ length: 62 }, (_, i) => dayKeyBack(i));
  type Rev = { revenue: number; shipping: number; discount: number; orders: number; refunds: number; refundCount: number };
  const rec = await safe('revenue', async () => {
    const snaps = await db.getAll(...keys.map(k => db.collection('revenueDaily').doc(k)));
    const m = new Map<string, Rev>();
    snaps.forEach((s, i) => { const d: any = s.data() || {}; m.set(keys[i], { revenue: d.revenue || 0, shipping: d.shipping || 0, discount: d.discount || 0, orders: d.orders || 0, refunds: d.refunds || 0, refundCount: d.refundCount || 0 }); });
    return m;
  }, new Map<string, Rev>());
  const placedDaily = await safe('placed', async () => {
    const snaps = await db.getAll(...keys.map(k => db.collection('statsDaily').doc(k)));
    const m = new Map<string, { revenue: number; orders: number }>();
    snaps.forEach((s, i) => { const d: any = s.data() || {}; m.set(keys[i], { revenue: d.revenue || 0, orders: d.orders || 0 }); });
    return m;
  }, new Map<string, { revenue: number; orders: number }>());

  const sumRec = (ks: string[]) => ks.reduce((a, k) => {
    const d = rec.get(k); return d ? { revenue: a.revenue + d.revenue, orders: a.orders + d.orders, shipping: a.shipping + d.shipping, discount: a.discount + d.discount, refunds: a.refunds + d.refunds, refundCount: a.refundCount + d.refundCount } : a;
  }, { revenue: 0, orders: 0, shipping: 0, discount: 0, refunds: 0, refundCount: 0 });
  const sumPlaced = (ks: string[]) => ks.reduce((a, k) => { const d = placedDaily.get(k); return d ? { revenue: a.revenue + d.revenue, orders: a.orders + d.orders } : a; }, { revenue: 0, orders: 0 });

  const today = kuwaitDay(new Date());
  const monthPrefix = today.slice(0, 7);
  const prevPrefix = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1)).toISOString().slice(0, 7);
  const thisMonth = sumRec(keys.filter(k => k.startsWith(monthPrefix)));
  const lastMonth = sumRec(keys.filter(k => k.startsWith(prevPrefix)));
  const last30 = sumRec(keys.slice(0, 30));
  const last7 = sumRec(keys.slice(0, 7));
  const placed30 = sumPlaced(keys.slice(0, 30));
  const placedThisMonth = sumPlaced(keys.filter(k => k.startsWith(monthPrefix)));
  const placedLastMonth = sumPlaced(keys.filter(k => k.startsWith(prevPrefix)));
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : a > 0 ? 100 : 0);

  const revenueByDay = Array.from({ length: 14 }, (_, i) => {
    const k = dayKeyBack(13 - i);
    return { date: k, revenue: r3(rec.get(k)?.revenue || 0), orders: placedDaily.get(k)?.orders || 0, placed: r3(placedDaily.get(k)?.revenue || 0) };
  });

  const [totalOrders, totalProducts, totalCustomers] = await Promise.all([
    safe('orders count', async () => (await db.collection('orders').count().get()).data().count, 0),
    safe('products count', async () => (await db.collection('products').where('isActive', '==', true).count().get()).data().count, 0),
    safe('customers count', async () => (await db.collection('users').where('role', '==', 'customer').count().get()).data().count, 0),
  ]);

  const ordersByStatus: Record<string, number> = {};
  await Promise.all(ALL_STATUSES.map(st => safe(`status ${st}`, async () => {
    const c = (await db.collection('orders').where('status', '==', st).count().get()).data().count;
    if (c) ordersByStatus[st] = c;
  }, undefined)));

  const sumOf = async (q: FirebaseFirestore.Query) => { const d = (await q.aggregate({ s: AggregateField.sum('total'), n: AggregateField.count() }).get()).data(); return { amount: r3(Number(d.s) || 0), count: d.n || 0 }; };
  const [inProg, held] = await Promise.all([
    safe('pending revenue', () => sumOf(db.collection('orders').where('status', 'in', IN_PROGRESS)), { amount: 0, count: 0 }),
    safe('held revenue', () => sumOf(db.collection('orders').where('revenueState', '==', 'held')), { amount: 0, count: 0 }),
  ]);

  const topProducts = await safe('top products', async () => {
    const s = await db.collection('products').orderBy('recRevenue', 'desc').limit(8).get();
    return s.docs.map(d => { const p: any = d.data(); return { id: d.id, name: p.name, units: p.recUnits || 0, revenue: p.recRevenue || 0, image: p.images?.[0] }; })
      .filter(p => p.units > 0 || p.revenue > 0);
  }, [] as any[]);

  const deadStock = await safe('dead stock', async () => {
    const s = await db.collection('products').where('totalSold', '==', 0).limit(60).get();
    return s.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(p => p.isActive !== false && (p.stock || 0) > 0)
      .slice(0, 12).map(p => ({ id: p.id, name: p.name, stock: p.stock, image: p.images?.[0], price: p.price }));
  }, [] as any[]);

  const categoryPerformance = await safe('categories', async () => {
    const s = await db.collection('categoryStats').orderBy('recRevenue', 'desc').limit(8).get();
    return s.docs.map(d => { const c: any = d.data(); return { name: c.name || 'Uncategorised', revenue: Math.max(0, c.recRevenue || 0), units: Math.max(0, c.recUnits || 0) }; })
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

  if (placed30.orders === 0 && totalOrders > 0) warnings.unshift('Analytics are empty for existing orders — click "Rebuild analytics" once to backfill them.');
  else if ((ordersByStatus.delivered || 0) > 0 && last30.orders === 0 && held.count === 0 && !topProducts.length)
    warnings.unshift('Revenue is booked once an order is delivered and its return window has ended. Click "Rebuild analytics" once so older deliveries are counted.');

  return {
    totalRevenue: r3(last30.revenue), totalOrders, totalProducts, totalCustomers,
    revenueChange: pct(thisMonth.revenue, lastMonth.revenue), ordersChange: pct(placedThisMonth.orders, placedLastMonth.orders),
    recentOrders, topProducts, categoryPerformance, deadStock, topCustomers,
    avgOrderValue: last30.orders ? r3(last30.revenue / last30.orders) : 0,
    ordersByStatus, revenueByDay, warnings,
    recognized: { today: r3(rec.get(today)?.revenue || 0), last7: r3(last7.revenue), last30: r3(last30.revenue), thisMonth: r3(thisMonth.revenue), lastMonth: r3(lastMonth.revenue), orders30: last30.orders, shipping30: r3(last30.shipping), discount30: r3(last30.discount) },
    pendingRevenue: { inProgress: inProg.amount, inProgressCount: inProg.count, held: held.amount, heldCount: held.count },
    refunds: { last30: r3(last30.refunds), count30: last30.refundCount },
    placed: { last30: r3(placed30.revenue), orders30: placed30.orders },
  } as DashboardStats;
}

/**
 * Rebuild-time version of the recognition rule (pure). Returns null for orders that are not delivered yet (nothing to book).
 * book = recognised now (window over), held = delivered inside window or return in progress, void = cancelled/returned.
 */
export function recogniseForRebuild(o: any, defaultDays: number, refundAmount: number | undefined, nowMs: number) {
  const st = o.status;
  const toDate = (v: any) => { const d = new Date(v?.toDate ? v.toDate() : v); return isNaN(d.getTime()) ? null : d; };
  if (st === 'cancelled' || st === 'returned') return { state: 'void', amount: 0, parts: null as any, book: null, refund: 0, refundDay: null as string | null, patch: { revenueState: 'void', revenueAmount: 0 } };
  const own = ((o.items || []) as any[]).filter(i => i.isReturnable !== false).map(i => Number(i.returnDays)).filter(n => n > 0);
  const days = own.length ? returnWindowDays(Math.max(...own)) : defaultDays;
  const delivered = deliveredAtOf(o) || toDate(o.updatedAt) || toDate(o.createdAt) || new Date(nowMs);
  const due = new Date(delivered.getTime() + days * 86400000);
  if (st === 'refunded') {
    const refund = Math.min(Number(o.total) || 0, Math.max(0, refundAmount ?? Number(o.total) ?? 0));
    const kept = (Number(o.total) || 0) - refund; const when = toDate(o.updatedAt) || new Date(nowMs);
    const parts = kept > 0.0005 ? revenueParts(o, kept / Math.max(0.001, Number(o.total))) : null;
    return { state: parts ? 'recognized' : 'void', amount: parts ? parts.revenue : 0, parts, book: parts ? { day: kuwaitDay(when) } : null, refund, refundDay: kuwaitDay(when),
      patch: { revenueState: parts ? 'recognized' : 'void', revenueAmount: parts ? parts.revenue : 0, refundApplied: true } };
  }
  if (!['delivered', 'return_requested', 'return_approved', 'return_picked_up', 'return_rejected'].includes(st)) return null;
  if (['delivered', 'return_rejected'].includes(st) && due.getTime() <= nowMs) {
    const parts = revenueParts(o, 1);
    return { state: 'recognized', amount: parts.revenue, parts, book: { day: kuwaitDay(due) }, refund: 0, refundDay: null, patch: { revenueState: 'recognized', revenueAmount: parts.revenue, revenueAt: due.toISOString() } };
  }
  return { state: 'held', amount: undefined as any, parts: null, book: null, refund: 0, refundDay: null, patch: { revenueState: 'held', revenueDueAt: due.toISOString() } };
}

/** One-off (re-runnable) backfill of every rollup from existing orders. Chunked, memory-light. */
export async function adminRebuildStats(): Promise<{ orders: number; products: number; days: number }> {
  const db = getAdminDb();

  // product → category lookup for legacy order items that lack categoryId
  const pSnap = await db.collection('products').get();
  const prodMeta = new Map<string, { categoryId?: string; categoryName?: string }>();
  pSnap.docs.forEach(d => { const p: any = d.data(); prodMeta.set(d.id, { categoryId: p.categoryId, categoryName: p.categoryName }); });

  // recognised-revenue inputs: store return window + the refund amount recorded on each return request
  const defDays = returnWindowDays(((await db.doc('config/storeSettings').get()).data() as any)?.defaultReturnDays);
  const refundOf = new Map<string, number>();
  (await db.collection('returnRequests').get()).docs.forEach(d => { const r: any = d.data(); if (r.status === 'refunded' && r.refundAmount !== undefined) refundOf.set(r.orderId, Number(r.refundAmount) || 0); });
  const recDaily = new Map<string, { revenue: number; shipping: number; discount: number; orders: number; units: number; refunds: number; refundCount: number }>();
  const recCats = new Map<string, { name: string; revenue: number; units: number }>();
  const recProds = new Map<string, { revenue: number; units: number }>();
  const orderFix: Array<[FirebaseFirestore.DocumentReference, Record<string, any>]> = [];
  const nowMs = Date.now();
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
      const rv = recogniseForRebuild(o, defDays, refundOf.get(doc.id), nowMs);
      if (rv) {
        if (rv.state !== o.revenueState || rv.amount !== o.revenueAmount) orderFix.push([doc.ref, rv.patch]);
        if (rv.book && rv.parts) {
          const dd = recDaily.get(rv.book.day) || { revenue: 0, shipping: 0, discount: 0, orders: 0, units: 0, refunds: 0, refundCount: 0 };
          dd.revenue += rv.parts.revenue; dd.shipping += rv.parts.shipping; dd.discount += rv.parts.discount; dd.orders += 1; dd.units += rv.parts.units; recDaily.set(rv.book.day, dd);
          rv.parts.cats.forEach((c, k) => { const x = recCats.get(k) || { name: c.name, revenue: 0, units: 0 }; x.revenue += c.revenue; x.units += c.units; recCats.set(k, x); });
          rv.parts.prods.forEach((c, k) => { const x = recProds.get(k) || { revenue: 0, units: 0 }; x.revenue += c.revenue; x.units += c.units; recProds.set(k, x); });
        }
        if (rv.refund > 0) { const dd = recDaily.get(rv.refundDay!) || { revenue: 0, shipping: 0, discount: 0, orders: 0, units: 0, refunds: 0, refundCount: 0 }; dd.refunds += rv.refund; dd.refundCount += 1; recDaily.set(rv.refundDay!, dd); }
      }
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
  await Promise.all([wipe('statsDaily'), wipe('categoryStats'), wipe('revenueDaily')]);

  type Op = (b: FirebaseFirestore.WriteBatch) => void;
  const ops: Op[] = [];
  daily.forEach((v, k) => ops.push(b => b.set(db.collection('statsDaily').doc(k), { date: k, ...v })));
  cats.forEach((v, k) => ops.push(b => b.set(db.collection('categoryStats').doc(k), { ...v, recRevenue: r3(recCats.get(k)?.revenue || 0), recUnits: Math.round(recCats.get(k)?.units || 0) })));
  recCats.forEach((v, k) => { if (!cats.has(k)) ops.push(b => b.set(db.collection('categoryStats').doc(k), { name: v.name, revenue: 0, units: 0, recRevenue: r3(v.revenue), recUnits: Math.round(v.units) })); });
  recDaily.forEach((v, k) => ops.push(b => b.set(db.collection('revenueDaily').doc(k), { date: k, revenue: r3(v.revenue), shipping: r3(v.shipping), discount: r3(v.discount), orders: v.orders, units: Math.round(v.units), refunds: r3(v.refunds), refundCount: v.refundCount })));
  orderFix.forEach(([ref, patch]) => ops.push(b => b.update(ref, patch)));
  pSnap.docs.forEach(d => { const p = prods.get(d.id) || { sold: 0, revenue: 0 }; ops.push(b => b.update(d.ref, { totalSold: p.sold, totalRevenue: p.revenue, recRevenue: r3(recProds.get(d.id)?.revenue || 0), recUnits: Math.round(recProds.get(d.id)?.units || 0) })); });
  users.forEach((v, uid) => ops.push(b => b.set(db.collection('users').doc(uid), { totalSpent: v.spent, orderCount: v.count }, { merge: true })));
  dayFix.forEach(([ref, day]) => ops.push(b => b.update(ref, { statsDay: day })));
  for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach(f => f(b)); await b.commit(); }

  return { orders, products: pSnap.size, days: daily.size };
}
