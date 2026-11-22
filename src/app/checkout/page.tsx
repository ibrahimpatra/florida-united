'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShippingSelector, type Quote } from '@/components/shipping/ShippingSelector';
import { CouponBox } from '@/components/checkout/CouponBox';
import { KuwaitCheckoutForm } from '@/components/checkout/KuwaitCheckoutForm';
import { CheckoutSuggestions } from '@/components/checkout/CheckoutSuggestions';
import { FreeShippingNudge } from '@/components/cart/FreeShippingNudge';
import { Lock, ShoppingBag } from 'lucide-react';
import { useLoyalty as useLoyaltyInfo } from '@/components/loyalty/useLoyalty';
import { redeemPlan } from '@/lib/loyalty-core';
import { LoyaltyBox } from '@/components/loyalty/LoyaltyBox';
import { QtyStepper } from '@/components/cart/QtyStepper';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ShippingOption } from '@/lib/shipping';

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const { items, discountAmount, couponCode, updateQuantity } = useCartStore();
  const { t, L } = useLanguage();
  const [governorate, setGovernorate] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [rateId, setRateId] = useState<string | undefined>();
  const [serverSubtotal, setServerSubtotal] = useState<number | null>(null);
  const reqId = useRef(0);

  // Stable key: refetch only when ids/quantities/governorate change.
  const itemsKey = useMemo(() => items.map(i => `${i.productId}:${i.variantId || ''}:${i.quantity}`).join('|') + '|' + (couponCode || ''), [items, couponCode]);

  const fetchQuote = useCallback(async () => {
    if (!governorate || !items.length) { setQuote(null); setQuoteError(null); return; }
    const my = ++reqId.current;
    setQuoteLoading(true); setQuoteError(null);
    try {
      const res = await fetch('/api/shipping/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ governorate, couponCode: couponCode || undefined, items: items.map(i => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId, variantName: i.variantName })) }),
      });
      const data = await res.json().catch(() => null);
      if (my !== reqId.current) return;
      if (!res.ok || !data?.options) throw new Error(data?.error || t('checkout.quoteFailed'));
      setQuote(data); setServerSubtotal(data.subtotal ?? null);
      // keep the customer's choice if still offered, else take the cheapest
      setRateId(prev => data.options.some((o: ShippingOption) => o.rateId === prev) ? prev : data.defaultOption?.rateId);
    } catch (e: any) {
      if (my !== reqId.current) return;
      setQuote(null); setRateId(undefined); setQuoteError(e?.message || t('checkout.quoteFailed'));
    }
    if (my === reqId.current) setQuoteLoading(false);
  }, [governorate, itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  const clientSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const subtotal = serverSubtotal ?? clientSubtotal;
  const chosen = quote?.options.find(o => o.rateId === rateId) || quote?.defaultOption || null;
  const shippingCost = chosen?.price ?? 0;
  // Once the server has quoted, its coupon figure is the truth (it is what placeOrder will charge).
  const discount = quote ? (quote.discount ?? 0) : discountAmount;
  const dealSaving = quote ? Number((quote as any).dealSaving || 0) : 0;
  const [useLoyalty, setUseLoyalty] = useState(false);
  const goodsAfterDiscount = Math.max(0, subtotal - discount);
  const loyaltyPlan = useLoyaltyPlan(goodsAfterDiscount, useLoyalty);
  const total = Math.round(Math.max(0, subtotal - discount - loyaltyPlan.discount + shippingCost) * 1000) / 1000;
  const hasMixedFreeItems = items.some(i => i.freeShipping) && items.some(i => !i.freeShipping);

  if (status === 'loading') return <><Header /><div className="container-custom py-20 text-center text-gray-400">{t('c2_chk.loading')}</div><Footer /></>;

  if (!session) return (
    <><Header />
    <div className="container-custom py-20 text-center">
      <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-800 mb-2">{t('checkout.signInTitle')}</h2>
      <Link href="/auth/login?callbackUrl=/checkout" className="btn-primary mt-2">{t('checkout.signInBtn')}</Link>
    </div><Footer /></>
  );

  if (!items.length) return (
    <><Header />
    <div className="container-custom py-20 text-center">
      <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-800 mb-2">{t('checkout.emptyCart')}</h2>
      <Link href="/shop" className="btn-primary mt-2">{t('checkout.continueShopping')}</Link>
    </div><Footer /></>
  );

  return (
    <><Header />
    <div className="container-custom py-6 md:py-10 max-w-6xl">
      <h1 className="text-2xl font-black text-gray-900 mb-6 md:mb-8">{t('checkout.title')}</h1>
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-10">
        <div>
          <KuwaitCheckoutForm
            items={items}
            governorate={governorate}
            onGovernorateChange={setGovernorate}
            rateId={chosen?.rateId}
            quoteReady={!!chosen && !quoteLoading}
            codFee={quote?.codFee ?? 0}
            total={total}
            couponCode={couponCode ?? undefined}
            redeemPoints={loyaltyPlan.points}
            userEmail={session.user.email || ''}
            shippingSlot={
              <ShippingSelector quote={quote} loading={quoteLoading} error={quoteError} hasGovernorate={!!governorate}
                selectedRateId={rateId} onSelect={o => setRateId(o.rateId)} onRetry={fetchQuote} hasMixedFreeItems={hasMixedFreeItems} />
            }
          />
        </div>

        <div className="lg:sticky lg:top-24 space-y-4 h-fit order-first lg:order-none">
          <div className="bg-gray-50 rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 mb-4">{t('checkout.orderSummary')} ({items.length})</h3>
            <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
              {items.map(item => (
                <div key={item.id + (item.variantId || '')} className="flex gap-3 items-center">
                  <Link href={`/p/${encodeURIComponent(item.productId || item.id)}`} className="w-12 h-12 bg-white rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 block">
                    {item.image ? <img src={item.image} alt={L(item as any, 'name')} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-gray-300" /></div>}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{L(item as any, 'name')}</p>
                    {item.variantName && <p className="text-xs text-gray-400">{L(item as any, 'variantName')}</p>}
                    <div className="mt-1"><QtyStepper size="sm" qty={item.quantity} max={item.stock || 999} onChange={q => updateQuantity(item.productId, q, item.variantId)} /></div>
                  </div>
                  {(() => {
                    const ql = (quote as any)?.lines?.find((l: any) => l.productId === item.productId && (l.variantId || '') === (item.variantId || ''));
                    const now = ql ? ql.total : item.price * item.quantity;
                    const was = ql && ql.listPrice > ql.price ? ql.listPrice * item.quantity : 0;
                    return <span className="text-sm font-bold text-gray-900 flex-shrink-0 text-end">{was > 0 && <span className="block text-xs font-normal text-gray-400 line-through">{formatPrice(was)}</span>}{formatPrice(now)}</span>;
                  })()}
                </div>
              ))}
            </div>
            <div className="mb-3"><FreeShippingNudge chargeable={items.filter(i => !i.freeShipping).reduce((a, i) => a + i.price * i.quantity, 0)} hidden={items.length > 0 && items.every(i => i.freeShipping)} /></div>
            <CheckoutSuggestions />
            <div className="mb-4 mt-4"><CouponBox subtotal={subtotal} appliedAmount={discount} /></div>
            <LoyaltyBox payable={goodsAfterDiscount} use={useLoyalty} onChange={setUseLoyalty} />
            <div className="border-t pt-3 space-y-2 text-sm">
              {dealSaving > 0 && <div className="flex justify-between text-gray-600"><span>{t('c3_ck.listSubtotal')}</span><span>{formatPrice(subtotal + dealSaving)}</span></div>}
              {dealSaving > 0 && <div className="flex justify-between text-green-600"><span>{t('c3_ck.offerSaving')}</span><span>-{formatPrice(dealSaving)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>{t('checkout.subtotal')}</span><span>{formatPrice(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>{t('c3_ck.couponLine', { code: couponCode || '' })}</span><span>-{formatPrice(discount)}</span></div>}
              {loyaltyPlan.discount > 0 && <div className="flex justify-between text-green-600"><span>{t('c4_loy.title')} ({loyaltyPlan.points})</span><span>-{formatPrice(loyaltyPlan.discount)}</span></div>}
              {quote?.couponError && <p className="text-xs text-red-600">{quote.couponError}</p>}
              <div className="flex justify-between text-gray-600">
                <span>{t('checkout.shipping')}</span>
                <span>{chosen ? (chosen.isFree ? <span className="text-green-600 font-semibold">{t('checkout.free')}</span> : formatPrice(chosen.price)) : '-'}</span>
              </div>
              <div className="flex justify-between font-black text-gray-900 text-base border-t pt-2">
                <span>{t('checkout.total')}</span><span className="text-brand-700">{chosen ? formatPrice(total) : '-'}</span>
              </div>
              {dealSaving + discount > 0 && <p className="text-xs font-semibold text-green-700 bg-green-50 rounded-lg px-3 py-2 text-center">{t('c3_ck.saved', { amount: formatPrice(dealSaving + discount) })}</p>}
              <p className="text-xs text-gray-400 text-center">{t('checkout.noVat')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Footer /></>
  );
}

/** Points that will be spent (0 when the switch is off), using the same rules as the server. */
function useLoyaltyPlan(payable: number, on: boolean) {
  const info = useLoyaltyInfo();
  if (!on || !info?.enabled || !info.settings) return { points: 0, discount: 0 };
  return redeemPlan(info.settings, info.points || 0, info.points || 0, payable);
}
