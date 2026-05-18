import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetAllCoupons, adminCreateCoupon } from '@/lib/firestore-admin';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await adminGetAllCoupons()); }
  catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    const id = await adminCreateCoupon(data);
    return NextResponse.json({ success: true, id });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
