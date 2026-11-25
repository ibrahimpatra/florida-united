/**
 * The ONE place that changes an order's status. Used by the admin order page (PATCH /api/orders/[id])
 * and by the AI agent, so both follow identical rules: cancel restores stock and refunds paid card orders,
 * unpaid card orders cannot be shipped, a shipped order cannot go back, customers and the customer
 * are notified by email and WhatsApp.
 */
import { adminGetOrderById, adminUpdateOrderStatus, adminUpdateOrderTracking } from './firestore-admin';
import { notifyOrderStatus } from '@/lib/notifications';
import { sendOrderStatusUpdate } from './email';
import { sendWhatsAppStatusUpdate } from './whatsapp';
import { refundCardOrder, expireStripeSession } from './stripe';
import { getAdminDb } from './firebase-admin';
import { cancelOrder, OrderError } from './orders-server';
import { log } from './logger';
import { awardForDelivered } from './loyalty';
import { holdRevenue, applyRefund } from './revenue';
import { nextSteps } from './order-flow';

export const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'return_requested', 'return_approved', 'return_rejected', 'return_picked_up', 'returned', 'refunded'];
const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
const bad = (m: string, code = 'BAD_STATUS') => new OrderError(400, m, code);

export interface ChangeInput {
  orderId: string; actor: { id: string; role?: string };
  status?: string; note?: string; trackingNumber?: string; carrier?: string;
}

export async function changeOrderStatus(i: ChangeInput) {
  const isAdmin = String(i.actor.role).toLowerCase() === 'admin';
  const { status, note, trackingNumber, carrier } = i;

  // Cancellation (customer or admin) always goes through the transactional path: stock + analytics restored once.
  if (status === 'cancelled') {
    const r: any = await cancelOrder({ orderId: i.orderId, actor: { id: i.actor.id, role: i.actor.role } as any, note });
    if (!r.needsRefund && r.order?.stripeSessionId) await expireStripeSession(r.order.stripeSessionId);
    let refunded = false;
    if (r.needsRefund && r.order?.paymentMethod === 'card' && r.order?.stripePaymentIntent) {
      try {
        const rf = await refundCardOrder({ ...r.order, id: i.orderId });
        refunded = true;
        await getAdminDb().collection('orders').doc(i.orderId).update({ paymentStatus: 'refunded', needsRefund: false, stripeRefundId: rf.refundId });
      } catch (e: any) { log.error('orders', 'automatic card refund FAILED - refund it manually in Stripe', { order: r.order?.orderNumber, error: e?.message }); }
    }
    if (!r.alreadyCancelled) {
      notifyOrderStatus({ ...r.order, id: i.orderId }, 'cancelled');
      sendOrderStatusUpdate({ ...r.order, status: 'cancelled' }, 'cancelled', note).catch(e => log.error('email', 'cancel email failed', { error: e?.message }));
      sendWhatsAppStatusUpdate({ ...r.order, status: 'cancelled' }, 'cancelled').catch(e => log.error('whatsapp', 'cancel message failed', { error: e?.message }));
    }
    return { success: true, orderNumber: r.order?.orderNumber as string | undefined, alreadyCancelled: !!r.alreadyCancelled, needsRefund: !!r.needsRefund && !refunded, refunded };
  }

  if (!isAdmin) throw new OrderError(403, 'Customers can only cancel orders.', 'FORBIDDEN');

  const order: any = await adminGetOrderById(i.orderId);
  if (!order) throw new OrderError(404, 'Order not found.', 'NOT_FOUND');
  if (order.status === 'cancelled') throw bad('This order is cancelled and cannot be changed.', 'LOCKED');

  // An unpaid card order must not be prepared or shipped: stock is held, but nothing has been paid yet.
  if (order.paymentMethod === 'card' && order.paymentStatus !== 'paid' && status && status !== 'pending')
    throw bad('This card order has not been paid yet, so it cannot be moved forward. Wait for the payment, or cancel it.', 'UNPAID');
  if (order.paymentMethod === 'card' && order.paymentStatus !== 'paid' && (trackingNumber || carrier))
    throw bad('This card order has not been paid yet, so it cannot be shipped.', 'UNPAID');

  if (trackingNumber || carrier) {
    if (!['processing', 'shipped'].includes(order.status)) throw bad('Tracking can only be added while the order is being processed or shipped.');
    if (!String(trackingNumber || '').trim() || !String(carrier || '').trim()) throw bad('Enter both a tracking number and a carrier.');
  } else if (!status) {
    throw bad('Nothing to update.');
  } else {
    if (!VALID_STATUSES.includes(status)) throw bad(`"${status}" is not a valid order status.`);
    if (status !== order.status && !nextSteps(order.status).includes(status)) {
      const steps = nextSteps(order.status).map(x => x.replace(/_/g, ' '));
      throw bad(steps.length ? `A ${order.status.replace(/_/g, ' ')} order can only move to: ${steps.join(' or ')}.` : `A ${order.status.replace(/_/g, ' ')} order cannot be changed.`);
    }
    if (status === 'shipped' && !order.trackingNumber) throw bad('Enter the carrier and tracking number to ship this order.');
  }

  if (trackingNumber && carrier) {
    await adminUpdateOrderTracking(i.orderId, String(trackingNumber).trim(), String(carrier).trim());
    if (order.status !== 'shipped') {
      notifyOrderStatus(order, 'shipped');
      sendOrderStatusUpdate({ ...order, status: 'shipped' }, 'shipped', note).catch(e => log.error('email', 'status email failed', { order: order.orderNumber, error: e?.message }));
      sendWhatsAppStatusUpdate({ ...order, status: 'shipped' }, 'shipped').catch(e => log.error('whatsapp', 'status message failed', { order: order.orderNumber, error: e?.message }));
    }
    return { success: true, orderNumber: order.orderNumber as string, status: 'shipped' };
  }
  await adminUpdateOrderStatus(i.orderId, status!, note);
  if (status === 'delivered') await holdRevenue(i.orderId).catch(e => log.error('orders', 'could not hold revenue', { order: order.orderNumber, error: e?.message }));
  if (status === 'refunded') {   // refund given through the status flow: use the amount on the return request, else the whole order
    try {
      const rr = await getAdminDb().collection('returnRequests').where('orderId', '==', i.orderId).get();
      const amt = rr.docs.map(d => d.data() as any).filter(r => r.refundAmount !== undefined).map(r => Number(r.refundAmount))[0];
      await applyRefund(i.orderId, Number.isFinite(amt) ? amt : Number(order.total));
    } catch (e: any) { log.error('orders', 'could not book refund in revenue', { order: order.orderNumber, error: e?.message }); }
  }
  if (status === 'delivered') await awardForDelivered(i.orderId).catch(e => log.error('loyalty', 'could not award points', { order: order.orderNumber, error: e?.message }));
  notifyOrderStatus(order, status!);
  sendOrderStatusUpdate({ ...order, status }, status!, note).catch(e => log.error('email', 'status email failed', { order: order.orderNumber, error: e?.message }));
  sendWhatsAppStatusUpdate({ ...order, status }, status!).catch(e => log.error('whatsapp', 'status message failed', { order: order.orderNumber, error: e?.message }));
  return { success: true, orderNumber: order.orderNumber as string, status: status! };
}
