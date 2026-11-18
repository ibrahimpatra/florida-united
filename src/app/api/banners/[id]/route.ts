import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminUpdateBanner, adminDeleteBanner, ProductError } from '@/lib/firestore-admin';

async function __PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminUpdateBanner(params.id, await req.json()); return NextResponse.json({ success: true }); }
  catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[banners]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

async function __DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await adminDeleteBanner(params.id); return NextResponse.json({ success: true }); }
  catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[banners]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const PUT = withLog('PUT', '/api/banners/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/banners/[id]', __DELETE);
