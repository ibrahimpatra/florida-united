import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminUpdateCoupon, adminDeleteCoupon } from '@/lib/firestore-admin';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminUpdateCoupon(params.id, await req.json()); return NextResponse.json({ success: true }); }
  catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminDeleteCoupon(params.id); return NextResponse.json({ success: true }); }
  catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
