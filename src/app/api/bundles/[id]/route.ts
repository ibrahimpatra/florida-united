import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ProductError } from '@/lib/firestore-admin';
import { adminGetBundleById, adminUpdateBundle, adminDeleteBundle } from '@/lib/firestore-admin';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const bundle = await adminGetBundleById(params.id);
    if (!bundle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(bundle);
  } catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[bundles]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminUpdateBundle(params.id, await req.json());
    return NextResponse.json({ success: true });
  } catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[bundles]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminDeleteBundle(params.id);
    return NextResponse.json({ success: true });
  } catch (e: any) { if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[bundles]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
