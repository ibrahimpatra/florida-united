'use client';
import { Truck, CheckCircle2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStoreSettings } from '@/lib/useStoreSettings';

/** "Add X KD more for free delivery" with a progress bar. `chargeable` = subtotal of items that do not already ship free. */
export function FreeShippingNudge({ chargeable, hidden }: { chargeable: number; hidden?: boolean }) {
  const { t } = useLanguage();
  const { freeShippingThreshold } = useStoreSettings();
  if (hidden || !freeShippingThreshold || freeShippingThreshold <= 0) return null;
  const left = Math.max(0, freeShippingThreshold - chargeable);
  const pct = Math.min(100, (chargeable / freeShippingThreshold) * 100);
  return (
    <div className={`rounded-xl p-3 text-xs ${left ? 'bg-brand-50 text-brand-800' : 'bg-green-50 text-green-800'}`}>
      <span className="flex items-center gap-1.5 font-medium">
        {left ? <Truck className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        {left ? t('c3_nudge.almost', { amount: formatPrice(left) }) : t('c3_nudge.unlocked')}
      </span>
      <div className="mt-2 h-1.5 rounded-full bg-white/80"><div className={`h-full rounded-full ${left ? 'bg-brand-600' : 'bg-green-600'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
