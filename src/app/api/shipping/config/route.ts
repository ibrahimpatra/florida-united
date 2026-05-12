import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShippingConfig, saveShippingConfig } from '@/lib/shippingService';

export async function GET() {
  const config = await getShippingConfig();
  return NextResponse.json(config || {});
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await saveShippingConfig(await req.json());
  return NextResponse.json({ success: true });
}
