'use client';
import { Gift } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice, formatDate } from '@/lib/utils';
import { useLoyalty } from './useLoyalty';

/** Account page: balance, tier, how it works and the last movements. Hidden while the programme is off. */
export function LoyaltyCard() {
  const { t, isArabic } = useLanguage();
  const info = useLoyalty();
  if (!info?.enabled || !info.settings) return null;
  const s = info.settings;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Gift className="w-5 h-5" /></div>
          <div>
            <p className="text-sm text-gray-500">{t('c4_loy.title')}{info.tier ? ` · ${isArabic && info.tier.nameAr ? info.tier.nameAr : info.tier.name}` : ''}</p>
            <p className="text-2xl font-black text-gray-900">{info.points || 0} <span className="text-sm font-semibold text-gray-500">{t('c4_loy.pts')}</span></p>
          </div>
        </div>
        <p className="text-sm text-gray-600">{t('c4_loy.worth', { value: formatPrice(info.valueKwd || 0) })}</p>
      </div>
      <p className="text-xs text-gray-500 mt-3">{t('c4_loy.how', { earn: s.earnPerKwd, per: Math.round(1 / s.pointValueKwd), pct: s.maxRedeemPct })}</p>
      {info.next && <p className="text-xs text-amber-800 mt-1">{t('c4_loy.next', { name: isArabic && info.next.nameAr ? info.next.nameAr : info.next.name, amount: formatPrice(info.next.minSpent) })}</p>}
      {info.history?.length ? (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {info.history.slice(0, 6).map((h: any) => (
            <li key={h.id} className="py-1.5 flex justify-between gap-3"><span className="text-gray-600 truncate">{h.note} <span className="text-gray-400">· {formatDate(h.createdAt)}</span></span><b className={h.points > 0 ? 'text-green-600' : 'text-red-600'}>{h.points > 0 ? '+' : ''}{h.points}</b></li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
