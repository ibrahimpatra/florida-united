import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
let memo: { at: number; v: { orders: number; returns: number } } | null = null;

/** Small counts for the admin menu tiles (orders waiting, returns waiting). Two count queries, remembered for 60 seconds. */
async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (memo && Date.now() - memo.at < 60_000) return NextResponse.json(memo.v);
  const db = getAdminDb();
  const n = async (status: string) => { try { return (await db.collection('orders').where('status', '==', status).count().get()).data().count; } catch { return 0; } };
  const [orders, returns] = await Promise.all([n('pending'), n('return_requested')]);
  memo = { at: Date.now(), v: { orders, returns } };
  return NextResponse.json(memo.v);
}
export const GET = withLog('GET', '/api/admin/badges', __GET);
