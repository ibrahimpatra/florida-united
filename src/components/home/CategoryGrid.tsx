'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Category } from '@/types';

const FALLBACK_ICONS: Record<string, string> = {
  electrical: '⚡', hardware: '🔧', safety: '🦺', lighting: '💡',
  plumbing: '🚿', industrial: '🏗', fasteners: '🔩', conduit: '🔌',
  tools: '🛠', hvac: '❄️', paints: '🎨', cleaning: '🧹',
};

const GRADIENTS = [
  'from-blue-500 to-blue-700', 'from-gray-600 to-gray-800',
  'from-orange-500 to-red-600', 'from-yellow-500 to-amber-600',
  'from-teal-500 to-teal-700', 'from-purple-600 to-purple-800',
  'from-zinc-600 to-zinc-800', 'from-indigo-500 to-indigo-700',
  'from-green-500 to-green-700', 'from-pink-500 to-pink-700',
];
const LIGHT_BG = [
  'bg-blue-50 hover:bg-blue-100', 'bg-gray-50 hover:bg-gray-100',
  'bg-orange-50 hover:bg-orange-100', 'bg-yellow-50 hover:bg-yellow-100',
  'bg-teal-50 hover:bg-teal-100', 'bg-purple-50 hover:bg-purple-100',
  'bg-zinc-50 hover:bg-zinc-100', 'bg-indigo-50 hover:bg-indigo-100',
  'bg-green-50 hover:bg-green-100', 'bg-pink-50 hover:bg-pink-100',
];

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
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
        No categories yet — add some in the admin panel.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {categories.map((cat, idx) => {
        const gradient = GRADIENTS[idx % GRADIENTS.length];
        const lightBg  = LIGHT_BG[idx % LIGHT_BG.length];
        const icon     = cat.icon || FALLBACK_ICONS[cat.slug] || '📦';
        const count    = cat.productCount ? `${cat.productCount.toLocaleString()}+` : null;

        return (
          <Link
            key={cat.id}
            href={`/shop/${cat.slug}`}
            className={`group flex flex-col items-center text-center p-4 rounded-2xl border border-gray-100 ${lightBg} transition-all duration-200 hover:shadow-md hover:-translate-y-1`}
          >
            {cat.image ? (
              <div className="w-14 h-14 rounded-2xl overflow-hidden mb-3 shadow-sm group-hover:scale-110 transition-transform duration-200 bg-white">
                <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl mb-3 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                {icon}
              </div>
            )}
            <p className="text-xs font-bold text-gray-800 leading-tight mb-1">{cat.name}</p>
            {count && <p className="text-xs text-gray-400">{count} items</p>}
          </Link>
        );
      })}
    </div>
  );
}
