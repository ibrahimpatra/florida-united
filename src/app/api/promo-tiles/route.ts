import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listTiles, createTile, updateTile, deleteTile } from '@/lib/promo-tiles';

export const dynamic = 'force-dynamic';
const isAdmin = async () => (await getServerSession(authOptions))?.user?.role === 'admin';

/** Public: active tiles. Admin: ?all=true for everything. */
async function __GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get('all') === 'true' && await isAdmin();
  try { return NextResponse.json(await listTiles(!all), { headers: { 'Cache-Control': all ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300' } }); }
  catch { return NextResponse.json([]); }
}
async function __POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ success: true, id: await createTile(await req.json()) }); }
  catch (e: any) { return NextResponse.json({ error: e.message || 'Could not save' }, { status: 400 }); }
}
/** PATCH { id, ...fields } */
async function __PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const { id, ...rest } = await req.json(); if (!id) throw new Error('Missing id'); await updateTile(String(id), rest); return NextResponse.json({ success: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message || 'Could not save' }, { status: 400 }); }
}
async function __DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id'); if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await deleteTile(id); return NextResponse.json({ success: true });
}
export const GET = withLog('GET', '/api/promo-tiles', __GET);
export const POST = withLog('POST', '/api/promo-tiles', __POST);
export const PATCH = withLog('PATCH', '/api/promo-tiles', __PATCH);
export const DELETE = withLog('DELETE', '/api/promo-tiles', __DELETE);
