import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listIssues, clearIssues } from '@/lib/issues';
import { isAdminRole, denyUnlessSuper } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

async function __GET() {
  const session = await getServerSession(authOptions);
  if (!isAdminRole(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const no = await denyUnlessSuper(session); if (no) return no;
  return NextResponse.json(await listIssues());
}
/** DELETE ?id=... removes one row; without id it clears the list. */
async function __DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminRole(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const no = await denyUnlessSuper(session); if (no) return no;
  await clearIssues(new URL(req.url).searchParams.get('id') || undefined);
  return NextResponse.json({ success: true });
}
export const GET = withLog('GET', '/api/admin/issues', __GET);
export const DELETE = withLog('DELETE', '/api/admin/issues', __DELETE);
