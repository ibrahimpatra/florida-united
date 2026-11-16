import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { markOrderPaid } from '@/lib/orders-server';
import { notifyOrderPlaced } from '@/lib/place-order-handler';

export const dynamic = 'force-dynamic';

/** Called by the success page so the order shows as paid even if the webhook is slow. Idempotent. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orderId = req.nextUrl.searchParams.get('orderId') || '';
  try {
    const snap = await getAdminDb().collection('orders').doc(orderId).get();
    const o: any = snap.data();
    if (!snap.exists || o.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (o.paymentStatus === 'paid') return NextResponse.json({ paid: true });
    if (!o.stripeSessionId) return NextResponse.json({ paid: false });
    const s = await getStripe().checkout.sessions.retrieve(o.stripeSessionId);
    if (s.payment_status === 'paid' && s.metadata?.orderId === orderId) {
      const r = await markOrderPaid(orderId, { sessionId: s.id, paymentIntent: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id, usdAmount: (s.amount_total || 0) / 100 });
      if (!r.already) notifyOrderPlaced(r.order as any);
      return NextResponse.json({ paid: true });
    }
    return NextResponse.json({ paid: false });
  } catch (e) {
    console.error('[stripe confirm]', e);
    return NextResponse.json({ paid: false });
  }
}
