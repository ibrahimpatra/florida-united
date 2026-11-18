import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminUpdateCoupon, adminDeleteCoupon } from '@/lib/firestore-admin';
import { ProductError } from '@/lib/firestore-admin';

async function __PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminUpdateCoupon(params.id, await req.json()); return NextResponse.json({ success: true }); }
  catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[coupons]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

async function __DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const r = await adminDeleteCoupon(params.id); return NextResponse.json({ success: true, ...r }); }
  catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[coupons]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const PUT = withLog('PUT', '/api/coupons/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/coupons/[id]', __DELETE);
