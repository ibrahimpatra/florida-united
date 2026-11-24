import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { FieldValue } from 'firebase-admin/firestore';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { restockItems } from '@/lib/orders-server';
import { refundCardOrder } from '@/lib/stripe';
import { returnWindowDays, deliveredAtOf, isInReturnWindow } from '@/lib/returns';
import { adminGetUserReturns, adminGetAllReturns, adminGetOrderById } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';
const OPEN = ['pending', 'photo_submitted', 'approved'];
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const items = String(session.user.role).toLowerCase() === 'admin' ? await adminGetAllReturns() : await adminGetUserReturns(session.user.id);
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { console.error('[GET returns]', e); return NextResponse.json({ error: 'Could not load returns' }, { status: 500 }); }
}

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { orderId, reason, description, images, selectedProductIds } = await req.json();
    if (!orderId || !String(reason || '').trim()) return NextResponse.json({ error: 'Please choose a reason for the return.' }, { status: 400 });

    const order: any = await adminGetOrderById(orderId);
    if (!order || order.userId !== session.user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'delivered')
      return NextResponse.json({ error: 'Returns can only be requested for delivered orders.' }, { status: 400 });

    const db = getAdminDb();
    const windowDays = returnWindowDays(((await db.doc('config/storeSettings').get()).data() as any)?.defaultReturnDays);
    // delivery date unknown (very old order): fall back to the last update so the window still ends
    const probe = deliveredAtOf(order) ? order : { ...order, deliveredAt: order.updatedAt || order.createdAt };
    if (!isInReturnWindow(probe, windowDays))
      return NextResponse.json({ error: `The ${windowDays}-day return window for this order has ended.` }, { status: 400 });

    const existing = await db.collection('returnRequests').where('orderId', '==', orderId).get();
    if (existing.docs.some(d => OPEN.includes((d.data() as any).status)))
      return NextResponse.json({ error: 'A return request for this order is already open.' }, { status: 409 });

    const wanted: string[] | null = Array.isArray(selectedProductIds) && selectedProductIds.length ? selectedProductIds.map(String) : null;
    const items = (order.items || []).filter((i: any) => i.isReturnable !== false && (!wanted || wanted.includes(String(i.productId))));
    if (!items.length) return NextResponse.json({ error: 'None of the selected items can be returned.' }, { status: 400 });

    const imgs = (Array.isArray(images) ? images : []).filter((u: any) => typeof u === 'string' && u).slice(0, 6);
    const refundAmount = round3(items.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0));
    const ref = await db.collection('returnRequests').add({
      orderId, orderNumber: order.orderNumber, userId: session.user.id,
      userName: session.user.name || order.userName || '', userEmail: session.user.email || order.userEmail || '',
      items, reason: String(reason), description: String(description || '').slice(0, 2000), images: imgs,
      status: imgs.length ? 'photo_submitted' : 'pending', refundAmount, isRefundable: true,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection('orders').doc(orderId).update({
      status: 'return_requested', updatedAt: FieldValue.serverTimestamp(),
      statusHistory: FieldValue.arrayUnion({ status: 'return_requested', note: `Return requested: ${String(reason)}`, createdAt: new Date().toISOString() }),
    });
    return NextResponse.json({ success: true, id: ref.id });
  } catch (e) { console.error('[POST returns]', e); return NextResponse.json({ error: 'Could not submit the return request. Please try again.' }, { status: 500 }); }
}

async function __PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await req.json();
    const id = b.returnId || b.id;
    const status = String(b.status || '');
    if (!id) return NextResponse.json({ error: 'Missing return id.' }, { status: 400 });
    if (!['approved', 'rejected', 'refunded'].includes(status)) return NextResponse.json({ error: 'Invalid return status.' }, { status: 400 });

    const db = getAdminDb();
    const ref = db.collection('returnRequests').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Return request not found.' }, { status: 404 });
    const cur: any = snap.data();
    const allowed: Record<string, string[]> = { pending: ['approved', 'rejected'], photo_submitted: ['approved', 'rejected'], approved: ['refunded', 'rejected'] };
    if (!(allowed[cur.status] || []).includes(status))
      return NextResponse.json({ error: `A ${String(cur.status).replace(/_/g, ' ')} return cannot be marked ${status}.` }, { status: 400 });

    const patch: Record<string, any> = { status, updatedAt: FieldValue.serverTimestamp() };
    const note = String(b.adminNote ?? b.note ?? '').trim();
    if (note) patch.adminNote = note;
    if (b.refundAmount !== undefined && b.refundAmount !== null && b.refundAmount !== '') {
      const amt = Number(b.refundAmount);
      if (!(amt >= 0)) return NextResponse.json({ error: 'Refund amount must be 0 or more.' }, { status: 400 });
      const order: any = await adminGetOrderById(cur.orderId);
      if (order && amt > Number(order.total) + 0.0005) return NextResponse.json({ error: 'The refund cannot be more than the order total.' }, { status: 400 });
      patch.refundAmount = round3(amt);
    }
    if (b.photoVerified !== undefined) patch.photoVerified = !!b.photoVerified;
    if (Array.isArray(b.adminImages) && b.adminImages.length) patch.adminImages = b.adminImages.slice(0, 4);
    // Card orders are refunded through Stripe BEFORE the return is marked refunded, so a failed refund never shows as done.
    if (status === 'refunded') {
      const os = await db.collection('orders').doc(cur.orderId).get();
      const od: any = os.exists ? { id: os.id, ...os.data() } : null;
      if (od && od.paymentMethod === 'card' && od.paymentStatus === 'paid') {
        try {
          const amt = patch.refundAmount ?? cur.refundAmount;
          const rf = await refundCardOrder(od, amt === undefined || amt === null ? undefined : Number(amt));
          patch.stripeRefundId = rf.refundId;
          patch.note = `${patch.note || ''} Stripe refund USD ${rf.usd.toFixed(2)}`.trim();
        } catch (e: any) {
          console.error('[return refund]', e?.message || e);
          return NextResponse.json({ error: 'The Stripe refund failed. Nothing was changed - please try again or refund in the Stripe dashboard.' }, { status: 502 });
        }
      }
    }
    // Restock (base units) when asked to; recorded on the return so it can never run twice.
    if (status === 'refunded' && b.restock !== false && !cur.restocked) {
      await restockItems(db, cur.items || []);
      patch.restocked = true;
    } else if (status === 'refunded') patch.restocked = !!cur.restocked;
    await ref.update(patch);

    const orderStatus = status === 'approved' ? 'return_approved' : status === 'rejected' ? 'return_rejected' : 'refunded';
    const oref = db.collection('orders').doc(cur.orderId);
    if ((await oref.get()).exists) await oref.update({
      status: orderStatus, ...(status === 'refunded' ? { paymentStatus: 'refunded' } : {}), updatedAt: FieldValue.serverTimestamp(),
      statusHistory: FieldValue.arrayUnion({ status: orderStatus, note: note || `Return ${status}`, createdAt: new Date().toISOString() }),
    });
    if (status === 'refunded') await (await import('@/lib/revenue')).applyRefund(cur.orderId, Number(patch.refundAmount ?? cur.refundAmount ?? 0)).catch(e => console.error('[revenue refund]', e?.message));
    if (status === 'refunded') await (await import('@/lib/loyalty')).reverseForRefund(cur.orderId, Number(patch.refundAmount ?? cur.refundAmount ?? 0)).catch(e => console.error('[loyalty reverse]', e?.message));
    return NextResponse.json({ success: true });
  } catch (e) { console.error('[PATCH returns]', e); return NextResponse.json({ error: 'Could not update the return.' }, { status: 500 }); }
}

export const GET = withLog('GET', '/api/orders/returns', __GET);
export const POST = withLog('POST', '/api/orders/returns', __POST);
export const PATCH = withLog('PATCH', '/api/orders/returns', __PATCH);
