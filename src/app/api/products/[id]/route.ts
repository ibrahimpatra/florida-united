import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetProductById, adminUpdateProduct, adminDeleteProduct } from '@/lib/firestore-admin';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const product = await adminGetProductById(params.id);
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error('[GET /api/products/[id]]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminUpdateProduct(params.id, await req.json());
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/products/[id]]', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminDeleteProduct(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/products/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
