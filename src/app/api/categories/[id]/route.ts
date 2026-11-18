import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminUpdateCategory, adminDeleteCategory, ProductError } from '@/lib/firestore-admin';

async function __PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminUpdateCategory(params.id, await req.json());
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ProductError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[PUT /api/categories/[id]]', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

async function __DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminDeleteCategory(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ProductError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[DELETE /api/categories/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export const PUT = withLog('PUT', '/api/categories/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/categories/[id]', __DELETE);
