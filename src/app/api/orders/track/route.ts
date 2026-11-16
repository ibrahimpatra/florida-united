import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const iso = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v || null);
const digits = (s: any) => String(s || '').replace(/\D/g, '').replace(/^965/, '');

/**
 * Public order tracking. The order number alone is not enough: the caller must also give the
 * email or phone used on the order. Only non-sensitive fields are returned (no address).
 */
export async function POST(req: NextRequest) {
  try {
    const { orderNumber, contact } = await req.json();
    const no = String(orderNumber || '').trim().toUpperCase();
    const c = String(contact || '').trim().toLowerCase();
    if (!no || !c || no.length > 40 || c.length > 120) return NextResponse.json({ error: 'Missing details' }, { status: 400 });

    const db = getAdminDb();
    const num = await db.collection('orderNumbers').doc(no).get();
    const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!num.exists) return notFound();
    const snap = await db.collection('orders').doc(String((num.data() as any).orderId)).get();
    if (!snap.exists) return notFound();
    const o = snap.data() as any;

    const emailOk = c.includes('@') && [o.userEmail, o.contactEmail].some((e: any) => String(e || '').toLowerCase() === c);
    const phoneOk = !c.includes('@') && digits(c).length >= 6 && [digits(o.userPhone), digits(o.shippingAddress?.phone)].includes(digits(c));
    if (!emailOk && !phoneOk) return notFound();

    return NextResponse.json({
      orderNumber: o.orderNumber, status: o.status, total: o.total, createdAt: iso(o.createdAt),
      trackingNumber: o.trackingNumber || null, shippingCarrier: o.shippingCarrier || null,
      statusHistory: (o.statusHistory || []).map((h: any) => ({ status: h.status, note: h.note || '', createdAt: iso(h.createdAt) })),
      items: (o.items || []).map((i: any) => ({ productName: i.productName, productNameAr: i.productNameAr || null, productSku: i.productSku, quantity: i.quantity, total: i.total, image: i.image || '' })),
    });
  } catch (e) {
    console.error('track error', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
