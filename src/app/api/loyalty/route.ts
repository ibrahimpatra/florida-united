import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadLoyaltySettings, getBalance, history } from '@/lib/loyalty';
import { tierFor } from '@/lib/loyalty-core';

export const dynamic = 'force-dynamic';

/** Signed-in customer: settings, balance, tier and recent history. Guests get { enabled } only. */
async function __GET() {
  const s = await loadLoyaltySettings();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ enabled: s.enabled, settings: s.enabled ? s : undefined });
  const b = await getBalance(session.user.id);
  const tier = tierFor(s, b.lifetimeSpent);
  const next = s.tiers.find(t => t.minSpent > b.lifetimeSpent) || null;
  return NextResponse.json({ enabled: s.enabled, settings: s, points: b.points, valueKwd: Math.round(b.points * s.pointValueKwd * 1000) / 1000, tier, next, history: s.enabled ? await history(session.user.id, 20) : [] }, { headers: { 'Cache-Control': 'no-store' } });
}
export const GET = withLog('GET', '/api/loyalty', __GET);
