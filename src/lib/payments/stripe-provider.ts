import type { PaymentProvider } from './types';
import { getStripe, getUsdRate, kwdToUsdCents } from '../stripe';

/** Stripe Checkout, charged in USD at the store's KWD->USD rate. Env: STRIPE_SECRET_KEY (+ STRIPE_WEBHOOK_SECRET). */
export const stripeProvider: PaymentProvider = {
  id: 'stripe', name: 'Stripe', currency: 'USD',
  configured: () => !!process.env.STRIPE_SECRET_KEY,
  async start(o, ctx) {
    const stripe = getStripe();
    if (o.stripeSessionId) { // re-use a still-open session instead of creating duplicates
      try {
        const old = await stripe.checkout.sessions.retrieve(o.stripeSessionId);
        if (old.status === 'open' && old.url) return { url: old.url, ref: old.id };
      } catch {}
    }
    const rate = await getUsdRate(ctx.db);
    const cents = kwdToUsdCents(o.total, rate);
    if (cents < 50) throw new Error('The order total is below the minimum card payment amount.');
    const s = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name: `Order ${o.orderNumber}`, description: `KWD ${o.total.toFixed(3)} at 1 KWD = ${rate} USD` } } }],
      customer_email: o.contactEmail || o.userEmail || undefined, client_reference_id: o.id,
      metadata: { orderId: o.id, orderNumber: o.orderNumber }, payment_intent_data: { metadata: { orderId: o.id, orderNumber: o.orderNumber } },
      success_url: `${ctx.appUrl}/checkout/success?orderId=${o.id}&n=${encodeURIComponent(o.orderNumber)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: ctx.cancelUrl, expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });
    return { url: s.url!, ref: s.id, extra: { stripeSessionId: s.id, usdRate: rate, usdAmount: cents / 100 } };
  },
  async verify(o) {
    if (!o.stripeSessionId) return { paid: false };
    const s = await getStripe().checkout.sessions.retrieve(o.stripeSessionId);
    return {
      paid: s.payment_status === 'paid', failed: s.status === 'expired', ref: s.id, currency: 'USD', amount: (s.amount_total || 0) / 100,
      extra: { matches: s.metadata?.orderId === o.id, paymentIntent: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id },
    };
  },
};
