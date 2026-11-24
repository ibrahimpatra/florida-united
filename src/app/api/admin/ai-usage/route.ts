import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { denyUnlessSuper } from '@/lib/api-error';
import { listAiUsage, bulkDailyCap } from '@/lib/ai-usage';
import { summariseDay, openaiBilling } from '@/lib/ai-cost';

export const dynamic = 'force-dynamic';

/** Super admin only. Our own per-day counters (calls, tokens, failures, fallbacks, estimated cost) plus OpenAI's own billing when OPENAI_ADMIN_KEY is set. */
async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const deny = await denyUnlessSuper(session); if (deny) return deny;
  const days = (await listAiUsage(30)).map(summariseDay);
  return NextResponse.json({
    days, cap: bulkDailyCap(),
    openai: await openaiBilling(30),
    configured: { gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY), openai: !!process.env.OPENAI_API_KEY },
  });
}
export const GET = withLog('GET', '/api/admin/ai-usage', __GET);
