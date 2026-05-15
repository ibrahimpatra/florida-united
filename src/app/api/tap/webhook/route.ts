import { NextRequest, NextResponse } from 'next/server';
import { adminGetOrderById, adminUpdateOrder, adminUpdateOrderStatus } from '@/lib/firestore-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id: tapChargeId, status, metadata } = body;
    const orderId = metadata?.orderId;
    if (!orderId) return NextResponse.json({ received: true });
    const order = await adminGetOrderById(orderId);
    if (!order) return NextResponse.json({ received: true });
    if (status === 'CAPTURED') {
      await adminUpdateOrder(orderId, { paymentStatus: 'paid', paymentReference: tapChargeId });
      await adminUpdateOrderStatus(orderId, 'confirmed', 'Payment confirmed via Tap');
    } else if (status === 'FAILED' || status === 'DECLINED') {
      await adminUpdateOrder(orderId, { paymentStatus: 'failed' });
    }
    return NextResponse.json({ received: true });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
