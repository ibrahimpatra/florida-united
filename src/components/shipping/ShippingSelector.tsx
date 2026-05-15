'use client';
import { useState, useEffect, useCallback } from 'react';
import { Truck, MapPin, Check, Clock, Zap, Banknote } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { ShippingCalculationResult, ShippingOption } from '@/lib/shipping';

interface Props {
  orderAmount: number;
  orderWeightKg?: number;
  governorate?: string;
  lat?: number;
  lng?: number;
  onShippingSelected: (option: ShippingOption | null) => void;
  selectedOptionId?: string;
}

export function ShippingSelector({ orderAmount, orderWeightKg, governorate, lat, lng, onShippingSelected, selectedOptionId }: Props) {
  const [result, setResult] = useState<ShippingCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>(selectedOptionId || '');

  const calculate = useCallback(async () => {
    if (!governorate && !lat) return;
    setLoading(true);
    try {
      const res = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ governorate, lat, lng, orderAmount, orderWeightKg }),
      });
      const data = await res.json();
      setResult(data);
      if (data.defaultOption && !selected) {
        setSelected(data.defaultOption.rateId);
        onShippingSelected(data.defaultOption);
      }
    } catch {}
    setLoading(false);
  }, [governorate, lat, lng, orderAmount]);

  useEffect(() => { calculate(); }, [calculate]);

  const handleSelect = (opt: ShippingOption) => {
    setSelected(opt.rateId);
    onShippingSelected(opt);
  };

  if (loading) return (
    <div className="space-y-2">
      {[1,2].map(i => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
    </div>
  );

  if (!result?.options?.length) return (
    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 flex items-center gap-2">
      <Truck className="w-4 h-4" /><span>Select your governorate to see delivery options</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {result.amountToFreeShipping !== undefined && result.amountToFreeShipping > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Add <strong className="mx-1">{formatPrice(result.amountToFreeShipping)}</strong> more for FREE delivery!
        </div>
      )}

      <div className="space-y-2">
        {result.options.map(opt => (
          <button key={opt.rateId} type="button" onClick={() => handleSelect(opt)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${selected === opt.rateId ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${selected === opt.rateId ? 'bg-brand-500' : 'bg-gray-100'}`}>
              {selected === opt.rateId ? <Check className="w-4 h-4 text-white" /> : <Truck className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{opt.name}</span>
                {opt.badge && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${opt.isFree ? 'bg-green-100 text-green-700' : 'bg-brand-100 text-brand-700'}`}>
                    {opt.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{opt.estimatedDays} business day{opt.estimatedDays !== '1' ? 's' : ''}</span>
                {opt.carrier && <span className="text-xs text-gray-400">· {opt.carrier}</span>}
              </div>
            </div>
            <span className={`text-sm font-black flex-shrink-0 ${opt.isFree ? 'text-green-600' : 'text-gray-900'}`}>
              {opt.isFree ? 'FREE' : formatPrice(opt.price)}
            </span>
          </button>
        ))}

        {result.localPickupAvailable && (
          <button type="button" onClick={() => handleSelect({ rateId: 'local-pickup', zoneId: 'local', zoneName: 'Local', name: 'Store Pickup', estimatedDays: '0', price: 0, isFree: true, badge: 'FREE', method: 'local_pickup' })}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${selected === 'local-pickup' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selected === 'local-pickup' ? 'bg-brand-500' : 'bg-gray-100'}`}>
              {selected === 'local-pickup' ? <Check className="w-4 h-4 text-white" /> : <MapPin className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-900">Store Pickup</span>
              {result.localPickupAddress && <p className="text-xs text-gray-400 mt-0.5">{result.localPickupAddress}</p>}
            </div>
            <span className="text-sm font-black text-green-600">FREE</span>
          </button>
        )}
      </div>
    </div>
  );
}
