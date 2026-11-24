import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadLoyaltySettings, getBalance, history, releaseDue, pendingFor, joinLoyalty, isMember } from '@/lib/loyalty';
import { tierFor } from '@/lib/loyalty-core';

export const dynamic = 'force-dynamic';

/** Signed-in customer: settings, balance, tier and recent history. Guests get { enabled } only. */
async function __GET() {
  const s = await loadLoyaltySettings();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ enabled: s.enabled, settings: s.enabled ? s : undefined });
  const uid = session.user.id;
  const joined = isMember(((await (await import('@/lib/firebase-admin')).getAdminDb().collection('users').doc(uid).get()).data()) as any);
  if (!joined) return NextResponse.json({ enabled: s.enabled, settings: s, joined: false, points: 0, valueKwd: 0, tier: null, next: null, history: [], pending: { total: 0, rows: [] } }, { headers: { 'Cache-Control': 'no-store' } });
  await releaseDue(uid).catch(() => 0);   // points whose return window has ended move to the balance now
  const b = await getBalance(uid);
  const tier = tierFor(s, b.lifetimeSpent);
  const next = s.tiers.find(t => t.minSpent > b.lifetimeSpent) || null;
  return NextResponse.json({ enabled: s.enabled, settings: s, points: b.points, valueKwd: Math.round(b.points * s.pointValueKwd * 1000) / 1000, tier, next, joined: true, pending: await pendingFor(uid), history: s.enabled ? await history(uid, 30) : [] }, { headers: { 'Cache-Control': 'no-store' } });
}
export const GET = withLog('GET', '/api/loyalty', __GET);

/** The customer taps Join on the loyalty page: only then do they become a member. */
async function __POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!(await loadLoyaltySettings()).enabled) return NextResponse.json({ error: 'The rewards programme is not running right now.' }, { status: 400 });
  await joinLoyalty(session.user.id);
  return NextResponse.json({ success: true });
}
export const POST = withLog('POST', '/api/loyalty', __POST);
