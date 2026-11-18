import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminUpdateFlashDeal, adminDeleteFlashDeal } from '@/lib/shipping-admin';

async function __PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminUpdateFlashDeal(params.id, await req.json()); return NextResponse.json({ success: true }); }
  catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

async function __DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const r = await adminDeleteFlashDeal(params.id); return NextResponse.json({ success: true, ...r }); }
  catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const PUT = withLog('PUT', '/api/flash-deals/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/flash-deals/[id]', __DELETE);
