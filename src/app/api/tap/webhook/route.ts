// src/app/api/tap/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrder } from '@/lib/firestore';
import { sendOrderConfirmationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id: chargeId, status, metadata } = body;
    if (!metadata?.orderId) return NextResponse.json({ received: true });

    const order = await getOrderById(metadata.orderId);
    if (!order) return NextResponse.json({ received: true });

    if (status === 'CAPTURED') {
      await updateOrder(order.id, {
        paymentStatus: 'paid',
        status: 'confirmed',
        tapChargeId: chargeId,
        updatedAt: new Date().toISOString(),
        statusHistory: [
          ...order.statusHistory,
          { status: 'confirmed', note: `TAP payment captured (${chargeId})`, createdAt: new Date().toISOString() },
        ],
      });
      sendOrderConfirmationEmail(order.userEmail, order.userName, order.orderNumber, order.items, order.total).catch(console.error);
    } else if (['FAILED','DECLINED','CANCELLED'].includes(status)) {
      await updateOrder(order.id, {
        paymentStatus: 'failed',
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
        statusHistory: [
          ...order.statusHistory,
          { status: 'cancelled', note: `TAP payment ${status.toLowerCase()}`, createdAt: new Date().toISOString() },
        ],
      });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('TAP webhook error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
