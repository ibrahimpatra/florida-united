import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { placeOrder, OrderError } from '@/lib/orders-server';
import { sendOrderConfirmation, sendAdminNewOrderNotification } from '@/lib/email';
import { sendWhatsAppOrderConfirmation } from '@/lib/whatsapp';
import type { Order } from '@/types';

/**
 * Customer email + admin alert + WhatsApp for a new order. Cash-on-delivery orders send these straight away;
 * card orders send them only once the payment is confirmed (webhook / success page), never for an unpaid order.
 */
export function notifyOrderPlaced(o: Order) {
  const to = (o as any).contactEmail || o.userEmail;
  sendOrderConfirmation({ ...o, userEmail: to }).catch(console.error);
  sendAdminNewOrderNotification(o).catch(console.error);
  sendWhatsAppOrderConfirmation(o).catch(console.error);
}

/** Shared by POST /api/orders and POST /api/orders/cod. ALWAYS answers JSON. */
export async function placeOrderHandler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Please sign in to place an order.', code: 'UNAUTHORIZED' }, { status: 401 });

    let body: any;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid request. Please refresh the page and try again.', code: 'BAD_JSON' }, { status: 400 }); }

    const result: any = await placeOrder({
      userId: session.user.id, userEmail: session.user.email || '', userName: session.user.name || '',
      idempotencyKey: body.idempotencyKey, contactEmail: body.contactEmail,
      // ONLY ids + quantities are read from the browser. Prices/stock/shipping/coupon are re-derived server-side.
      items: Array.isArray(body.items) ? body.items.map((i: any) => ({
        productId: i.productId, quantity: i.quantity, variantId: i.variantId, variantName: i.variantName,
      })) : [],
      shippingAddress: body.shippingAddress,
      shippingRateId: body.shippingRateId,
      couponCode: body.couponCode, notes: body.notes,
      paymentMethod: body.paymentMethod === 'card' || body.paymentMethod === 'tap' ? 'card' : 'cod',
    });

    if (!result.duplicate && result.order) {
      if ((result.order as Order).paymentMethod !== 'card') notifyOrderPlaced(result.order as Order);
    }
    return NextResponse.json({
      success: true, orderId: result.orderId, orderNumber: result.orderNumber,
      total: result.total, duplicate: !!result.duplicate,
    });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error('[placeOrder]', e);
    return NextResponse.json(
      { error: 'We could not place your order. Nothing was saved or charged — please try again in a moment.', code: 'SERVER' },
      { status: 500 });
  }
}
