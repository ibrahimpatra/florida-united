import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { settleOrderPayment } from '@/lib/payments/settle';
import { notifyOrderPlaced } from '@/lib/place-order-handler';

export const dynamic = 'force-dynamic';

/** Called by the success page so the order shows as paid even if the webhook is slow. Works for every provider. Idempotent. */
async function __GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orderId = req.nextUrl.searchParams.get('orderId') || '';
  try {
    const snap = await getAdminDb().collection('orders').doc(orderId).get();
    const o: any = snap.data();
    if (!snap.exists || o.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (o.paymentStatus === 'paid') return NextResponse.json({ paid: true });
    const r = await settleOrderPayment(orderId);
    if (r.paid && !r.already && r.order) notifyOrderPlaced(r.order as any);
    return NextResponse.json({ paid: r.paid });
  } catch (e) {
    log.error('payments', 'confirm crashed', { error: (e as any)?.message });
    return NextResponse.json({ paid: false });
  }
}

export const GET = withLog('GET', '/api/stripe/confirm', __GET);
