import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { adminGetProducts, publicProduct } from '@/lib/firestore-admin';

/** ?ids=a,b,c  ->  { items: Product[] } in the same order, active products only (used by the "Recently viewed" strip). */
async function __GET(req: NextRequest) {
  const ids = [...new Set((new URL(req.url).searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean))].slice(0, 16);
  if (!ids.length) return NextResponse.json({ items: [] });
  try {
    const all = (await adminGetProducts({ pageSize: 5000 })).items as any[];
    const byId = new Map(all.map(p => [p.id, p]));
    return NextResponse.json({ items: ids.map(id => byId.get(id)).filter(Boolean).map((p: any) => publicProduct(p)) }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch { return NextResponse.json({ items: [] }); }
}
export const GET = withLog('GET', '/api/products/by-ids', __GET);
