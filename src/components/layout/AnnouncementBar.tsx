'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { formatPrice } from '@/lib/utils';

export function AnnouncementBar() {
  const { t } = useLanguage();
  const { freeShippingThreshold } = useStoreSettings();
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="hazard-edge bg-brand-900 text-white text-xs py-2.5 px-10 pb-3 text-center">
      <span>{freeShippingThreshold ? t('c1_home.announceShip', { amount: formatPrice(freeShippingThreshold) }) : t('c1_home.announceGen')}</span>
      <Link href="/deals" className="underline font-bold text-accent-400 hover:text-accent-200 mx-2">{t('c1_home.shopDeals')}</Link>
      <button onClick={() => setVisible(false)} className="absolute end-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded" aria-label={t('c1_home.dismiss')}>
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
