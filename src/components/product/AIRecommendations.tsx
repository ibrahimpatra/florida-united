'use client';
// AI-powered product recommendations — like Amazon / Noon / Carrefour Kuwait
import { useEffect, useState } from 'react';
import Link from '@/components/ui/LocLink';
import { Sparkles, Loader2, Package } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice, calculateDiscount } from '@/lib/utils';
import type { Product, ProductRecommendation } from '@/types';

interface Props {
  productId: string;
  currentCategory: string;
  /** comma separated ids (the whole cart) instead of one product */
  ids?: string;
}

const REASON_KEYS: Record<string, string> = {
  compatible: 'r_compatible', frequently_bought_together: 'r_fbt', same_category: 'r_same', similar_specs: 'r_specs',
};

export function AIRecommendations({ productId, currentCategory, ids }: Props) {
  const { t } = useLanguage();
  const [recs, setRecs] = useState<ProductRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/recommendations?${ids ? `ids=${encodeURIComponent(ids)}` : `productId=${productId}`}&limit=8`)
      .then(r => r.json())
      .then(data => {
        if (data.recommendations) setRecs(data.recommendations);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [productId, ids]);

  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">{t('c1_rec.finding')}</span>
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
            <h2 className="text-xl font-bold text-gray-900">{t('c1_rec.compatTitle')}</h2>
          </div>
          <RecommendationGrid items={compatibles} />
        </div>
      )}

      {others.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-gray-900">{t('c1_rec.alsoTitle')}</h2>
          </div>
          <RecommendationGrid items={others} />
        </div>
      )}
    </section>
  );
}

function RecommendationGrid({ items }: { items: ProductRecommendation[] }) {
  const { t, L, isArabic } = useLanguage();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((rec) => { const product = rec; const reason = rec.reason;
        const discount = product.comparePrice ? calculateDiscount(product.comparePrice, product.price) : 0;
        return (
          <Link key={product.id} href={`/shop/products/${product.slug}`}
            className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all duration-200">
            <div className="relative aspect-square bg-gray-50 overflow-hidden">
              {product.images?.[0]
                ? <img src={product.images[0]} alt={L(product as any, 'name')} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                : <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-300" /></div>
              }
              {discount > 0 && (
                <span className="absolute top-2 start-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{isArabic ? `${discount}%-` : `-${discount}%`}</span>
              )}
              <div className="absolute bottom-2 inset-x-2">
                <span className="inline-block bg-white/90 backdrop-blur text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-full">
                  {t(`c1_rec.${REASON_KEYS[reason ?? ''] || 'r_related'}`)}
                </span>
              </div>
            </div>
            <div className="p-3">
              {product.brand && <p className="text-[10px] text-brand-600 font-bold uppercase tracking-wider mb-0.5">{product.brand}</p>}
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">{L(product as any, 'name')}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-black text-brand-700">{formatPrice(product.price)}</span>
                {product.comparePrice && (
                  <span className="text-xs text-gray-400 line-through">{formatPrice(product.comparePrice)}</span>
                )}
              </div>
              <div className={`mt-1.5 text-xs font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {product.stock > 0 ? t('c1_rec.inStock') : t('c1_rec.oos')}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
