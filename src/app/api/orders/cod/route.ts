// src/app/api/orders/cod/route.ts - Cash on Delivery order creation
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createOrder } from '@/lib/firestore';
import { generateOrderNumber } from '@/lib/utils';
import { sendOrderConfirmationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { items, shippingAddress, subtotal, discount, shippingCost, tax, total, couponCode, notes } = await req.json();
    const orderNumber = generateOrderNumber();

    const orderId = await createOrder({
      orderNumber,
      userId: session.user.id,
      userEmail: session.user.email!,
      userName: session.user.name || '',
      userPhone: shippingAddress.phone,
      shippingAddress,
      status: 'pending',
      paymentStatus: 'cod_pending',
      paymentMethod: 'cod',
      currency: 'KWD',
      subtotal,
      discount: discount || 0,
      shippingCost: shippingCost || 0,
      tax: tax || 0,
      total,
      couponCode: couponCode || '',
      notes: notes || '',
      items,
      statusHistory: [
        { status: 'pending', note: 'Order placed - Cash on Delivery', createdAt: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    sendOrderConfirmationEmail(session.user.email!, session.user.name || '', orderNumber, items, total).catch(console.error);

    return NextResponse.json({ success: true, orderId, orderNumber });
  } catch (err) {
    console.error('COD order error:', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
