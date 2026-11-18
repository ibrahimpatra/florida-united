import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listIssues, clearIssues } from '@/lib/issues';
import { isAdminRole } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

async function __GET() {
  if (!isAdminRole(await getServerSession(authOptions))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await listIssues());
}
/** DELETE ?id=... removes one row; without id it clears the list. */
async function __DELETE(req: NextRequest) {
  if (!isAdminRole(await getServerSession(authOptions))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await clearIssues(new URL(req.url).searchParams.get('id') || undefined);
  return NextResponse.json({ success: true });
}
export const GET = withLog('GET', '/api/admin/issues', __GET);
export const DELETE = withLog('DELETE', '/api/admin/issues', __DELETE);
