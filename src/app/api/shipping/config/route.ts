import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetShippingConfig, adminSaveShippingConfig } from '@/lib/shipping-admin';
import { normalizeShippingConfig, ValidationError } from '@/lib/zone-validate';

export const dynamic = 'force-dynamic';

async function __GET() {
  try { return NextResponse.json((await adminGetShippingConfig()) || {}, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }); }
  catch (e) { console.error('[GET shipping/config]', e); return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 }); }
}

async function save(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const clean = normalizeShippingConfig(await req.json());
    await adminSaveShippingConfig(clean);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('[save shipping/config]', e);
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
  }
}
// The admin page historically used PUT; accept both so no client can get a silent 405.

export const GET = withLog('GET', '/api/shipping/config', __GET);
export const POST = withLog('POST', '/api/shipping/config', save);
export const PUT = withLog('PUT', '/api/shipping/config', save);
