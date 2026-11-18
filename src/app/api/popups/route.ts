import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listPopups, createPopup, publicPopup } from '@/lib/popups';
import { failJson, isAdminRole } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

/** Shoppers: only live popups, without stats. Admins: ?all=true returns everything with views and clicks. */
async function __GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const all = new URL(req.url).searchParams.get('all') === 'true' && isAdminRole(session);
  try {
    const list = await listPopups(!all);
    return NextResponse.json(all ? list : list.map(publicPopup), { headers: { 'Cache-Control': all ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) { return all ? failJson(session, 500, 'Could not load popups.', e) : NextResponse.json([]); }
}
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminRole(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ success: true, id: await createPopup(await req.json()) }); }
  catch (e: any) { return NextResponse.json({ error: e?.message || 'Could not save.' }, { status: 400 }); }
}
export const GET = withLog('GET', '/api/popups', __GET);
export const POST = withLog('POST', '/api/popups', __POST);
