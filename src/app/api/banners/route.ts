import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetBanners, adminCreateBanner, ProductError } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/** Public callers only ever see ACTIVE banners; admins can pass ?all=true to see everything. */
async function __GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const wantAll = new URL(req.url).searchParams.get('all') === 'true' && session?.user?.role === 'admin';
    return NextResponse.json(await adminGetBanners(!wantAll), { headers: { 'Cache-Control': wantAll ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) { console.error('[GET banners]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const id = await adminCreateBanner(await req.json());
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[POST banners]', e); return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/banners', __GET);
export const POST = withLog('POST', '/api/banners', __POST);
