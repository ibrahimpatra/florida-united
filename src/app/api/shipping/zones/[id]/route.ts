import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetShippingZones, adminUpdateShippingZone, adminDeleteShippingZone } from '@/lib/shipping-admin';
import { normalizeZone, findGovernorateConflict, ValidationError } from '@/lib/zone-validate';

async function guard() {
  const session = await getServerSession(authOptions);
  return session && session.user.role === 'admin';
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const zone = normalizeZone(await req.json());
    const conflict = findGovernorateConflict(zone, (await adminGetShippingZones()).filter(z => z.id !== params.id));
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    await adminUpdateShippingZone(params.id, zone);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('[PUT shipping/zones/:id]', e);
    return NextResponse.json({ error: 'Failed to update zone (does it still exist?)' }, { status: 500 });
  }
}
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminDeleteShippingZone(params.id); return NextResponse.json({ success: true }); }
  catch (e) { console.error('[DELETE shipping/zones/:id]', e); return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 }); }
}
