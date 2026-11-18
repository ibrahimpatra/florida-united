import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetOrderById } from '@/lib/firestore-admin';
import { OrderError } from '@/lib/orders-server';
import { changeOrderStatus } from '@/lib/order-actions';

async function __GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const order = await adminGetOrderById(params.id);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role !== 'admin' && order.userId !== session.user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(order);
  } catch (err) {
    console.error('[GET /api/orders/[id]]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

async function __PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { status, note, trackingNumber, carrier } = await req.json();
    const r = await changeOrderStatus({ orderId: params.id, actor: { id: session.user.id, role: session.user.role }, status, note, trackingNumber, carrier });
    return NextResponse.json(r);
  } catch (err) {
    if (err instanceof OrderError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error('[PATCH /api/orders/[id]]', err);
    return NextResponse.json({ error: 'Could not update the order. Please try again.' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/orders/[id]', __GET);
export const PATCH = withLog('PATCH', '/api/orders/[id]', __PATCH);
