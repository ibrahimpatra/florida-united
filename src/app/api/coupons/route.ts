import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetAllCoupons, adminCreateCoupon } from '@/lib/firestore-admin';
import { ProductError } from '@/lib/firestore-admin';

async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await adminGetAllCoupons()); }
  catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[coupons]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    const id = await adminCreateCoupon(data);
    return NextResponse.json({ success: true, id });
  } catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[coupons]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const GET = withLog('GET', '/api/coupons', __GET);
export const POST = withLog('POST', '/api/coupons', __POST);
