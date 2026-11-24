import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateBrand, deleteBrand, BrandError } from '@/lib/brands';

const isAdmin = async () => { const s = await getServerSession(authOptions); return !!s && String(s.user.role).toLowerCase() === 'admin'; };
async function __PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await updateBrand(params.id, await req.json()); return NextResponse.json({ success: true }); }
  catch (e: any) { if (e instanceof BrandError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[PUT /api/brands/[id]]', e); return NextResponse.json({ error: 'Failed to update' }, { status: 500 }); }
}
async function __DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await deleteBrand(params.id); return NextResponse.json({ success: true }); }
  catch (e) { console.error('[DELETE /api/brands/[id]]', e); return NextResponse.json({ error: 'Failed to delete' }, { status: 500 }); }
}
export const PUT = withLog('PUT', '/api/brands/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/brands/[id]', __DELETE);
