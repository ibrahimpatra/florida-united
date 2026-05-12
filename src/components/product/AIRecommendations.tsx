'use client';
// AI-powered product recommendations — like Amazon / Noon / Carrefour Kuwait
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { formatPrice, calculateDiscount } from '@/lib/utils';
import type { Product, ProductRecommendation } from '@/types';

interface Props {
  productId: string;
  currentCategory: string;
}

const REASON_LABELS: Record<string, string> = {
  compatible: '🔌 Compatible Accessory',
  frequently_bought_together: '🛒 Frequently Bought Together',
  same_category: '📦 Similar Product',
  similar_specs: '⚙️ Similar Specs',
};

export function AIRecommendations({ productId, currentCategory }: Props) {
  const [recs, setRecs] = useState<ProductRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/recommendations?productId=${productId}&limit=8`)
      .then(r => r.json())
      .then(data => {
        if (data.recommendations) setRecs(data.recommendations);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Finding you the best matches...</span>
    </div>
  );

  if (error || recs.length === 0) return null;

  // Group by reason for display
  const compatibles = recs.filter(r => r.reason === 'compatible');
  const others = recs.filter(r => r.reason !== 'compatible');

  return (
    <section className="mt-16 space-y-10">
      {compatibles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-bold text-gray-900">Compatible Accessories</h2>
          </div>
          <RecommendationGrid items={compatibles} />
        </div>
      )}

      {others.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-gray-900">You Might Also Like</h2>
          </div>
          <RecommendationGrid items={others} />
        </div>
      )}
    </section>
  );
}

function RecommendationGrid({ items }: { items: ProductRecommendation[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map(({ product, reason }) => {
        const discount = product.comparePrice ? calculateDiscount(product.comparePrice, product.price) : 0;
        return (
          <Link key={product.id} href={`/products/${product.slug}`}
            className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all duration-200">
            <div className="relative aspect-square bg-gray-50 overflow-hidden">
              {product.images?.[0]
                ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                : <div className="w-full h-full flex items-center justify-center text-5xl">📦</div>
              }
              {discount > 0 && (
                <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">-{discount}%</span>
              )}
              <div className="absolute bottom-2 left-2 right-2">
                <span className="inline-block bg-white/90 backdrop-blur text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-full">
                  {REASON_LABELS[reason] || '🔍 Related'}
                </span>
              </div>
            </div>
            <div className="p-3">
              {product.brand && <p className="text-[10px] text-brand-600 font-bold uppercase tracking-wider mb-0.5">{product.brand}</p>}
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">{product.name}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-black text-brand-700">{formatPrice(product.price)}</span>
                {product.comparePrice && (
                  <span className="text-xs text-gray-400 line-through">{formatPrice(product.comparePrice)}</span>
                )}
              </div>
              <div className={`mt-1.5 text-xs font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {product.stock > 0 ? `In Stock` : 'Out of Stock'}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
