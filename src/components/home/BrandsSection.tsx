'use client';
import Link from '@/components/ui/LocLink';
import { useLanguage } from '@/contexts/LanguageContext';

export interface HomeBrand { name: string; nameAr?: string; slug: string; image?: string; imageAlt?: string; imageAltAr?: string }

export function BrandsSection({ brands }: { brands: HomeBrand[] }) {
  const { t, L } = useLanguage();
  if (!brands.length) return null;
  return (
    <section className="py-10 bg-gray-50 border-y border-gray-100">
      <div className="container-custom">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">{t('c1_home.brands')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {brands.map(b => (
            <Link key={b.slug} href={`/brands/${b.slug}`} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 shadow-sm hover:border-brand-300 hover:text-brand-700 flex items-center gap-2">
              {b.image && <img src={b.image} alt={L(b, 'imageAlt') || b.name} loading="lazy" className="h-7 w-auto max-w-[90px] object-contain" />}
              <span dir="ltr">{L(b, 'name')}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
