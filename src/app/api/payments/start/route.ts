import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { providerFor } from '@/lib/payments';
import { log } from '@/lib/logger';
import { failJson } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

/** Starts the online payment for one of the signed-in customer's unpaid card orders. Returns { url } to send the browser to. */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });

  const db = getAdminDb();
  const snap = await db.collection('orders').doc(String(orderId)).get();
  if (!snap.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const o: any = { id: snap.id, ...snap.data() };
  const isAdmin = String(session.user.role).toLowerCase() === 'admin';
  if (o.userId !== session.user.id && !isAdmin) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (o.paymentMethod !== 'card') return NextResponse.json({ error: 'This order is not a card order.' }, { status: 400 });
  if (o.paymentStatus === 'paid') return NextResponse.json({ error: 'This order is already paid.' }, { status: 400 });
  if (o.orderStatus === 'cancelled') return NextResponse.json({ error: 'This order was cancelled.' }, { status: 400 });

  const provider = providerFor(o.paymentProvider || 'stripe');
  if (!provider || !provider.configured()) return NextResponse.json({ error: 'Online payment is not available right now. Please contact the store.' }, { status: 503 });

  const app = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '');
  try {
    const r = await provider.start(
      { id: o.id, orderNumber: o.orderNumber, total: Number(o.total), userEmail: o.userEmail, contactEmail: o.contactEmail, userName: o.userName, phone: o.phone },
      { appUrl: app, returnUrl: `${app}/api/payments/return?orderId=${o.id}`, cancelUrl: `${app}/account/orders/${o.id}?payment=cancelled`, db },
    );
    await db.collection('orders').doc(o.id).update({
      paymentRef: r.ref, paymentProvider: provider.id,
      ...(provider.id === 'stripe' ? { stripeSessionId: r.ref } : {}),
      ...(r.extra || {}),
    });
    return NextResponse.json({ url: r.url, provider: provider.id });
  } catch (e: any) {
    log.error('payments', 'could not start payment', { order: o.orderNumber, provider: provider.id, error: e?.message });
    return failJson(session, 502, 'Could not start the payment. Please try again or choose cash on delivery.', e);
  }
}
export const POST = withLog('POST', '/api/payments/start', __POST);
