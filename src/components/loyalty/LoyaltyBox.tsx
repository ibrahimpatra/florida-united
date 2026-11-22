'use client';
import { Gift } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';
import { redeemPlan, earnPoints } from '@/lib/loyalty-core';
import { useLoyalty } from './useLoyalty';

/** Checkout: "Use my points" switch. `payable` = goods total after deals and coupon. Reports the points to spend (0 when off). */
export function LoyaltyBox({ payable, use, onChange }: { payable: number; use: boolean; onChange: (use: boolean, plan: { points: number; discount: number }) => void }) {
  const { t, isArabic } = useLanguage();
  const info = useLoyalty();
  if (!info?.enabled || !info.settings) return null;
  const s = info.settings; const bal = info.points || 0;
  const plan = redeemPlan(s, bal, bal, payable);
  const earn = earnPoints(s, Math.max(0, payable - (use ? plan.discount : 0)), 0);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm mb-4">
      <div className="flex items-center gap-2 font-bold text-amber-900"><Gift className="w-4 h-4" />{t('c4_loy.title')}{info.tier ? <span className="text-xs font-semibold bg-amber-200 rounded-full px-2 py-0.5">{isArabic && info.tier.nameAr ? info.tier.nameAr : info.tier.name}</span> : null}</div>
      <p className="text-amber-900/80 mt-1">{t('c4_loy.balance', { points: bal, value: formatPrice(info.valueKwd || 0) })}</p>
      {plan.points > 0 ? (
        <label className="mt-2 flex items-center gap-2 cursor-pointer font-semibold text-gray-900">
          <input type="checkbox" checked={use} onChange={e => onChange(e.target.checked, plan)} className="w-4 h-4 accent-amber-600" />
          {t('c4_loy.use', { points: plan.points, value: formatPrice(plan.discount) })}
        </label>
      ) : bal > 0 ? <p className="mt-1 text-xs text-amber-900/70">{t('c4_loy.min', { n: s.minRedeem })}</p> : null}
      {earn > 0 && <p className="mt-1 text-xs text-amber-900/70">{t('c4_loy.willEarn', { n: earn })}</p>}
    </div>
  );
}
