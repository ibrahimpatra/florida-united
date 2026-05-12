import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllFlashDeals, getActiveFlashDeals, createFlashDeal } from '@/lib/shippingService';

export async function GET(req: NextRequest) {
  const admin = new URL(req.url).searchParams.get('admin') === 'true';
  const session = await getServerSession(authOptions);
  if (admin && (!session || session.user.role !== 'admin')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(admin ? await getAllFlashDeals() : await getActiveFlashDeals());
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await createFlashDeal(await req.json());
  return NextResponse.json({ success: true, id });
}
