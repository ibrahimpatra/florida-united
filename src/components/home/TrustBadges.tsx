'use client';
import { Truck, ShieldCheck, RotateCcw, Headphones, BadgeCheck, PackageCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { formatPrice } from '@/lib/utils';

export function TrustBadges() {
  const { t } = useLanguage();
  const { freeShippingThreshold } = useStoreSettings();
  const badges = [
    { icon: Truck, title: t('c1_home.tbShip'), desc: freeShippingThreshold ? t('c1_home.tbShipDesc', { amount: formatPrice(freeShippingThreshold) }) : t('c1_home.tbShipDescNone'), color: 'text-brand-800 bg-accent-100' },
    { icon: ShieldCheck, title: t('c1_home.tbSecure'), desc: t('c1_home.tbSecureDesc'), color: 'text-brand-800 bg-accent-100' },
    { icon: RotateCcw, title: t('c1_home.tbReturns'), desc: t('c1_home.tbReturnsDesc'), color: 'text-brand-800 bg-accent-100' },
    { icon: Headphones, title: t('c1_home.tbSupport'), desc: t('c1_home.tbSupportDesc'), color: 'text-brand-800 bg-accent-100' },
    { icon: BadgeCheck, title: t('c1_home.tbGenuine'), desc: t('c1_home.tbGenuineDesc'), color: 'text-brand-800 bg-accent-100' },
    { icon: PackageCheck, title: t('c1_home.tbFast'), desc: t('c1_home.tbFastDesc'), color: 'text-brand-800 bg-accent-100' },
  ];
  return (
    <div className="bg-white border-b border-gray-100">
      <div className="container-custom py-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {badges.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="flex items-center gap-3 py-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}><Icon className="w-4 h-4" /></div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 leading-tight">{title}</p>
                <p className="text-xs text-gray-500 leading-tight">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
