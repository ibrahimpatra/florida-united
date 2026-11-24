import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { mergeRecent, RecentItem } from '@/lib/recent';

export const dynamic = 'force-dynamic';

/** GET: the signed-in customer's saved list. One read of their user document. */
async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ items: [] });
  const u: any = (await getAdminDb().collection('users').doc(session.user.id).get()).data() || {};
  return NextResponse.json({ items: mergeRecent(u.recentViewed) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** PUT { items }: merges the browser's list into the saved one (so two devices never overwrite each other). One write, and none when nothing changed. */
async function __PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const incoming: RecentItem[] = Array.isArray(body?.items) ? body.items.slice(0, 40) : [];
  const ref = getAdminDb().collection('users').doc(session.user.id);
  const cur: any = (await ref.get()).data() || {};
  const merged = mergeRecent(cur.recentViewed, incoming);
  if (JSON.stringify(merged) !== JSON.stringify(mergeRecent(cur.recentViewed))) await ref.set({ recentViewed: merged }, { merge: true });
  return NextResponse.json({ items: merged });
}
export const GET = withLog('GET', '/api/account/recent', __GET);
export const PUT = withLog('PUT', '/api/account/recent', __PUT);
