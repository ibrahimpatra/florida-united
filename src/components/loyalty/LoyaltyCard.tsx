'use client';
import Link from 'next/link';
import { Gift, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';
import { useLoyalty } from './useLoyalty';

/** Account home: a small tile that opens the rewards page. Hidden while the programme is off. Nobody is enrolled by seeing it. */
export function LoyaltyCard() {
  const { isArabic } = useLanguage();
  const info = useLoyalty();
  if (!info?.enabled || !info.settings) return null;
  return (
    <Link href="/account/loyalty" className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 mb-8 hover:border-brand-300 transition-colors">
      <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Gift className="w-5 h-5" /></div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm">{isArabic ? 'المكافآت' : 'Rewards'}</p>
        <p className="text-xs text-gray-500">{info.joined ? `${info.points || 0} ${isArabic ? 'نقطة' : 'points'} · ${formatPrice(info.valueKwd || 0)}` : (isArabic ? 'انضم واكسب نقاطاً على كل طلب' : 'Join and earn points on every order')}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 rtl:rotate-180" />
    </Link>
  );
}
