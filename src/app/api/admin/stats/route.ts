import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetDashboardStats } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

let memo: { at: number; v: any } | null = null;   // dashboard numbers are remembered for 2 minutes: reloading the page costs no reads

async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (memo && Date.now() - memo.at < 120_000) return NextResponse.json(memo.v);
    const v = await adminGetDashboardStats(); memo = { at: Date.now(), v };
    return NextResponse.json(v);
  } catch (err) {
    console.error('[GET /api/admin/stats]', err);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/admin/stats', __GET);
