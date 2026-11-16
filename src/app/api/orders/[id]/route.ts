import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetOrderById, adminUpdateOrderStatus, adminUpdateOrderTracking } from '@/lib/firestore-admin';
import { sendOrderStatusUpdate } from '@/lib/email';
import { sendWhatsAppStatusUpdate } from '@/lib/whatsapp';
import { refundCardOrder, expireStripeSession } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import { cancelOrder, OrderError } from '@/lib/orders-server';

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
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isAdmin = session.user.role === 'admin';
  try {
    const { status, note, trackingNumber, carrier } = await req.json();

    // Cancellation (customer or admin) always goes through the transactional path:
    // restores stock + analytics exactly once, and is a safe no-op if already cancelled.
    if (status === 'cancelled') {
      const r: any = await cancelOrder({ orderId: params.id, actor: { id: session.user.id, role: session.user.role }, note });
      // Unpaid card order cancelled -> close its Stripe session so it can't be paid afterwards.
      if (!r.needsRefund && (r.order as any)?.stripeSessionId) await expireStripeSession((r.order as any).stripeSessionId);
      // Paid card order cancelled -> refund the customer automatically via Stripe.
      let refunded = false;
      if (r.needsRefund && r.order?.paymentMethod === 'card' && r.order?.stripePaymentIntent) {
        try {
          const rf = await refundCardOrder({ ...r.order, id: params.id });
          refunded = true;
          await getAdminDb().collection('orders').doc(params.id).update({ paymentStatus: 'refunded', needsRefund: false, stripeRefundId: rf.refundId });
        } catch (e: any) { console.error('[cancel refund]', e?.message || e); }
      }
      if (!r.alreadyCancelled) {
        sendOrderStatusUpdate({ ...r.order, status: 'cancelled' }, 'cancelled', note).catch(console.error);
        sendWhatsAppStatusUpdate({ ...r.order, status: 'cancelled' }, 'cancelled').catch(console.error);
      }
      return NextResponse.json({ success: true, alreadyCancelled: !!r.alreadyCancelled, needsRefund: !!r.needsRefund && !refunded, refunded });
    }

    if (!isAdmin) return NextResponse.json({ error: 'Customers can only cancel orders.' }, { status: 403 });

    const order = await adminGetOrderById(params.id);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (order.status === 'cancelled')
      return NextResponse.json({ error: 'This order is cancelled and cannot be changed.' }, { status: 400 });

    // An unpaid card order must not be prepared or shipped: stock is held, but nothing has been paid yet.
    if (order.paymentMethod === 'card' && order.paymentStatus !== 'paid' && status && status !== 'pending')
      return NextResponse.json({ error: 'This card order has not been paid yet, so it cannot be moved forward. Wait for the payment, or cancel it.' }, { status: 400 });
    if (order.paymentMethod === 'card' && order.paymentStatus !== 'paid' && (trackingNumber || carrier))
      return NextResponse.json({ error: 'This card order has not been paid yet, so it cannot be shipped.' }, { status: 400 });

    const VALID = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'return_requested', 'return_approved', 'return_rejected', 'return_picked_up', 'returned', 'refunded'];
    const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
    if (trackingNumber || carrier) {
      if (!String(trackingNumber || '').trim() || !String(carrier || '').trim())
        return NextResponse.json({ error: 'Enter both a tracking number and a carrier.' }, { status: 400 });
    } else if (!status) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    } else {
      if (!VALID.includes(status)) return NextResponse.json({ error: `"${status}" is not a valid order status.` }, { status: 400 });
      if (['returned', 'refunded'].includes(order.status) && status !== order.status)
        return NextResponse.json({ error: `A ${order.status} order cannot be changed.` }, { status: 400 });
      const from = FLOW.indexOf(order.status), to = FLOW.indexOf(status);
      if (from >= 3 && to >= 0 && to < from) // once shipped, the order cannot go back to an earlier step
        return NextResponse.json({ error: `A ${order.status.replace(/_/g, ' ')} order cannot be moved back to ${status.replace(/_/g, ' ')}.` }, { status: 400 });
      if (order.status === 'delivered' && to >= 0 && to < FLOW.length - 1)
        return NextResponse.json({ error: 'A delivered order cannot be moved back.' }, { status: 400 });
    }

    if (trackingNumber && carrier) {
      await adminUpdateOrderTracking(params.id, String(trackingNumber).trim(), String(carrier).trim());
    } else if (status) {
      await adminUpdateOrderStatus(params.id, status, note);
      sendOrderStatusUpdate({ ...order, status }, status, note).catch(console.error);
      sendWhatsAppStatusUpdate({ ...order, status }, status).catch(console.error);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof OrderError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error('[PATCH /api/orders/[id]]', err);
    return NextResponse.json({ error: 'Could not update the order. Please try again.' }, { status: 500 });
  }
}
