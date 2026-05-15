import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllUOMs, createUOM } from '@/lib/shippingService';

export async function GET() {
  return NextResponse.json(await getAllUOMs());
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await createUOM(await req.json());
  return NextResponse.json({ success: true, id });
}
