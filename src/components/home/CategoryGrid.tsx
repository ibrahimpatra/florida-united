'use client';
import { useState, useEffect } from 'react';
import { cachedJson } from '@/lib/client-cache';
import Link from '@/components/ui/LocLink';
import { Package } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Category } from '@/types';

const GRADIENTS = [
  'from-brand-500 to-brand-700', 'from-gray-600 to-gray-800',
  'from-orange-500 to-red-600', 'from-yellow-500 to-amber-600',
  'from-teal-500 to-teal-700', 'from-purple-600 to-purple-800',
  'from-zinc-600 to-zinc-800', 'from-indigo-500 to-indigo-700',
  'from-green-500 to-green-700', 'from-pink-500 to-pink-700',
];
const LIGHT_BG = [
  'bg-brand-50 hover:bg-brand-100', 'bg-gray-50 hover:bg-gray-100',
  'bg-orange-50 hover:bg-orange-100', 'bg-yellow-50 hover:bg-yellow-100',
  'bg-teal-50 hover:bg-teal-100', 'bg-purple-50 hover:bg-purple-100',
  'bg-zinc-50 hover:bg-zinc-100', 'bg-indigo-50 hover:bg-indigo-100',
  'bg-green-50 hover:bg-green-100', 'bg-pink-50 hover:bg-pink-100',
];

function CategorySkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-4 lg:grid-cols-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center p-4 rounded-2xl border border-gray-100 bg-gray-50 animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-gray-200 mb-3" />
          <div className="h-3 w-16 bg-gray-200 rounded mb-1" />
          <div className="h-2 w-10 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function CategoryGrid() {
  const { t, L } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedJson<Category[]>('/api/categories')
      .then((cats: Category[]) => {
        setCategories(cats.filter(c => c.isActive && !c.parentId && (c.showOnHome ?? true)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <CategorySkeleton />;

  if (categories.length === 0) {
    return (
      <p className="text-sm text-gray-400 col-span-full text-center py-8">
        {t('c1_home.noCats')}
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x -mx-4 px-4 pb-2 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-4 lg:grid-cols-8">
      {categories.map((cat, idx) => {
        const gradient = GRADIENTS[idx % GRADIENTS.length];
        const lightBg  = LIGHT_BG[idx % LIGHT_BG.length];
        const count    = cat.productCount ? cat.productCount : null;

        return (
          <Link
            key={cat.id}
            href={`/shop/${cat.slug}`}
            className="group snap-start shrink-0 w-[6.75rem] md:w-auto flex flex-col items-center text-center p-3 md:p-4 rounded-3xl bg-white border border-gray-100 shadow-soft transition-all duration-200 hover:shadow-hover hover:-translate-y-1"
          >
            {cat.image ? (
              <div className="w-14 h-14 rounded-full overflow-hidden mb-2.5 shadow-sm group-hover:scale-110 transition-transform duration-200 bg-white">
                <img src={cat.image} alt={L(cat, 'name')} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center mb-2.5 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                <Package className="w-7 h-7 text-white" />
              </div>
            )}
            <p className="text-xs font-bold text-gray-800 leading-tight mb-1">{L(cat, 'name')}</p>
            {count && <p className="text-xs text-gray-400">{t('c1_home.items', { n: count })}</p>}
          </Link>
        );
      })}
    </div>
  );
}
