import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminUpdateUOM, adminDeleteUOM } from '@/lib/shipping-admin';
import { AdminInputError } from '@/lib/shipping-admin';

async function __PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminUpdateUOM(params.id, await req.json()); return NextResponse.json({ success: true }); }
  catch (e: any) { if (e instanceof AdminInputError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[uoms]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
async function __DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminDeleteUOM(params.id); return NextResponse.json({ success: true }); }
  catch (e: any) { if (e instanceof AdminInputError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[uoms]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const PUT = withLog('PUT', '/api/uoms/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/uoms/[id]', __DELETE);
