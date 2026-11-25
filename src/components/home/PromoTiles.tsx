'use client';
import { useEffect, useState } from 'react';
import Link from '@/components/ui/LocLink';
import { useLanguage } from '@/contexts/LanguageContext';

/** Small clickable promo boxes on the home page (Clearance sale, New in, Bundles...). Managed in Admin > Promo Tiles. Hidden when there are none. */
export function PromoTiles() {
  const { L } = useLanguage();
  const [tiles, setTiles] = useState<any[]>([]);
  useEffect(() => { fetch('/api/promo-tiles').then(r => (r.ok ? r.json() : [])).then(d => setTiles(Array.isArray(d) ? d : [])).catch(() => {}); }, []);
  if (!tiles.length) return null;
  return (
    <section className="py-3" aria-label="Promotions">
      <div className="container-custom grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.slice(0, 12).map(t => (
          <Link key={t.id} href={t.link || '/shop'} className="group relative overflow-hidden rounded-2xl aspect-[4/3] text-white flex flex-col justify-end p-3 shadow-sm hover:shadow-lg transition-shadow" style={{ backgroundColor: t.color || '#b91c1c' }}>
            {t.image && <img src={t.image} alt={L(t, 'imageAlt')} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            {L(t, 'badge') && <span className="absolute top-2 start-2 rounded-md bg-white text-gray-900 text-[11px] font-extrabold px-2 py-0.5">{L(t, 'badge')}</span>}
            <span className="relative font-bold text-sm leading-tight">{L(t, 'title')}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
