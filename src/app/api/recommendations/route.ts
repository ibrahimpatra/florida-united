export const dynamic = 'force-dynamic';

// src/app/api/recommendations/route.ts - AI-powered product recommendations
import { NextRequest, NextResponse } from 'next/server';
import { getProductById, getProducts } from '@/lib/firestore';
import type { Product, ProductRecommendation } from '@/types';

// Scoring algorithm: tag overlap + category match + purchase co-occurrence signals
function computeScore(source: Product, candidate: Product): { score: number; reason: string } {
  if (candidate.id === source.id) return { score: 0, reason: '' };

  let score = 0;
  let reason = 'similar_specs';

  // 1. Same category = base match
  if (candidate.categoryId === source.categoryId) {
    score += 30;
    reason = 'same_category';
  }

  // 2. AI tag overlap (semantic similarity)
  const sourceTags = [...(source.aiTags || []), ...(source.tags || [])].map(t => t.toLowerCase());
  const candidateTags = [...(candidate.aiTags || []), ...(candidate.tags || [])].map(t => t.toLowerCase());
  const tagOverlap = sourceTags.filter(t => candidateTags.includes(t)).length;
  score += tagOverlap * 15;

  if (tagOverlap > 2) reason = 'frequently_bought_together';

  // 3. Compatible products list
  if (source.compatibleWith?.includes(candidate.id) || candidate.compatibleWith?.includes(source.id)) {
    score += 50;
    reason = 'compatible';
  }

  // 4. Same brand
  if (source.brand && candidate.brand && source.brand === candidate.brand) {
    score += 10;
  }

  // 5. Similar price range (within 50%)
  if (source.price > 0 && candidate.price > 0) {
    const ratio = Math.min(source.price, candidate.price) / Math.max(source.price, candidate.price);
    if (ratio > 0.5) score += 5;
  }

  // 6. Popularity boost
  score += Math.min(candidate.totalSold * 0.1, 10);

  return { score, reason };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const limit = parseInt(searchParams.get('limit') || '6');

    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

    const source = await getProductById(productId);
    if (!source) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // Get candidates: same category + all products (for cross-category accessories)
    const [sameCat, allProducts] = await Promise.all([
      getProducts({ categoryId: source.categoryId, pageSize: 30 }),
      getProducts({ pageSize: 50 }),
    ]);

    const seen = new Set<string>();
    const candidates: Product[] = [];
    for (const p of [...sameCat.items, ...allProducts.items]) {
      if (!seen.has(p.id) && p.id !== productId && p.isActive) {
        seen.add(p.id);
        candidates.push(p);
      }
    }

    // Score and rank
    const scored: ProductRecommendation[] = candidates
      .map(p => {
        const { score, reason } = computeScore(source, p);
        return { product: p, score, reason };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({ recommendations: scored, sourceProduct: source.name });
  } catch (err) {
    console.error('Recommendations error:', err);
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 });
  }
}