/**
 * revenue.ts — SERVER ONLY. When is a sale really "revenue"?
 *
 *   placed ─▶ … ─▶ delivered ──(return window ends, no return/refund)──▶ RECOGNISED
 *
 * Until then the order's money is "pending" (still on its way) or "held" (delivered, return window open).
 * Cancelled / returned / refunded orders never become revenue; a part-refund recognises only what the customer kept.
 *
 * Order fields:  revenueState: 'held' | 'recognized' | 'void',  revenueDueAt (ISO), revenueAmount (KWD recognised)
 * Rollups written ONLY when revenue is recognised:
 *   revenueDaily/{YYYY-MM-DD} { revenue, goods, shipping, discount, orders, units, refunds, refundCount }
 *   categoryStats/{id}.recRevenue/.recUnits     products/{id}.recRevenue/.recUnits
 * so the dashboard still never scans orders. settleDueRevenue() is cheap (reads only orders still "held") and runs on every dashboard load.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { deliveredAtOf } from './returns';
import { windowFor } from './loyalty';

export const kuwaitDay = (d: Date) => new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 10);
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** What an order contributes when recognised. factor < 1 for a part-refund (share the customer kept). Pure. */
export function revenueParts(o: any, factor = 1) {
  const f = Math.min(1, Math.max(0, factor));
  const cats = new Map<string, { name: string; revenue: number; units: number }>();
  const prods = new Map<string, { revenue: number; units: number }>();
  let units = 0;
  for (const i of (o.items || []) as any[]) {
    const q = num(i.quantity);
    const bundle = Array.isArray(i.bundleItems) || String(i.productId || '').startsWith('bundle:');
    const k = bundle ? 'bundles' : (i.categoryId || 'uncategorised');
    const c = cats.get(k) || { name: bundle ? 'Bundles' : (i.categoryName || 'Uncategorised'), revenue: 0, units: 0 };
    c.revenue += num(i.total) * f; c.units += q * f; cats.set(k, c);
    units += q * f;
    if (bundle) (i.bundleItems || []).forEach((b: any) => { const p = prods.get(b.productId) || { revenue: 0, units: 0 }; p.units += num(b.quantity) * q * f; prods.set(b.productId, p); });
    else { const p = prods.get(i.productId) || { revenue: 0, units: 0 }; p.revenue += num(i.total) * f; p.units += q * f; prods.set(i.productId, p); }
  }
  const total = round3(num(o.total) * f);
  return { revenue: total, shipping: round3(num(o.shippingCost) * f), discount: round3((num(o.discount) + num(o.loyaltyDiscount) + num(o.dealDiscount)) * f), units: Math.round(units), cats, prods };
}

/** Called when an order is marked delivered: its money is held until the return window ends. Safe to repeat. */
export async function holdRevenue(orderId: string): Promise<void> {
  const db = getAdminDb();
  const o: any = (await db.collection('orders').doc(orderId).get()).data();
  if (!o || o.revenueState) return;
  const days = await windowFor(db, o);
  const from = deliveredAtOf(o) || new Date();
  await db.collection('orders').doc(orderId).update({ revenueState: 'held', revenueDueAt: new Date(from.getTime() + days * 86400000).toISOString() });
}

function writeRecognised(tx: any, db: any, o: any, f: number, now: Date) {
  const p = revenueParts(o, f);
  tx.set(db.collection('revenueDaily').doc(kuwaitDay(now)),
    { date: kuwaitDay(now), revenue: FieldValue.increment(p.revenue), shipping: FieldValue.increment(p.shipping), discount: FieldValue.increment(p.discount), orders: FieldValue.increment(1), units: FieldValue.increment(p.units) }, { merge: true });
  p.cats.forEach((c, k) => tx.set(db.collection('categoryStats').doc(k), { name: c.name, recRevenue: FieldValue.increment(round3(c.revenue)), recUnits: FieldValue.increment(Math.round(c.units)) }, { merge: true }));
  p.prods.forEach((x, id) => tx.set(db.collection('products').doc(id), { recRevenue: FieldValue.increment(round3(x.revenue)), recUnits: FieldValue.increment(Math.round(x.units)) }, { merge: true }));
  return p;
}

/** Books every held order whose return window has ended and that is still plainly delivered. Idempotent (state flips inside the transaction). */
export async function settleDueRevenue(now = new Date(), limit = 300): Promise<number> {
  const db = getAdminDb();
  const snap = await db.collection('orders').where('revenueState', '==', 'held').limit(limit).get();
  let n = 0;
  for (const d of snap.docs) {
    const o: any = d.data();
    if (!['delivered', 'return_rejected'].includes(o.status)) continue;                 // a return/refund in progress keeps it on hold
    if (!o.revenueDueAt || new Date(o.revenueDueAt).getTime() > now.getTime()) continue;
    n += await db.runTransaction(async (tx: any) => {
      const cur: any = (await tx.get(d.ref)).data();
      if (!cur || cur.revenueState !== 'held' || !['delivered', 'return_rejected'].includes(cur.status)) return 0;
      const p = writeRecognised(tx, db, cur, 1, now);
      tx.update(d.ref, { revenueState: 'recognized', revenueAmount: p.revenue, revenueAt: now.toISOString() });
      return 1;
    });
  }
  return n;
}

/** A refund was issued for an order. Nothing recognised yet: a full refund voids it, a part-refund recognises only what was kept. Refund money is logged either way. */
export async function applyRefund(orderId: string, refundAmount: number, now = new Date()): Promise<void> {
  const db = getAdminDb();
  await db.runTransaction(async (tx: any) => {
    const ref = db.collection('orders').doc(orderId); const o: any = (await tx.get(ref)).data();
    if (!o || o.refundApplied) return;                                                   // each order's refund is booked once
    const total = Math.max(0.001, num(o.total));
    const amt = Math.min(total, Math.max(0, num(refundAmount)));
    if (o.revenueState === 'recognized') {   // refunded after booking (admin override): take the refund back out of today's figures
      tx.set(db.collection('revenueDaily').doc(kuwaitDay(now)), { date: kuwaitDay(now), revenue: FieldValue.increment(-round3(amt)), refunds: FieldValue.increment(round3(amt)), refundCount: FieldValue.increment(1) }, { merge: true });
      tx.update(ref, { revenueAmount: round3(num(o.revenueAmount) - amt), refundApplied: true });
      return;
    }
    const kept = total - amt;
    if (kept > 0.0005) {
      const p = writeRecognised(tx, db, o, kept / total, now);
      tx.update(ref, { revenueState: 'recognized', revenueAmount: p.revenue, revenueAt: now.toISOString(), refundApplied: true });
    } else tx.update(ref, { revenueState: 'void', revenueAmount: 0, refundApplied: true });
    tx.set(db.collection('revenueDaily').doc(kuwaitDay(now)), { date: kuwaitDay(now), refunds: FieldValue.increment(round3(amt)), refundCount: FieldValue.increment(1) }, { merge: true });
  });
}
