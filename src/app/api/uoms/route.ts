import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetUOMs, adminCreateUOM } from '@/lib/shipping-admin';
import { AdminInputError } from '@/lib/shipping-admin';

async function __GET() {
  try { return NextResponse.json(await adminGetUOMs()); }
  catch (e: any) { if (e instanceof AdminInputError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[uoms]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const id = await adminCreateUOM(await req.json()); return NextResponse.json({ success: true, id }); }
  catch (e: any) { if (e instanceof AdminInputError) return NextResponse.json({ error: e.message }, { status: e.status }); console.error('[uoms]', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const GET = withLog('GET', '/api/uoms', __GET);
export const POST = withLog('POST', '/api/uoms', __POST);
