import { reportIssue } from '@/lib/issues';
import { getBrand } from '@/lib/brand-server';
import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { FieldValue } from 'firebase-admin/firestore';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { cardEnabled, getStripe, getUsdRate, kwdToUsdCents } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Starts (or restarts) card payment for a saved order. The amount is ALWAYS computed here from the
 * order stored in Firestore - nothing about money is read from the browser.
 */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!cardEnabled()) return NextResponse.json({ error: 'Card payment is not available right now.' }, { status: 503 });

  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'Missing order.' }, { status: 400 });
    const db = getAdminDb();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists || (snap.data() as any).userId !== session.user.id) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    const o: any = { id: snap.id, ...snap.data() };
    if (o.paymentMethod !== 'card') return NextResponse.json({ error: 'This order is not a card order.' }, { status: 400 });
    if (o.paymentStatus === 'paid') return NextResponse.json({ error: 'This order is already paid.' }, { status: 400 });
    if (o.status !== 'pending') return NextResponse.json({ error: 'This order can no longer be paid.' }, { status: 400 });

    const stripe = getStripe();

    // Re-use a still-open session instead of creating duplicates.
    if (o.stripeSessionId) {
      try {
        const old = await stripe.checkout.sessions.retrieve(o.stripeSessionId);
        if (old.status === 'open' && old.url) return NextResponse.json({ url: old.url });
        if (old.payment_status === 'paid') return NextResponse.json({ error: 'This order is already paid.' }, { status: 400 });
      } catch (e) { reportIssue('stripe checkout: reuse of existing session failed', e, { status: 502 }); }
    }

    const rate = await getUsdRate(db);
    const cents = kwdToUsdCents(o.total, rate);
    if (cents < 50) return NextResponse.json({ error: 'The order total is below the minimum card payment amount.' }, { status: 400 });

    const app = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '');
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd', unit_amount: cents,
          product_data: { name: `Order ${o.orderNumber}`, description: `${(await getBrand()).fullName} - KWD ${Number(o.total).toFixed(3)} at 1 KWD = ${rate} USD` },
        },
      }],
      customer_email: o.userEmail || session.user.email || undefined,
      client_reference_id: o.id,
      metadata: { orderId: o.id, orderNumber: o.orderNumber },
      payment_intent_data: { metadata: { orderId: o.id, orderNumber: o.orderNumber } },
      success_url: `${app}/checkout/success?orderId=${o.id}&n=${encodeURIComponent(o.orderNumber)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${app}/account/orders/${o.id}?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });
    await ref.update({ stripeSessionId: checkout.id, usdRate: rate, usdAmount: cents / 100, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ url: checkout.url });
  } catch (e: any) {
    console.error('[stripe checkout]', e?.message || e);
    return NextResponse.json({ error: 'We could not start the card payment. Please try again.' }, { status: 502 });
  }
}

export const POST = withLog('POST', '/api/stripe/checkout', __POST);
