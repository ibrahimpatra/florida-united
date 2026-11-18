import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetProductById, adminUpdateProduct, adminDeleteProduct, ProductError, publicProduct } from '@/lib/firestore-admin';

async function __GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const product = await adminGetProductById(params.id);
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const session = await getServerSession(authOptions);
    if (String(session?.user?.role).toLowerCase() === 'admin') return NextResponse.json(product);
    // shoppers never get hidden products or the cost price
    if ((product as any).isActive === false) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(publicProduct(product));
  } catch (err) {
    console.error('[GET /api/products/[id]]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

async function __PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminUpdateProduct(params.id, await req.json());
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ProductError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[PUT /api/products/[id]]', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

async function __DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const r = await adminDeleteProduct(params.id);
    return NextResponse.json({ success: true, ...r });
  } catch (err) {
    if (err instanceof ProductError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[DELETE /api/products/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/products/[id]', __GET);
export const PUT = withLog('PUT', '/api/products/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/products/[id]', __DELETE);
