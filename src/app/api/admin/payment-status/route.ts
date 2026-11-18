import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { providerStatus } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/** Which online payment providers have keys on the server. Names only: no secret ever leaves the server. */
async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ providers: providerStatus() });
}
export const GET = withLog('GET', '/api/admin/payment-status', __GET);
