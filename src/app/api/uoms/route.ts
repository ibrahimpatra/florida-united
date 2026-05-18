import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetUOMs, adminCreateUOM } from '@/lib/shipping-admin';

export async function GET() {
  try { return NextResponse.json(await adminGetUOMs()); }
  catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const id = await adminCreateUOM(await req.json()); return NextResponse.json({ success: true, id }); }
  catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
