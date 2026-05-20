import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateOrderNumber } from '@/lib/utils';
import { sendOrderConfirmation, sendAdminNewOrderNotification } from '@/lib/email';
import { sendWhatsAppOrderConfirmation } from '@/lib/whatsapp';
import type { Order } from '@/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    idempotencyKey,
    items, shippingAddress, subtotal, discount, shippingCost, tax, total,
    couponCode, notes, paymentMethod, paymentStatus,
  } = body;

  if (!items?.length || !shippingAddress) {
    return NextResponse.json({ error: 'Missing required fields: items and shippingAddress are required.' }, { status: 400 });
  }

  const db = getAdminDb();

  // ── Idempotency: if we already processed this key, return the existing order ──
  if (idempotencyKey) {
    try {
      const existing = await db.collection('orders')
        .where('userId', '==', session.user.id)
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();

      if (!existing.empty) {
        const doc = existing.docs[0];
        return NextResponse.json({ success: true, orderId: doc.id, orderNumber: doc.data().orderNumber, duplicate: true });
      }
    } catch (e) {
      // Idempotency check failed (e.g. index not ready) — proceed normally; worst case is a dup
      console.warn('[COD] idempotency check failed:', e);
    }
  }

  try {
    const orderNumber = generateOrderNumber();
    const nowStr = new Date().toISOString();
    const batch = db.batch();
    const orderRef = db.collection('orders').doc();

    batch.set(orderRef, {
      orderNumber,
      idempotencyKey: idempotencyKey || null,
      userId: session.user.id,
      userEmail: session.user.email!,
      userName: session.user.name!,
      userPhone: session.user.phone || shippingAddress.phone || '',
      shippingAddress,
      status: 'pending',
      paymentStatus: paymentStatus || 'pending',
      paymentMethod: paymentMethod || 'cod',
      currency: 'KWD',
      items,
      subtotal,
      discount: discount || 0,
      shippingCost: shippingCost || 0,
      tax: tax || 0,
      total,
      couponCode: couponCode || null,
      notes: notes || null,
      statusHistory: [{ status: 'pending', note: 'Order placed', createdAt: nowStr }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const item of items) {
      batch.update(db.collection('products').doc(item.productId), {
        stock: FieldValue.increment(-item.quantity),
        totalSold: FieldValue.increment(item.quantity),
      });
    }

    await batch.commit();

    const fullOrder: Order = {
      id: orderRef.id, orderNumber,
      userId: session.user.id, userEmail: session.user.email!, userName: session.user.name!,
      userPhone: session.user.phone || '', shippingAddress,
      status: 'pending', paymentStatus: paymentStatus || 'pending',
      paymentMethod: paymentMethod || 'cod', currency: 'KWD',
      items, subtotal, discount: discount || 0, shippingCost: shippingCost || 0,
      tax: tax || 0, total, createdAt: nowStr, updatedAt: nowStr,
    };

    sendOrderConfirmation(fullOrder).catch(console.error);
    sendAdminNewOrderNotification(fullOrder).catch(console.error);
    sendWhatsAppOrderConfirmation(fullOrder).catch(console.error);

    return NextResponse.json({ success: true, orderId: orderRef.id, orderNumber });
  } catch (e) {
    console.error('[COD]', e);
    return NextResponse.json({ error: 'Failed to place order. Please try again.' }, { status: 500 });
  }
}
