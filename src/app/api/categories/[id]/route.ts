import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminUpdateCategory, adminDeleteCategory } from '@/lib/firestore-admin';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminUpdateCategory(params.id, await req.json());
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/categories/[id]]', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminDeleteCategory(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/categories/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
