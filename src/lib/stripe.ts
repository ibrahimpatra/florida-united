import Stripe from 'stripe';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';

export const DEFAULT_USD_RATE = 3.25; // USD per 1 KWD, used only until the admin sets a rate

export const cardEnabled = () => !!process.env.STRIPE_SECRET_KEY;

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return (_stripe ??= new Stripe(key));
}

/** USD per 1 KWD. Admin > Settings (config/storeSettings.usdRate) wins, then env USD_RATE, then the default. */
export async function getUsdRate(db: Firestore = getAdminDb()): Promise<number> {
  try {
    const s = await db.doc('config/storeSettings').get();
    const r = Number((s.data() as any)?.usdRate);
    if (Number.isFinite(r) && r > 0) return r;
  } catch {}
  const env = Number(process.env.USD_RATE);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_USD_RATE;
}

export const kwdToUsdCents = (kwd: number, rate: number) => Math.round(Number(kwd) * rate * 100);

/**
 * Refund a Stripe-paid order. `amountKwd` omitted = full refund. The USD amount is the same share of the
 * originally charged USD, so the customer gets back exactly the proportion they are owed.
 */
export async function refundCardOrder(order: any, amountKwd?: number): Promise<{ refundId: string; usd: number }> {
  const pi = order.stripePaymentIntent;
  if (!pi) throw new Error('This order has no Stripe payment to refund.');
  const paidCents = Math.round(Number(order.usdAmount) * 100);
  const share = amountKwd === undefined ? 1 : Math.min(1, Math.max(0, amountKwd / Number(order.total)));
  const cents = share >= 1 ? paidCents : Math.round(paidCents * share);
  if (cents < 1) throw new Error('Refund amount is too small.');
  const refund = await getStripe().refunds.create(
    { payment_intent: pi, amount: cents, metadata: { orderId: order.id, orderNumber: order.orderNumber } },
    { idempotencyKey: `refund_${order.id}_${cents}` });
  return { refundId: refund.id, usd: cents / 100 };
}

/** Best effort: close an unpaid Checkout Session so the customer can no longer pay for a cancelled order. */
export async function expireStripeSession(sessionId: string) {
  try { await getStripe().checkout.sessions.expire(sessionId); } catch { /* already expired / paid / not found */ }
}
