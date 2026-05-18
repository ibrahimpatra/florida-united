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
  try {
    const body = await req.json();
    const { items, shippingAddress, subtotal, discount, shippingCost, tax, total, couponCode, notes } = body;
    const orderNumber = generateOrderNumber();
    const nowStr = new Date().toISOString();
    const db = getAdminDb();
    const batch = db.batch();
    const orderRef = db.collection('orders').doc();
    batch.set(orderRef, {
      orderNumber, userId: session.user.id, userEmail: session.user.email!, userName: session.user.name!,
      userPhone: session.user.phone || shippingAddress.phone || '',
      shippingAddress, status: 'pending', paymentStatus: 'pending', paymentMethod: 'cod', currency: 'KWD',
      items, subtotal, discount: discount || 0, shippingCost: shippingCost || 0, tax: tax || 0, total,
      couponCode: couponCode || null, notes: notes || null,
      statusHistory: [{ status: 'pending', note: 'COD order placed', createdAt: nowStr }],
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    for (const item of items) {
      batch.update(db.collection('products').doc(item.productId), { stock: FieldValue.increment(-item.quantity), totalSold: FieldValue.increment(item.quantity) });
    }
    await batch.commit();
    const fullOrder: Order = { id: orderRef.id, orderNumber, userId: session.user.id, userEmail: session.user.email!, userName: session.user.name!, userPhone: session.user.phone || '', shippingAddress, status: 'pending', paymentStatus: 'pending', paymentMethod: 'cod', currency: 'KWD', items, subtotal, discount: discount || 0, shippingCost: shippingCost || 0, tax: tax || 0, total, createdAt: nowStr, updatedAt: nowStr };
    sendOrderConfirmation(fullOrder).catch(console.error);
    sendAdminNewOrderNotification(fullOrder).catch(console.error);
    sendWhatsAppOrderConfirmation(fullOrder).catch(console.error);
    return NextResponse.json({ success: true, orderId: orderRef.id, orderNumber });
  } catch (e) { console.error('[COD]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
