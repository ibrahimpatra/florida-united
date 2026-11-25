import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBrands, createBrand, BrandError } from '@/lib/brands';

const isAdmin = async () => { const s = await getServerSession(authOptions); return !!s && String(s.user.role).toLowerCase() === 'admin'; };

/** Public list (active brands). ?all=1 (admins only) includes inactive ones. */
async function __GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get('all') === '1' && (await isAdmin());
    return NextResponse.json(await getBrands(!all, all), { headers: { 'Cache-Control': all ? 'no-store' : 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (e) { console.error('[GET /api/brands]', e); return NextResponse.json({ error: 'Failed to load brands' }, { status: 500 }); }
}
async function __POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ success: true, id: await createBrand(await req.json()) }); }
  catch (e: any) { if (e instanceof BrandError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[POST /api/brands]', e); return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 }); }
}
export const GET = withLog('GET', '/api/brands', __GET);
export const POST = withLog('POST', '/api/brands', __POST);
