import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetOrderById, adminUpdateOrderStatus, adminUpdateOrderTracking } from '@/lib/firestore-admin';
import { sendOrderStatusUpdate } from '@/lib/email';
import { sendWhatsAppStatusUpdate } from '@/lib/whatsapp';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { status, note, trackingNumber, carrier } = body;
    const order = await adminGetOrderById(params.id);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Customers can only cancel their own pending/confirmed orders
    if (session.user.role !== 'admin') {
      if (order.userId !== session.user.id)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (status !== 'cancelled')
        return NextResponse.json({ error: 'Customers can only cancel orders.' }, { status: 403 });
      if (!['pending', 'confirmed'].includes(order.status))
        return NextResponse.json({ error: 'This order can no longer be cancelled. Please contact support.' }, { status: 400 });
    }

    if (trackingNumber && carrier) {
      await adminUpdateOrderTracking(params.id, trackingNumber, carrier);
    } else if (status) {
      await adminUpdateOrderStatus(params.id, status, note);
      sendOrderStatusUpdate({ ...order, status }, status, note).catch(console.error);
      sendWhatsAppStatusUpdate({ ...order, status }, status).catch(console.error);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/orders/[id]]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
