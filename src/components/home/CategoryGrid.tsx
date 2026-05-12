'use client';
import Link from 'next/link';

const categories = [
  { name: 'Electrical Supplies', slug: 'electrical', emoji: '⚡', count: '8,500+', color: 'from-blue-500 to-blue-700', light: 'bg-blue-50 hover:bg-blue-100' },
  { name: 'Hardware & Tools', slug: 'hardware', emoji: '🔧', count: '15,000+', color: 'from-gray-600 to-gray-800', light: 'bg-gray-50 hover:bg-gray-100' },
  { name: 'Safety Equipment', slug: 'safety', emoji: '🦺', count: '3,200+', color: 'from-orange-500 to-red-600', light: 'bg-orange-50 hover:bg-orange-100' },
  { name: 'Lighting', slug: 'lighting', emoji: '💡', count: '4,100+', color: 'from-yellow-500 to-amber-600', light: 'bg-yellow-50 hover:bg-yellow-100' },
  { name: 'Plumbing', slug: 'plumbing', emoji: '🚿', count: '5,600+', color: 'from-teal-500 to-teal-700', light: 'bg-teal-50 hover:bg-teal-100' },
  { name: 'Industrial', slug: 'industrial', emoji: '🏗', count: '7,600+', color: 'from-purple-600 to-purple-800', light: 'bg-purple-50 hover:bg-purple-100' },
  { name: 'Fasteners', slug: 'fasteners', emoji: '🔩', count: '12,000+', color: 'from-zinc-600 to-zinc-800', light: 'bg-zinc-50 hover:bg-zinc-100' },
  { name: 'Conduit & Fittings', slug: 'conduit', emoji: '🔌', count: '2,800+', color: 'from-indigo-500 to-indigo-700', light: 'bg-indigo-50 hover:bg-indigo-100' },
];

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={`/shop/${cat.slug}`}
          className={`group flex flex-col items-center text-center p-4 rounded-2xl border border-gray-100 ${cat.light} transition-all duration-200 hover:shadow-md hover:-translate-y-1`}
        >
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-2xl mb-3 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
            {cat.emoji}
          </div>
          <p className="text-xs font-bold text-gray-800 leading-tight mb-1">{cat.name}</p>
          <p className="text-xs text-gray-400">{cat.count} items</p>
        </Link>
      ))}
    </div>
  );
}
