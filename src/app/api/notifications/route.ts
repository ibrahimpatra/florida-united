import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listFor, markAllRead, createBroadcast, deleteBroadcast, listBroadcasts } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const isAdmin = (s: any) => String(s?.user?.role).toLowerCase() === 'admin';

/** GET ?scope=me (default) | admin | broadcasts (admin list of sent messages) */
async function __GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO });
  const scope = req.nextUrl.searchParams.get('scope') || 'me';
  try {
    if (scope === 'broadcasts') { if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json({ items: await listBroadcasts(30) }, { headers: NO }); }
    if (scope === 'admin' && !isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO });
    return NextResponse.json(await listFor(session.user.id, scope === 'admin' ? 'admin' : 'me'), { headers: NO });
  } catch (e) { console.error('[GET notifications]', e); return NextResponse.json({ error: 'Could not load notifications' }, { status: 500, headers: NO }); }
}

/** POST { action: 'read', scope } | { action: 'broadcast', title, titleAr?, body?, bodyAr?, href? } | { action: 'delete', id } */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await req.json();
    if (b.action === 'read') {
      const scope = b.scope === 'admin' && isAdmin(session) ? 'admin' : 'me';
      await markAllRead(session.user.id, scope); return NextResponse.json({ success: true });
    }
    if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (b.action === 'broadcast') {
      const title = String(b.title || '').trim().slice(0, 120);
      if (!title) return NextResponse.json({ error: 'Write a title.' }, { status: 400 });
      const href = String(b.href || '').trim();
      if (href && !/^\/(?!\/)/.test(href)) return NextResponse.json({ error: 'The link must be a page on this site, starting with /.' }, { status: 400 });
      const id = await createBroadcast({ type: 'offer', title, titleAr: String(b.titleAr || '').trim().slice(0, 120) || undefined, body: String(b.body || '').trim().slice(0, 300) || undefined, bodyAr: String(b.bodyAr || '').trim().slice(0, 300) || undefined, href: href || undefined });
      return NextResponse.json({ success: true, id });
    }
    if (b.action === 'delete' && b.id) { await deleteBroadcast(String(b.id)); return NextResponse.json({ success: true }); }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) { console.error('[POST notifications]', e); return NextResponse.json({ error: 'Could not save.' }, { status: 500 }); }
}

export const GET = withLog('GET', '/api/notifications', __GET);
export const POST = withLog('POST', '/api/notifications', __POST);
