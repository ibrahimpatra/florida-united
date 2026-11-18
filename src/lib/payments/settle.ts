import { getAdminDb } from '../firebase-admin';
import { markOrderPaid, OrderError } from '../orders-server';
import { providerFor, amountOk } from './index';
import { log } from '../logger';

/**
 * Asks the order's payment provider whether it was paid and, if so, marks the order paid (idempotent).
 * Safe to call from a webhook, the browser return page, a confirm poll or the cleanup sweep.
 * The provider is asked server to server; browser parameters are only used as a hint for WHICH payment to look up.
 */
export async function settleOrderPayment(orderId: string, hint?: string): Promise<{ paid: boolean; failed?: boolean; already?: boolean; order?: any }> {
  const db = getAdminDb();
  const snap = await db.collection('orders').doc(orderId).get();
  if (!snap.exists) throw new OrderError(404, 'Order not found.', 'NOT_FOUND');
  const o: any = { id: snap.id, ...snap.data() };
  if (o.paymentStatus === 'paid') return { paid: true, already: true };
  if (o.paymentMethod !== 'card') return { paid: false };

  const p = providerFor(o.paymentProvider || 'stripe');
  if (!p || !p.configured()) { log.error('payments', 'cannot verify payment - provider not configured', { order: o.orderNumber, provider: o.paymentProvider }); return { paid: false }; }

  const v = await p.verify({ id: o.id, orderNumber: o.orderNumber, total: Number(o.total), paymentRef: o.paymentRef, stripeSessionId: o.stripeSessionId }, hint);
  if (!v.paid) return { paid: false, failed: !!v.failed };
  if (v.extra?.matches === false) { log.error('payments', 'provider says paid but the payment belongs to a different order - ignored', { order: o.orderNumber, provider: p.id }); return { paid: false }; }
  if (!amountOk(p, o, v)) { log.error('payments', 'paid amount does not match the order total - NOT marked paid, check the provider dashboard', { order: o.orderNumber, provider: p.id, expected: o.total, got: v.amount, currency: v.currency }); return { paid: false }; }

  const r = await markOrderPaid(o.id, {
    provider: p.id, paymentRef: v.ref,
    ...(p.id === 'stripe' ? { sessionId: v.ref, paymentIntent: v.extra?.paymentIntent, usdAmount: v.amount } : {}),
  });
  return { paid: true, already: r.already, order: r.order };
}
