import { NextRequest, NextResponse } from 'next/server';
import { expireUnpaidCardOrders } from '@/lib/orders-server';

export const dynamic = 'force-dynamic';

/**
 * Releases stock held by card orders that were never paid. Call it every 30 minutes or so
 * (Vercel Cron, cron-job.org, ...) with the header  Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await expireUnpaidCardOrders(2)); }
  catch (e) { console.error('[cron expire]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
