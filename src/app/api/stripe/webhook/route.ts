import { NextRequest, NextResponse } from 'next/server';
import { adminGetOrderByNumber, adminUpdateOrder, adminUpdateOrderStatus } from '@/lib/firestore-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;
    if (type === 'payment_intent.succeeded') {
      const pi = data.object;
      const orderNumber = pi.metadata?.orderNumber;
      if (orderNumber) {
        const order = await adminGetOrderByNumber(orderNumber);
        if (order) {
          await adminUpdateOrder(order.id, { paymentStatus: 'paid', paymentReference: pi.id });
          await adminUpdateOrderStatus(order.id, 'confirmed', 'Payment confirmed via Stripe');
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) { return NextResponse.json({ error: 'Webhook failed' }, { status: 500 }); }
}
