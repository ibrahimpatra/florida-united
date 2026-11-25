'use client';
import Link from '@/components/ui/LocLink';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/** Translated home-section heading. `k` is a c1_home key prefix: title key `${k}`, subtitle `${k}Sub`. */
export function SectionHeader({ k, href, sub = true }: { k: string; href: string; sub?: boolean }) {
  const { t } = useLanguage();
  const subKey = k === 'shopByCat' ? 'findWhat' : k === 'newArrivals' ? 'newSub' : `${k}Sub`;
  return (
    <div className="flex items-end justify-between gap-3 mb-4 md:mb-5">
      <div><h2 className="section-title">{t(`c1_home.${k}`)}</h2>{sub && <p className="section-subtitle">{t(`c1_home.${subKey}`)}</p>}</div>
      <Link href={href} className="shrink-0 text-brand-700 font-semibold hover:bg-brand-50 text-sm inline-flex items-center gap-1 px-3 py-1.5 rounded-full">{t('c1_home.viewAll')}<ArrowRight className="w-4 h-4 rtl:rotate-180" /></Link>
    </div>
  );
}
