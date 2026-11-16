'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/** Translated home-section heading. `k` is a c1_home key prefix: title key `${k}`, subtitle `${k}Sub`. */
export function SectionHeader({ k, href, sub = true }: { k: string; href: string; sub?: boolean }) {
  const { t } = useLanguage();
  const subKey = k === 'shopByCat' ? 'findWhat' : `${k}Sub`;
  return (
    <div className="flex items-center justify-between mb-8">
      <div><h2 className="section-title">{t(`c1_home.${k}`)}</h2>{sub && <p className="section-subtitle">{t(`c1_home.${subKey}`)}</p>}</div>
      <Link href={href} className="text-brand-500 font-semibold hover:text-brand-700 text-sm inline-flex items-center gap-1">{t('c1_home.viewAll')}<ArrowRight className="w-4 h-4 rtl:rotate-180" /></Link>
    </div>
  );
}
