import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetShippingZones, adminCreateShippingZone } from '@/lib/shipping-admin';
import { normalizeZone, findGovernorateConflict, ValidationError } from '@/lib/zone-validate';

export const dynamic = 'force-dynamic';

async function __GET() {
  try { return NextResponse.json(await adminGetShippingZones(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { console.error('[GET shipping/zones]', e); return NextResponse.json({ error: 'Failed to load zones' }, { status: 500 }); }
}
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const zone = normalizeZone(await req.json());
    const conflict = findGovernorateConflict(zone, await adminGetShippingZones());
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    const id = await adminCreateShippingZone(zone);
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('[POST shipping/zones]', e);
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/shipping/zones', __GET);
export const POST = withLog('POST', '/api/shipping/zones', __POST);
