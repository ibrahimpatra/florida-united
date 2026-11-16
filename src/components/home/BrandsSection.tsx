'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export function BrandsSection({ brands }: { brands: string[] }) {
  const { t } = useLanguage();
  if (!brands.length) return null;
  return (
    <section className="py-10 bg-gray-50 border-y border-gray-100">
      <div className="container-custom">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">{t('c1_home.brands')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {brands.map(b => (
            <span key={b} dir="ltr" className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 shadow-sm">{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
