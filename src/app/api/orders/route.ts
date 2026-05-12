import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createOrder, getUserOrders, getAllOrders } from '@/lib/firestore';
import { sendOrderConfirmation, sendAdminNewOrderNotification } from '@/lib/email';
import { generateOrderNumber } from '@/lib/utils';
import type { Order } from '@/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  if (session.user.role === 'admin') {
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const result = await getAllOrders(status, page);
    return NextResponse.json(result);
  }

  const orders = await getUserOrders(session.user.id);
  return NextResponse.json({ items: orders });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { items, shippingAddress, paymentMethod, subtotal, discount, shippingCost, tax, total, couponCode, notes, stripePaymentId } = body;

    if (!items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const orderNumber = generateOrderNumber();
    const now = new Date().toISOString();

    const order: Omit<Order, 'id'> = {
      orderNumber,
      userId: session.user.id,
      userEmail: session.user.email!,
      userName: session.user.name!,
      shippingAddress,
      status: 'pending',
      paymentStatus: stripePaymentId ? 'paid' : 'pending',
      paymentMethod: paymentMethod || 'tap',
      currency: 'KWD',
      stripePaymentId: stripePaymentId || undefined,
      items,
      subtotal,
      discount: discount || 0,
      shippingCost: shippingCost || 0,
      tax: tax || 0,
      total,
      couponCode: couponCode || undefined,
      notes: notes || undefined,
      trackingNumber: undefined,
      shippingCarrier: undefined,
      statusHistory: [{ status: 'pending', note: 'Order placed', createdAt: now }],
      createdAt: now,
      updatedAt: now,
    };

    const orderId = await createOrder(order);
    const fullOrder = { ...order, id: orderId };

    // Send emails (non-blocking)
    sendOrderConfirmation(fullOrder as Order).catch(console.error);
    sendAdminNewOrderNotification(fullOrder as Order).catch(console.error);

    return NextResponse.json({ success: true, orderId, orderNumber });
  } catch (err) {
    console.error('Order creation error:', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
