import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetDashboardStats } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await adminGetDashboardStats());
  } catch (err) {
    console.error('[GET /api/admin/stats]', err);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/admin/stats', __GET);
