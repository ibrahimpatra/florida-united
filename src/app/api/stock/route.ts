import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { stockForIds } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/** ?ids=a,b,c -> { a: { inStock, cap, factors } }. One call for the whole cart. Answers come from the server's in-memory product list, so this costs no extra database reads. */
async function __GET(req: NextRequest) {
  const ids = [...new Set((new URL(req.url).searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(s => s && !s.startsWith('bundle:')))].slice(0, 40);
  if (!ids.length) return NextResponse.json({});
  return NextResponse.json(await stockForIds(ids), { headers: { 'Cache-Control': 'private, max-age=20' } });
}
export const GET = withLog('GET', '/api/stock', __GET);
