'use client';
import { useState } from 'react';
import { Tag, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';

/** Coupon entry for the checkout summary. `subtotal` is the server's deal-aware subtotal. */
export function CouponBox({ subtotal, appliedAmount }: { subtotal: number; appliedAmount: number }) {
  const { t } = useLanguage();
  const { couponCode, setCoupon, removeCoupon, items } = useCartStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    const c = code.trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/coupons/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c, orderAmount: subtotal, items: items.map(i => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId, variantName: i.variantName })) }) });
      const d = await res.json();
      if (d.valid) { setCoupon(c, d.discount); setCode(''); toast.success(t('c3_ck.applied', { code: c })); }
      else toast.error(d.error || t('c3_ck.couponBad'));
    } catch { toast.error(t('c3_ck.couponFail')); }
    setBusy(false);
  };

  if (couponCode) return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 font-semibold text-green-800 min-w-0"><Check className="w-4 h-4 shrink-0" /><span className="truncate" dir="ltr">{couponCode}</span>
        {appliedAmount > 0 && <span className="font-normal">- {formatPrice(appliedAmount)}</span>}</span>
      <button type="button" onClick={removeCoupon} aria-label={t('c3_ck.remove')} className="text-green-700 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>
    </div>
  );
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5"><Tag className="w-3.5 h-3.5" />{t('c3_ck.couponTitle')}</label>
      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
          placeholder={t('c3_ck.couponPh')} dir="ltr" className="input-field text-sm py-2 flex-1 min-w-0" />
        <button type="button" onClick={apply} disabled={busy || !code.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">{busy ? '...' : t('c3_ck.apply')}</button>
      </div>
    </div>
  );
}
