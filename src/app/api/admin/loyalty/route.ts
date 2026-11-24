import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { denyUnlessSuper } from '@/lib/api-error';
import { loadLoyaltySettings, saveLoyaltySettings, adjustPoints } from '@/lib/loyalty';

export const dynamic = 'force-dynamic';
const admin = async () => { const s = await getServerSession(authOptions); return s?.user?.role === 'admin' ? s : null; };

async function __GET() { return (await admin()) ? NextResponse.json(await loadLoyaltySettings()) : NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
/** PUT = save the rules. POST { userId, points, note } = adjust one customer. */
async function __PUT(req: NextRequest) {
  const s0 = await admin(); if (!s0) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const d0 = await denyUnlessSuper(s0); if (d0) return d0;
  return NextResponse.json({ success: true, settings: await saveLoyaltySettings(await req.json().catch(() => ({}))) });
}
async function __POST(req: NextRequest) {
  const s = await admin(); if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const d1 = await denyUnlessSuper(s); if (d1) return d1;
  const b = await req.json().catch(() => ({}));
  try {
    let uid = String(b.userId || '').trim();
    if (uid.includes('@')) { // allow an email address instead of an id
      const { getAdminDb } = await import('@/lib/firebase-admin');
      const q = await getAdminDb().collection('users').where('email', '==', uid.toLowerCase()).limit(1).get();
      if (q.empty) return NextResponse.json({ error: 'No customer has that email.' }, { status: 404 });
      uid = q.docs[0].id;
    }
    await adjustPoints(uid, Number(b.points), String(b.note || ''), s.user.email || s.user.id);
    return NextResponse.json({ success: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message || 'Could not adjust' }, { status: 400 }); }
}
export const GET = withLog('GET', '/api/admin/loyalty', __GET);
export const PUT = withLog('PUT', '/api/admin/loyalty', __PUT);
export const POST = withLog('POST', '/api/admin/loyalty', __POST);
