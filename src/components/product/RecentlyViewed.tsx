'use client';
import { useEffect, useState } from 'react';
import Link from '@/components/ui/LocLink';
import { Clock, Package } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRecentStore } from '@/store/recentStore';
import { formatPrice } from '@/lib/utils';

/** Horizontal strip of products this shopper opened recently. `exclude` hides the page's own product. Renders nothing when empty. */
export function RecentlyViewed({ exclude, title }: { exclude?: string[]; title?: string }) {
  const { t, L } = useLanguage();
  const ids = useRecentStore(s => s.ids);
  const [items, setItems] = useState<any[]>([]);
  const want = ids.filter(i => !(exclude || []).includes(i)).slice(0, 10);
  const key = want.join(',');

  useEffect(() => {
    if (!key) { setItems([]); return; }
    let live = true;
    fetch(`/api/products/by-ids?ids=${encodeURIComponent(key)}`).then(r => r.json()).then(d => { if (live) setItems(d.items || []); }).catch(() => {});
    return () => { live = false; };
  }, [key]);

  if (!items.length) return null;
  return (
    <section className="mt-6 md:mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-brand-600" />
        <h2 className="text-xl font-bold text-gray-900">{title || t('c4_recent.title')}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
        {items.map(p => (
          <Link key={p.id} href={`/shop/products/${p.slug}`} className="snap-start flex-shrink-0 w-36 sm:w-44 bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md hover:border-brand-200 transition">
            <div className="aspect-square bg-gray-50">
              {p.images?.[0] ? <img src={p.images[0]} alt={L(p, 'name')} loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300" /></div>}
            </div>
            <div className="p-2.5">
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[2rem]">{L(p, 'name')}</p>
              <p className="text-sm font-black text-brand-700 mt-1">{formatPrice(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
