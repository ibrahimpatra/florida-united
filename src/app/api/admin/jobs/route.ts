import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminRole, denyUnlessSuper } from '@/lib/api-error';
import { getAdminDb } from '@/lib/firebase-admin';
import { listJobs, runQueued, retryJob, queueAllMissing, runJob } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function guard() {
  const s = await getServerSession(authOptions);
  if (!isAdminRole(s)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return denyUnlessSuper(s);
}
async function __GET() {
  const no = await guard(); if (no) return no;
  // one count query (billed per 1000 matches, not per job) tells the page whether anything is waiting
  let queued = 0; try { queued = (await getAdminDb().collection('jobs').where('status', '==', 'queued').count().get()).data().count; } catch { /* page falls back to what it can see */ }
  return NextResponse.json({ jobs: await listJobs(60), queued });
}
/** POST { action: 'run' | 'retry' | 'queue-missing', id? } */
async function __POST(req: NextRequest) {
  const no = await guard(); if (no) return no;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'retry' && b.id) { await retryJob(String(b.id)); await runJob(String(b.id)); return NextResponse.json({ success: true }); }
  if (b.action === 'queue-missing') return NextResponse.json({ queued: await queueAllMissing() });
  return NextResponse.json(await runQueued());
}
export const GET = withLog('GET', '/api/admin/jobs', __GET);
export const POST = withLog('POST', '/api/admin/jobs', __POST);
