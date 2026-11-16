import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import { markOrderPaid, cancelOrder } from '@/lib/orders-server';
import { notifyOrderPlaced } from '@/lib/place-order-handler';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });

  // The signature is checked against the RAW body. Anything that fails is rejected - never trust the payload otherwise.
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(await req.text(), sig, secret); }
  catch { return NextResponse.json({ error: 'Invalid signature' }, { status: 400 }); }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.orderId;
      if (orderId && s.payment_status === 'paid') {
        const r = await markOrderPaid(orderId, {
          sessionId: s.id, paymentIntent: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id,
          usdAmount: (s.amount_total || 0) / 100,
        });
        if (!r.already) notifyOrderPlaced(r.order as any);
      }
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      // Unpaid + abandoned -> release the reserved stock.
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.orderId;
      if (orderId) {
        const snap = await getAdminDb().collection('orders').doc(orderId).get();
        const o: any = snap.data();
        if (o && o.paymentStatus !== 'paid' && o.status === 'pending' && o.stripeSessionId === s.id)
          await cancelOrder({ orderId, actor: { id: 'stripe', role: 'admin' }, note: 'Card payment expired or failed' });
      }
    } else if (event.type === 'charge.refunded') {
      const ch = event.data.object as Stripe.Charge;
      const orderId = ch.metadata?.orderId;
      if (orderId && ch.refunded) await getAdminDb().collection('orders').doc(orderId).update({ paymentStatus: 'refunded', needsRefund: false });
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[stripe webhook]', e);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 }); // Stripe will retry
  }
}
