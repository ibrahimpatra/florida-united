import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { log } from '@/lib/logger';
import { authOptions } from '@/lib/auth';
import { placeOrder, OrderError, sweepStaleCardOrders } from '@/lib/orders-server';
import { sendOrderConfirmation, sendAdminNewOrderNotification } from '@/lib/email';
import { sendWhatsAppOrderConfirmation } from '@/lib/whatsapp';
import type { Order } from '@/types';

/**
 * Customer email + admin alert + WhatsApp for a new order. Cash-on-delivery orders send these straight away;
 * card orders send them only once the payment is confirmed (webhook / success page), never for an unpaid order.
 */
export function notifyOrderPlaced(o: Order) {
  const to = (o as any).contactEmail || o.userEmail;
  const ctx = { order: (o as any).orderNumber };
  sendOrderConfirmation({ ...o, userEmail: to }).catch(e => log.error('email', 'order confirmation to customer FAILED (check EMAIL_* settings)', { ...ctx, to, error: e?.message }));
  sendAdminNewOrderNotification(o).catch(e => log.error('email', 'new-order alert to admin FAILED', { ...ctx, error: e?.message }));
  import('@/lib/notifications').then(m => m.notifyNewOrder(o)).catch(() => {});
  sendWhatsAppOrderConfirmation(o).catch(e => log.error('whatsapp', 'order WhatsApp FAILED', { ...ctx, error: e?.message }));
}

/** Shared by POST /api/orders and POST /api/orders/cod. ALWAYS answers JSON. */
export async function placeOrderHandler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Please sign in to place an order.', code: 'UNAUTHORIZED' }, { status: 401 });

    await sweepStaleCardOrders(); // frees stock held by abandoned card checkouts (see orders-server)

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
      redeemPoints: Math.max(0, Math.floor(Number(body.redeemPoints) || 0)),
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
    if (e instanceof OrderError) { log.warn('order', `order rejected: ${e.code} - ${e.message}`); return NextResponse.json({ error: e.message, code: e.code }, { status: e.status }); }
    log.error('order', 'placeOrder crashed - nothing was saved', { error: (e as any)?.message, stack: String((e as any)?.stack || '').split('\n').slice(0, 5) });
    return NextResponse.json(
      { error: 'We could not place your order. Nothing was saved or charged — please try again in a moment.', code: 'SERVER' },
      { status: 500 });
  }
}
