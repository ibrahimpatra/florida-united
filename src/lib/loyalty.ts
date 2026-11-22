/**
 * Loyalty (server side). Data:
 *   settings/loyalty            the rules (Admin > Settings > Loyalty)
 *   users/{id}.loyaltyPoints    current balance (never below 0)
 *   loyaltyLedger/{key}         one row per change: earn, redeem, refund, reverse, adjust (key makes each one happen only once)
 * Earn: when an order becomes "delivered" (once per order, flag order.loyaltyEarned).
 * Redeem: at checkout inside the order transaction (orders-server).
 * Give back: cancelling an order returns the points that were used. A refunded return takes back the points earned on the refunded part.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { DEFAULT_LOYALTY, earnPoints, round3, sanitizeLoyalty, type LoyaltySettings } from './loyalty-core';

export async function loadLoyaltySettings(db = getAdminDb()): Promise<LoyaltySettings> {
  try { const s = await db.collection('settings').doc('loyalty').get(); return s.exists ? sanitizeLoyalty(s.data()) : DEFAULT_LOYALTY; }
  catch { return DEFAULT_LOYALTY; }
}
export async function saveLoyaltySettings(b: any) { const s = sanitizeLoyalty(b); await getAdminDb().collection('settings').doc('loyalty').set(s); return s; }

export async function getBalance(userId: string) {
  const u: any = (await getAdminDb().collection('users').doc(userId).get()).data() || {};
  return { points: Math.max(0, Math.floor(Number(u.loyaltyPoints) || 0)), lifetimeSpent: Number(u.totalSpent) || 0 };
}

/** Called when an order is delivered. Safe to call many times. */
export async function awardForDelivered(orderId: string): Promise<number> {
  const db = getAdminDb(); const s = await loadLoyaltySettings(db);
  if (!s.enabled) return 0;
  return db.runTransaction(async tx => {
    const oRef = db.collection('orders').doc(orderId); const o: any = (await tx.get(oRef)).data();
    if (!o || o.loyaltyEarned !== undefined || o.status === 'cancelled') return 0;
    const uRef = db.collection('users').doc(o.userId); const u: any = (await tx.get(uRef)).data() || {};
    const goods = round3(Number(o.subtotal || 0) - Number(o.discount || 0) - Number(o.loyaltyDiscount || 0));
    const pts = earnPoints(s, goods, Number(u.totalSpent) || 0);
    tx.update(oRef, { loyaltyEarned: pts });
    if (pts > 0) {
      tx.set(uRef, { loyaltyPoints: FieldValue.increment(pts) }, { merge: true });
      tx.set(db.collection('loyaltyLedger').doc(`${orderId}_earn`), { userId: o.userId, orderId, orderNumber: o.orderNumber || '', type: 'earn', points: pts, note: `Order ${o.orderNumber || ''} delivered`, createdAt: new Date().toISOString() });
    }
    return pts;
  });
}

/** A refunded return takes back the points earned on the refunded share of the order. */
export async function reverseForRefund(orderId: string, refundAmount: number): Promise<number> {
  const db = getAdminDb();
  return db.runTransaction(async tx => {
    const oRef = db.collection('orders').doc(orderId); const o: any = (await tx.get(oRef)).data();
    if (!o || !(Number(o.loyaltyEarned) > 0)) return 0;
    const already = Number(o.loyaltyReversed) || 0;
    const share = Math.min(1, Math.max(0, refundAmount) / Math.max(0.001, Number(o.total) || 1));
    const take = Math.min(Number(o.loyaltyEarned) - already, Math.ceil(Number(o.loyaltyEarned) * share));
    if (take <= 0) return 0;
    const uRef = db.collection('users').doc(o.userId); const u: any = (await tx.get(uRef)).data() || {};
    const real = Math.min(take, Math.max(0, Number(u.loyaltyPoints) || 0)); // balance never goes below 0
    tx.update(oRef, { loyaltyReversed: already + take });
    if (real > 0) {
      tx.set(uRef, { loyaltyPoints: FieldValue.increment(-real) }, { merge: true });
      tx.set(db.collection('loyaltyLedger').doc(`${orderId}_reverse_${already + take}`), { userId: o.userId, orderId, orderNumber: o.orderNumber || '', type: 'reverse', points: -real, note: `Refund on order ${o.orderNumber || ''}`, createdAt: new Date().toISOString() });
    }
    return real;
  });
}

/** Admin: add or remove points by hand. */
export async function adjustPoints(userId: string, delta: number, note: string, by: string) {
  const db = getAdminDb(); const d = Math.trunc(delta);
  if (!d) throw new Error('Enter a number of points other than 0.');
  await db.runTransaction(async tx => {
    const uRef = db.collection('users').doc(userId); const u = await tx.get(uRef);
    if (!u.exists) throw new Error('Customer not found.');
    const bal = Math.max(0, Number((u.data() as any).loyaltyPoints) || 0);
    if (bal + d < 0) throw new Error(`This customer only has ${bal} points.`);
    tx.set(uRef, { loyaltyPoints: FieldValue.increment(d) }, { merge: true });
    tx.set(db.collection('loyaltyLedger').doc(), { userId, type: 'adjust', points: d, note: (note || 'Manual adjustment').slice(0, 120), by, createdAt: new Date().toISOString() });
  });
}

export async function history(userId: string, limit = 30) {
  const snap = await getAdminDb().collection('loyaltyLedger').where('userId', '==', userId).get();
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
}
