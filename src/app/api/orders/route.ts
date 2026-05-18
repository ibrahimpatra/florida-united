import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetAllOrders, adminGetOrderById } from '@/lib/firestore-admin';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendOrderConfirmation, sendAdminNewOrderNotification } from '@/lib/email';
import { sendWhatsAppOrderConfirmation } from '@/lib/whatsapp';
import { generateOrderNumber } from '@/lib/utils';
import type { Order } from '@/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    if (session.user.role === 'admin') {
      const status = searchParams.get('status') || 'all';
      const page   = parseInt(searchParams.get('page') || '1');
      return NextResponse.json(await adminGetAllOrders(status, page));
    }
    // Customer: fetch their own orders
    const db = getAdminDb();
    const snap = await db.collection('orders')
      .where('userId', '==', session.user.id)
      .orderBy('createdAt', 'desc')
      .get();
    const items = snap.docs.map(d => {
      const data = d.data();
      // Convert Timestamps
      const convert = (v: unknown): unknown =>
        v && typeof v === 'object' && 'toDate' in (v as object)
          ? (v as { toDate: () => Date }).toDate().toISOString()
          : Array.isArray(v) ? v.map(convert)
          : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string,unknown>).map(([k,val]) => [k, convert(val)]))
          : v;
      return { id: d.id, ...convert(data) as Record<string,unknown> };
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[GET /api/orders]', err);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { items, shippingAddress, paymentMethod, subtotal, discount, shippingCost, tax, total, couponCode, notes, stripePaymentId } = body;
    if (!items?.length || !shippingAddress)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    const orderNumber = generateOrderNumber();
    const nowStr = new Date().toISOString();

    const orderData = {
      orderNumber,
      userId:        session.user.id,
      userEmail:     session.user.email!,
      userName:      session.user.name!,
      userPhone:     session.user.phone || shippingAddress.phone || '',
      shippingAddress,
      status:        'pending',
      paymentStatus: stripePaymentId ? 'paid' : 'pending',
      paymentMethod: paymentMethod || 'cod',
      currency:      'KWD',
      items,
      subtotal,
      discount:      discount    || 0,
      shippingCost:  shippingCost || 0,
      tax:           tax         || 0,
      total,
      couponCode:    couponCode  || null,
      notes:         notes       || null,
      stripePaymentId: stripePaymentId || null,
      statusHistory: [{ status: 'pending', note: 'Order placed', createdAt: nowStr }],
      createdAt:     FieldValue.serverTimestamp(),
      updatedAt:     FieldValue.serverTimestamp(),
    };

    // Update stock atomically
    const db = getAdminDb();
    const batch = db.batch();
    const orderRef = db.collection('orders').doc();
    batch.set(orderRef, orderData);
    for (const item of items) {
      batch.update(db.collection('products').doc(item.productId), {
        stock:     FieldValue.increment(-item.quantity),
        totalSold: FieldValue.increment(item.quantity),
      });
    }
    await batch.commit();

    const fullOrder: Order = {
      ...orderData,
      id:        orderRef.id,
      createdAt: nowStr,
      updatedAt: nowStr,
      couponCode:     couponCode || undefined,
      notes:          notes      || undefined,
      stripePaymentId: stripePaymentId || undefined,
    } as Order;

    sendOrderConfirmation(fullOrder).catch(console.error);
    sendAdminNewOrderNotification(fullOrder).catch(console.error);
    sendWhatsAppOrderConfirmation(fullOrder).catch(console.error);

    return NextResponse.json({ success: true, orderId: orderRef.id, orderNumber });
  } catch (err) {
    console.error('[POST /api/orders]', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
