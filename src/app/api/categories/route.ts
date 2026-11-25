import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetCategories, adminCreateCategory } from '@/lib/firestore-admin';

async function __GET(req: NextRequest) {
  try {
    // ?admin=1 from a signed-in admin: never cached by the network, so a new category shows at once
    const wantsAdmin = req.nextUrl.searchParams.get('admin') === '1';
    const isAdmin = wantsAdmin && (await getServerSession(authOptions))?.user?.role === 'admin';
    const cats = await adminGetCategories(false, isAdmin && req.nextUrl.searchParams.get('fresh') === '1');
    return NextResponse.json(cats, {
      headers: { 'Cache-Control': isAdmin ? 'no-store' : 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('[GET /api/categories]', err);
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  }
}

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    const id = await adminCreateCategory(data);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('[POST /api/categories]', err);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/categories', __GET);
export const POST = withLog('POST', '/api/categories', __POST);
