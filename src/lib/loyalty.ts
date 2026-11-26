/**
 * Loyalty (server side). Data:
 *   settings/loyalty            the rules (Admin > Settings > Loyalty)
 *   users/{id}.loyaltyPoints    current balance (never below 0)
 *   loyaltyLedger/{key}         one row per change: earn, redeem, refund, reverse, adjust (key makes each one happen only once)
 * Earn: when an order is delivered the points are held as pending; they are credited after the return window ends (releaseDue) and only for customers who joined.
 * Redeem: at checkout inside the order transaction (orders-server).
 * Give back: cancelling an order returns the points that were used. A refunded return takes back the points earned on the refunded part.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { cfgMemo, dropCfg } from './memo';
import { getAdminDb } from './firebase-admin';
import { returnWindowDays, deliveredAtOf } from './returns';
import { DEFAULT_LOYALTY, earnPoints, round3, sanitizeLoyalty, type LoyaltySettings } from './loyalty-core';

export async function loadLoyaltySettings(db = getAdminDb()): Promise<LoyaltySettings> {
  try { return await cfgMemo(db, 'loyalty-settings', 10 * 60_000, async () => { const s = await db.collection('settings').doc('loyalty').get(); return s.exists ? sanitizeLoyalty(s.data()) : DEFAULT_LOYALTY; }); }
  catch { return DEFAULT_LOYALTY; }
}
export async function saveLoyaltySettings(b: any) { dropCfg(); const s = sanitizeLoyalty(b); await getAdminDb().collection('settings').doc('loyalty').set(s); return s; }

export async function getBalance(userId: string) {
  const u: any = (await getAdminDb().collection('users').doc(userId).get()).data() || {};
  return { points: Math.max(0, Math.floor(Number(u.loyaltyPoints) || 0)), lifetimeSpent: Number(u.totalSpent) || 0 };
}

/** Return window for an order: the longest window among its returnable items (their own returnDays), else the store default. */
export async function windowFor(db: any, o: any): Promise<number> {
  const own = ((o.items || []) as any[]).filter(i => i.isReturnable !== false).map(i => Number(i.returnDays)).filter(n => n > 0);
  if (own.length) return returnWindowDays(Math.max(...own));
  try { return returnWindowDays(((await db.doc('config/storeSettings').get()).data() as any)?.defaultReturnDays); } catch { return returnWindowDays(undefined); }
}

/**
 * Called when an order is delivered. The points are only WORKED OUT and held as "pending"; they reach the balance once the return window has passed
 * (see releaseDue), so a customer cannot return the goods and keep the points. Safe to call many times.
 */
export async function awardForDelivered(orderId: string): Promise<number> {
  const db = getAdminDb(); const s = await loadLoyaltySettings(db);
  if (!s.enabled) return 0;
  const oSnap: any = (await db.collection('orders').doc(orderId).get()).data();
  if (!oSnap) return 0;
  const days = await windowFor(db, oSnap);
  return db.runTransaction(async tx => {
    const oRef = db.collection('orders').doc(orderId); const o: any = (await tx.get(oRef)).data();
    if (!o || o.loyaltyEarned !== undefined || o.loyaltyPending !== undefined || o.status === 'cancelled') return 0;
    const uRef = db.collection('users').doc(o.userId); const u: any = (await tx.get(uRef)).data() || {};
    const goods = round3(Number(o.subtotal || 0) - Number(o.discount || 0) - Number(o.loyaltyDiscount || 0));
    const pts = earnPoints(s, goods, Number(u.totalSpent) || 0);
    const from = deliveredAtOf(o) || new Date();
    tx.update(oRef, { loyaltyPending: pts, loyaltyReleaseAt: new Date(from.getTime() + days * 86400000).toISOString() });
    return pts;
  });
}

export const isMember = (u: any) => !!u && (u.loyaltyJoined === true || Number(u.loyaltyPoints) > 0);

/** The customer taps Join on the loyalty page. Nothing is created before that. */
export async function joinLoyalty(userId: string) {
  const ref = getAdminDb().collection('users').doc(userId);
  await ref.set({ loyaltyJoined: true, loyaltyJoinedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Moves pending points to the balance for orders whose return window has ended and that have no return/refund in progress.
 * Only members receive points; a non-member's pending points wait until they join. Runs when the customer opens the loyalty page or checkout.
 */
export async function releaseDue(userId: string, now = Date.now()): Promise<number> {
  const db = getAdminDb();
  const u: any = (await db.collection('users').doc(userId).get()).data();
  if (!isMember(u)) return 0;
  const snap = await db.collection('orders').where('userId', '==', userId).get();
  let total = 0;
  for (const d of snap.docs) {
    const o: any = d.data();
    if (!(Number(o.loyaltyPending) > 0) || o.loyaltyEarned !== undefined) continue;
    if (!['delivered', 'return_rejected'].includes(o.status)) continue;          // a return in progress (or refund/cancel) holds the points
    if (!o.loyaltyReleaseAt || new Date(o.loyaltyReleaseAt).getTime() > now) continue;
    total += await db.runTransaction(async tx => {
      const oRef = d.ref; const cur: any = (await tx.get(oRef)).data();
      if (!cur || cur.loyaltyEarned !== undefined || !(Number(cur.loyaltyPending) > 0) || !['delivered', 'return_rejected'].includes(cur.status)) return 0;
      const pts = Number(cur.loyaltyPending);
      tx.update(oRef, { loyaltyEarned: pts, loyaltyPending: 0 });
      tx.set(db.collection('users').doc(userId), { loyaltyPoints: FieldValue.increment(pts) }, { merge: true });
      tx.set(db.collection('loyaltyLedger').doc(`${d.id}_earn`), { userId, orderId: d.id, orderNumber: cur.orderNumber || '', type: 'earn', points: pts, note: `Order ${cur.orderNumber || ''}: return period ended`, createdAt: new Date().toISOString() });
      return pts;
    });
  }
  return total;
}

/** Points still waiting for their return window to end. */
export async function pendingFor(userId: string) {
  const snap = await getAdminDb().collection('orders').where('userId', '==', userId).get();
  const rows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any))
    .filter(o => Number(o.loyaltyPending) > 0 && o.loyaltyEarned === undefined && ['delivered', 'return_requested', 'return_approved', 'return_picked_up', 'return_rejected'].includes(o.status))
    .map(o => ({ orderId: o.id, orderNumber: o.orderNumber || '', points: Number(o.loyaltyPending), releaseAt: o.loyaltyReleaseAt || null, onHold: o.status.startsWith('return_') && o.status !== 'return_rejected' }));
  return { total: rows.reduce((a, r) => a + r.points, 0), rows };
}

/** A refunded return takes back the points earned on the refunded share of the order. */
export async function reverseForRefund(orderId: string, refundAmount: number): Promise<number> {
  const db = getAdminDb();
  return db.runTransaction(async tx => {
    const oRef = db.collection('orders').doc(orderId); const o: any = (await tx.get(oRef)).data();
    if (o && Number(o.loyaltyPending) > 0 && o.loyaltyEarned === undefined) { tx.update(oRef, { loyaltyPending: 0, loyaltyVoided: true }); return 0; }   // never credited: just cancel the held points
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
