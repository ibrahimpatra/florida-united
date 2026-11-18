import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updatePopup, deletePopup } from '@/lib/popups';
import { isAdminRole } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

async function __PUT(req: NextRequest, { params }: Ctx) {
  if (!isAdminRole(await getServerSession(authOptions))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { await updatePopup(params.id, await req.json()); return NextResponse.json({ success: true }); }
  catch (e: any) { return NextResponse.json({ error: e?.message || 'Could not save.' }, { status: 400 }); }
}
async function __DELETE(_: NextRequest, { params }: Ctx) {
  if (!isAdminRole(await getServerSession(authOptions))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await deletePopup(params.id); return NextResponse.json({ success: true });
}
export const PUT = withLog('PUT', '/api/popups/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/popups/[id]', __DELETE);
