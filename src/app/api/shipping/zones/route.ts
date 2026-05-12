import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShippingZones, createShippingZone } from '@/lib/shippingService';

export async function GET() {
  const zones = await getShippingZones();
  return NextResponse.json(zones);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await req.json();
  const id = await createShippingZone(data);
  return NextResponse.json({ success: true, id });
}
