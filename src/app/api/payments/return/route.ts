import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { settleOrderPayment } from '@/lib/payments/settle';
import { notifyOrderPlaced } from '@/lib/place-order-handler';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Where the payment provider sends the customer back to. The query string is only a hint:
 * we ask the provider server to server before anything is marked paid.
 */
async function __GET(req: NextRequest) {
  const u = new URL(req.url);
  const app = (process.env.NEXT_PUBLIC_APP_URL || u.origin).replace(/\/$/, '');
  const orderId = u.searchParams.get('orderId') || '';
  const hint = u.searchParams.get('tap_id') || u.searchParams.get('paymentId') || u.searchParams.get('Id') || undefined;
  if (!orderId) return NextResponse.redirect(`${app}/account/orders`);
  try {
    const r = await settleOrderPayment(orderId, hint);
    if (r.paid) {
      if (!r.already && r.order) { try { await notifyOrderPlaced(r.order); } catch (e: any) { log.error('payments', 'paid but notification failed', { orderId, error: e?.message }); } }
      return NextResponse.redirect(`${app}/checkout/success?orderId=${orderId}${r.order?.orderNumber ? `&n=${encodeURIComponent(r.order.orderNumber)}` : ''}`);
    }
  } catch (e: any) { log.error('payments', 'return handler failed', { orderId, error: e?.message }); }
  return NextResponse.redirect(`${app}/account/orders/${orderId}?payment=failed`);
}
export const GET = withLog('GET', '/api/payments/return', __GET);
