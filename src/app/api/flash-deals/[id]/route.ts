import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateFlashDeal, deleteFlashDeal, getFlashDealById } from '@/lib/shippingService';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json(await getFlashDealById(params.id));
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await updateFlashDeal(params.id, await req.json());
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await deleteFlashDeal(params.id);
  return NextResponse.json({ success: true });
}
