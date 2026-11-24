import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { customerSegments } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

/** Coupons the shop chose to show in "Offers for you" that this customer can use right now (their group, dates, limits). */
async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ items: [] });
  const db = getAdminDb(); const uid = session.user.id; const now = new Date();
  const snap = await db.collection('coupons').where('showInAccount', '==', true).limit(30).get();
  const segs = customerSegments((await db.collection('users').doc(uid).get()).data(), now);
  const items: any[] = [];
  for (const d of snap.docs) {
    const c: any = d.data();
    if (c.isActive === false) continue;
    if (c.startsAt && new Date(c.startsAt) > now) continue;
    if (c.expiresAt && new Date(c.expiresAt) < now) continue;
    if (c.usageLimit && Number(c.usedCount || 0) >= c.usageLimit) continue;
    if (c.segment && c.segment !== 'all' && !segs.includes(c.segment)) continue;
    if (c.perUserLimit) { const u: any = (await db.collection('couponUsage').doc(`${d.id}_${uid}`).get()).data(); if (Number(u?.count || 0) >= c.perUserLimit) continue; }
    items.push({ code: c.code, type: c.type, value: c.value, buyQty: c.buyQty, getQty: c.getQty, minOrderAmount: c.minOrderAmount || 0, expiresAt: c.expiresAt || null });
  }
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
export const GET = withLog('GET', '/api/account/offers', __GET);
