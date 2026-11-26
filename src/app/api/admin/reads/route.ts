import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { denyUnlessSuper } from '@/lib/api-error';
import { meter, resetMeter } from '@/lib/read-meter';

export const dynamic = 'force-dynamic';

/** Super admin only. Database reads counted on THIS server since it started (or since the last reset), per route, busiest first. */
async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const deny = await denyUnlessSuper(session); if (deny) return deny;
  const routes = [...meter.routes.entries()].map(([route, r]) => ({ route, calls: r.calls, reads: r.reads, max: r.max, avg: Math.round((r.reads / Math.max(1, r.calls)) * 10) / 10 })).sort((a, b) => b.reads - a.reads);
  return NextResponse.json({ since: meter.since, total: meter.total, other: meter.other, routes }, { headers: { 'Cache-Control': 'no-store' } });
}
async function __DELETE() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const deny = await denyUnlessSuper(session); if (deny) return deny;
  resetMeter(); return NextResponse.json({ success: true });
}
export const GET = withLog('GET', '/api/admin/reads', __GET);
export const DELETE = withLog('DELETE', '/api/admin/reads', __DELETE);
