import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrderById, updateOrderStatus, updateOrderTracking } from '@/lib/firestore';
import { sendOrderStatusUpdate } from '@/lib/email';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await getOrderById(params.id);
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Non-admin can only see their own orders
  if (session.user.role !== 'admin' && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status, note, trackingNumber, carrier } = await req.json();
  const order = await getOrderById(params.id);
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (trackingNumber && carrier) {
    await updateOrderTracking(params.id, trackingNumber, carrier);
  } else if (status) {
    await updateOrderStatus(params.id, status, note);
    sendOrderStatusUpdate({ ...order, status }, status, note).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
