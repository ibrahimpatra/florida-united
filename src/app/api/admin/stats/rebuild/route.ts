import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminRebuildStats } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function __POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ success: true, ...(await adminRebuildStats()) }); }
  catch (e: any) { console.error('[stats rebuild]', e); return NextResponse.json({ error: e?.message || 'Rebuild failed' }, { status: 500 }); }
}

export const POST = withLog('POST', '/api/admin/stats/rebuild', __POST);
