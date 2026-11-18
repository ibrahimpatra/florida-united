'use client';
import { Truck, Check, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ShippingOption } from '@/lib/shipping';

export interface Quote {
  options: ShippingOption[];
  defaultOption?: ShippingOption;
  amountToFreeShipping?: number;
  allItemsFreeShipping: boolean;
  codFee: number;
  codAvailable: boolean;
  subtotal?: number;
  dealSaving?: number;
  lines?: any[];
  discount?: number;
  couponError?: string;
}

/** Purely presentational — the checkout page fetches the quote so there is ONE source of truth. */
export function ShippingSelector({ quote, loading, error, hasGovernorate, selectedRateId, onSelect, onRetry, hasMixedFreeItems }: {
  quote: Quote | null; loading: boolean; error: string | null; hasGovernorate: boolean;
  selectedRateId?: string; onSelect: (o: ShippingOption) => void; onRetry: () => void; hasMixedFreeItems: boolean;
}) {
  const { t, L } = useLanguage();

  if (!hasGovernorate) return (
    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 flex items-center gap-2">
      <Truck className="w-4 h-4 flex-shrink-0" /><span>{t('checkout.selectGovFirst')}</span>
    </div>
  );
  if (loading && !quote) return (
    <div className="flex items-center gap-2 text-sm text-gray-500 p-3"><Loader2 className="w-4 h-4 animate-spin" />{t('checkout.calculating')}</div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center justify-between gap-3">
      <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</span>
      <button type="button" onClick={onRetry} className="font-bold underline flex-shrink-0">{t('checkout.retry')}</button>
    </div>
  );
  if (!quote?.options.length) return null;

  return (
    <div className="space-y-2">
      {quote.amountToFreeShipping !== undefined && quote.amountToFreeShipping > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 flex items-center gap-2">
          <Truck className="w-4 h-4 flex-shrink-0" />
          {t('checkout.addMoreForFree').replace('{amount}', formatPrice(quote.amountToFreeShipping))}
        </div>
      )}
      {hasMixedFreeItems && !quote.allItemsFreeShipping && (
        <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{t('checkout.mixedCart')}</p>
      )}
      {quote.options.map(opt => {
        const on = selectedRateId === opt.rateId;
        return (
          <button key={opt.rateId} type="button" onClick={() => onSelect(opt)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-start ${on ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${on ? 'bg-brand-500' : 'bg-gray-100'}`}>
              {on ? <Check className="w-4 h-4 text-white" /> : <Truck className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{L(opt as any, 'name')}</div>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                <Clock className="w-3 h-3" />{opt.estimatedDays}{opt.carrier ? ` · ${opt.carrier}` : ''}
              </div>
            </div>
            <span className={`text-sm font-black flex-shrink-0 ${opt.isFree ? 'text-green-600' : 'text-gray-900'}`}>
              {opt.isFree ? t('checkout.free') : formatPrice(opt.price)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
