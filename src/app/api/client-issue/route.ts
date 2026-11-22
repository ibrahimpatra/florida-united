import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { recordIssue } from '@/lib/issues';
import { withLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** The browser reports a failure it saw (for example an upload that failed) so it shows up in Admin > Issues. Signed-in users only, short text only. */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const clean = (v: any, n: number) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, n);
  await recordIssue({ route: `browser:${clean(b.area, 20) || 'client'}`, method: 'CLIENT', status: 0, message: `${clean(b.message, 300)} [page ${clean(b.page, 80)}]`, user: `${session.user.email || session.user.id} (${session.user.role})` }).catch(() => {});
  return NextResponse.json({ ok: true });
}
export const POST = withLog('POST', '/api/client-issue', __POST);
