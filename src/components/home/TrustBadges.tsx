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
    <div className="container-custom mt-4 md:mt-6">
      <div className="bg-white rounded-3xl shadow-card border border-gray-100 px-4 py-3 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-1">
          {badges.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="flex items-center gap-3 py-2">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}><Icon className="w-4 h-4" /></div>
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
