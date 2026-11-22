import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { runQueued, queueAllMissing } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily (vercel.json): queue SEO jobs for products still missing text, then work through the queue. Header: Authorization: Bearer <CRON_SECRET>. */
async function __GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // ?only=queue = just work through jobs that are already waiting (cheap: reads only the jobs list). Without it, also scan everything for blanks first (the daily Vercel cron).
  const onlyQueue = req.nextUrl.searchParams.get('only') === 'queue';
  const queued = onlyQueue ? 0 : await queueAllMissing(60);
  return NextResponse.json({ queued, ...(await runQueued()) });
}
export const GET = withLog('GET', '/api/cron/jobs', __GET);
