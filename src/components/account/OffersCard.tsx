'use client';
import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/utils';

/** Coupons picked for this customer's group (new, returning, VIP…). Shows nothing when there are none. */
export function OffersCard() {
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { fetch('/api/account/offers', { cache: 'no-store' }).then(r => r.json()).then(d => setItems(Array.isArray(d.items) ? d.items : [])).catch(() => {}); }, []);
  if (!items.length) return null;
  const text = (c: any) => c.type === 'percentage' ? t('offers.pct', { n: c.value }) : c.type === 'fixed' ? t('offers.fixed', { n: Number(c.value).toFixed(3) })
    : c.type === 'free_shipping' ? t('offers.freeShip') : t('offers.bxgy', { b: c.buyQty, g: c.getQty });
  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); toast.success(t('offers.copied')); } catch { /* clipboard blocked: the code is on screen */ } };
  return (
    <div className="card p-4 mb-6">
      <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-brand-600" />{t('offers.title')}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(c => (
          <button key={c.code} type="button" onClick={() => copy(c.code)} className="text-start rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-3 hover:bg-brand-50">
            <p className="font-bold text-gray-900">{text(c)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('offers.code')} <span className="font-mono font-bold text-brand-700" dir="ltr">{c.code}</span></p>
            <p className="text-[11px] text-gray-400 mt-1">{[c.minOrderAmount > 0 ? t('offers.minOrder', { n: Number(c.minOrderAmount).toFixed(3) }) : '', c.expiresAt ? t('offers.until', { date: formatDate(c.expiresAt) }) : ''].filter(Boolean).join(' · ')}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
