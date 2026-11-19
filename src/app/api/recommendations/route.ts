import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { adminGetProducts } from '@/lib/firestore-admin';
import { loadPairCounts, scoreRecommendations } from '@/lib/recommend';

/**
 * Automatic recommendations. ?productId=a  or  ?ids=a,b,c (the cart)  &limit=8
 * Returns { recommendations: Product[] } each with a `reason`. No manual curation needed.
 */
async function __GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const ids = [...new Set([sp.get('productId'), ...(sp.get('ids') || '').split(',')].map(s => String(s || '').trim()).filter(id => id && !id.startsWith('bundle:')))].slice(0, 12);
  const limit = Math.min(12, Math.max(1, Number(sp.get('limit')) || 8));
  try {
    const all = (await adminGetProducts({ pageSize: 5000 })).items as any[]; // storefront view: active products, no cost price
    const seeds = ids.map(id => all.find(p => p.id === id)).filter(Boolean);
    let recs = seeds.length ? scoreRecommendations(seeds, all, await loadPairCounts(), limit) : [];
    if (recs.length < limit) { // new shop / nothing related yet: fill with the best sellers so the box is never empty
      const have = new Set([...ids, ...recs.map(r => r.product.id)]);
      const pop = all.filter(p => !have.has(p.id) && p.stock > 0).sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0) || (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)).slice(0, limit - recs.length);
      recs = [...recs, ...pop.map(p => ({ product: p, reason: 'popular' as any, score: 0 }))];
    }
    return NextResponse.json({ recommendations: recs.map(r => ({ ...r.product, reason: r.reason, score: r.score })) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) { return NextResponse.json({ recommendations: [] }); }
}

export const GET = withLog('GET', '/api/recommendations', __GET);
