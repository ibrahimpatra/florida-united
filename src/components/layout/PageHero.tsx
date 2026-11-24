'use client';
import Link from '@/components/ui/LocLink';
import { Check, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { formatPrice } from '@/lib/utils';

function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  const { t } = useLanguage();
  return (
    <nav className="flex items-center flex-wrap gap-1.5 text-sm text-gray-500 mb-3" aria-label={t('c1_page.breadcrumb')}>
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />}
          {it.href ? <Link href={it.href} className="hover:text-brand-600">{it.label}</Link> : <span className="text-gray-800 font-medium">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function ShopHero() {
  const { t } = useLanguage();
  return (
    <div className="page-hero"><div className="container-custom">
      <Crumbs items={[{ label: t('c1_page.home'), href: '/' }, { label: t('c1_page.shop') }]} />
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 font-display">{t('c1_page.allProducts')}</h1>
      <p className="text-gray-500 mt-1">{t('c1_page.allSub')}</p>
    </div></div>
  );
}

export function CategoryHero({ cat, fallbackName }: { cat: any | null; fallbackName: string }) {
  const { t, L } = useLanguage();
  const name = cat ? L(cat, 'name') : fallbackName;
  return (
    <div className="page-hero"><div className="container-custom">
      <Crumbs items={[{ label: t('c1_page.home'), href: '/' }, { label: t('c1_page.shop'), href: '/shop' }, { label: name }]} />
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 font-display">{name}</h1>
      {cat && L(cat, 'description') && <p className="text-gray-500 mt-1">{L(cat, 'description')}</p>}
    </div></div>
  );
}

export function BrandHero({ brand }: { brand: any }) {
  const { t, L } = useLanguage();
  const name = L(brand, 'name');
  return (
    <div className="page-hero"><div className="container-custom">
      <Crumbs items={[{ label: t('c1_page.home'), href: '/' }, { label: name }]} />
      <div className="flex items-center gap-4">
        {brand.image && <img src={brand.image} alt={L(brand, 'imageAlt') || name} className="h-14 w-auto max-w-[140px] object-contain rounded-2xl bg-white border p-1.5 shadow-soft" />}
        <div><h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 font-display">{name}</h1>
          {L(brand, 'description') && <p className="text-gray-500 mt-1 max-w-2xl">{L(brand, 'description')}</p>}</div>
      </div>
    </div></div>
  );
}

export function DealsHero() {
  const { t } = useLanguage();
  const { freeShippingThreshold } = useStoreSettings();
  const chips = [freeShippingThreshold ? t('c1_page.dealsShip', { amount: formatPrice(freeShippingThreshold) }) : '', t('c1_page.dealsRet'), t('c1_page.dealsQ')].filter(Boolean);
  return (
    <div className="container-custom pt-3 md:pt-6">
      <div className="rounded-3xl md:rounded-[2rem] bg-gradient-to-br from-brand-800 to-brand-600 text-white py-10 md:py-14 px-5 text-center shadow-card">
        <h1 className="text-3xl md:text-4xl font-black font-display mb-2">{t('c1_page.dealsTitle')}</h1>
        <p className="text-brand-100 text-lg mb-6">{t('c1_page.dealsSub')}</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          {chips.map(b => <span key={b} className="flex items-center gap-1.5 bg-white/20 px-4 py-2 rounded-full font-medium"><Check className="w-4 h-4" />{b}</span>)}
        </div>
      </div>
    </div>
  );
}

export function SearchHero({ q }: { q: string }) {
  const { t } = useLanguage();
  return (
    <div className="page-hero"><div className="container-custom">
      <h1 className="text-2xl font-bold text-gray-900 font-display">
        {q ? <>{t('c1_page.searchFor')} &quot;<span className="text-brand-600">{q}</span>&quot;</> : t('c1_page.searchTitle')}
      </h1>
    </div></div>
  );
}
