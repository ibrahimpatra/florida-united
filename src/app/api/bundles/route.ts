import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ProductError } from '@/lib/firestore-admin';
import { adminGetBundles, adminCreateBundle, getStorefrontBundles } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

async function __GET(req: NextRequest) {
  try {
    const activeOnly = req.nextUrl.searchParams.get('active') === 'true';
    const bundles = activeOnly ? await getStorefrontBundles() : await adminGetBundles(false);
    return NextResponse.json(bundles, { headers: { 'Cache-Control': activeOnly ? 'public, s-maxage=60, stale-while-revalidate=300' : 'no-store' } });
  } catch (e) {
    console.error('[GET /api/bundles]', e);
    return NextResponse.json({ error: 'Failed to load bundles' }, { status: 500 });
  }
}

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    const id = await adminCreateBundle(data);
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[POST /api/bundles]', e);
    return NextResponse.json({ error: 'Failed to create bundle' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/bundles', __GET);
export const POST = withLog('POST', '/api/bundles', __POST);
