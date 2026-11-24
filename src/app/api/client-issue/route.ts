import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { reportIssue } from '@/lib/issues';
import { withLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';
let windowAt = 0, seen = 0;

/** The browser reports a failure it saw (for example an upload that failed) so it shows up in Admin > Issues. Signed-in users only, short text only. */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // Visitors who are not signed in can report too (a checkout that crashes for a guest matters), but only a few per minute per server.
  const now = Date.now(); if (now - windowAt > 60_000) { windowAt = now; seen = 0; }
  if (!session?.user?.id && ++seen > 20) return NextResponse.json({ ok: false }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const clean = (v: any, n: number) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, n);
  reportIssue(`browser:${clean(b.area, 20) || 'client'}`, `${clean(b.message, 300)} [page ${clean(b.page, 80)}]`, { method: 'CLIENT', status: 0, user: session?.user?.id ? `${session.user.email || session.user.id} (${session.user.role})` : 'visitor' });
  return NextResponse.json({ ok: true });
}
export const POST = withLog('POST', '/api/client-issue', __POST);
