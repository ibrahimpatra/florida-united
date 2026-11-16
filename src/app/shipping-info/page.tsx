'use client';
import { InfoPage } from '@/components/info/InfoPage';
import { SHIPPING } from '@/lib/legal-content';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { formatPrice } from '@/lib/utils';

export default function ShippingInfoPage() {
  const { freeShippingThreshold } = useStoreSettings();
  const c = SHIPPING(freeShippingThreshold ?? null, n => formatPrice(n));
  return <InfoPage title={c.title} intro={c.intro} sections={c.sections} />;
}
