import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminCreateReturnRequest, adminGetUserReturns, adminGetAllReturns, adminUpdateReturnStatus, adminGetOrderById } from '@/lib/firestore-admin';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (session.user.role === 'admin') return NextResponse.json(await adminGetAllReturns());
    return NextResponse.json(await adminGetUserReturns(session.user.id));
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { orderId, reason, description } = await req.json();
    const order = await adminGetOrderById(orderId);
    if (!order || order.userId !== session.user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const id = await adminCreateReturnRequest({ orderId, orderNumber: order.orderNumber, userId: session.user.id, userName: session.user.name!, userEmail: session.user.email!, reason, description, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true, id });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, status, note } = await req.json();
    await adminUpdateReturnStatus(id, status, note);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
