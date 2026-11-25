'use client';
import { useCartStockCheck } from '@/lib/useCartStockCheck';
import { useDealPricing } from '@/lib/useDeals';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag, X, Truck, Lock } from 'lucide-react';
import Link from '@/components/ui/LocLink';
import { useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { AIRecommendations } from '@/components/product/AIRecommendations';
import { RecentlyViewed } from '@/components/product/RecentlyViewed';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export function CartPageClient() {
  const { items: allItems, removeItem, updateQuantity, getSubtotal, discountAmount, couponCode, setCoupon, removeCoupon } = useCartStore();
  const { t, L } = useLanguage();
  useCartStockCheck();
  const items = allItems.filter(i => !i.unavailable);   // sold-out lines are shown greyed out but never counted
  const { freeShippingThreshold } = useStoreSettings();
  const threshold = freeShippingThreshold ?? 0;
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const dp = useDealPricing(items);
  const subtotal = dp.subtotal;
  const allItemsFreeShip = items.length > 0 && items.every(i => (i as any).freeShipping);
  const mixed = !allItemsFreeShip && items.some(i => (i as any).freeShipping);
  // Items flagged free-shipping never count toward another item's free-delivery threshold.
  const chargeable = items.filter(i => !(i as any).freeShipping).reduce((s, i) => s + i.price * i.quantity, 0);
  const toFree = Math.max(0, threshold - chargeable);
  const total = Math.max(0, subtotal - discountAmount); // delivery is added at checkout (governorate-based)

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch('/api/coupons/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: couponInput, orderAmount: subtotal, items: items.map(i => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId, variantName: i.variantName })) }) });
      const data = await res.json();
      if (data.valid) { setCoupon(couponInput.toUpperCase(), data.discount); toast.success(data.discount > 0 ? t('c1_cart2.couponOk', { amount: formatPrice(data.discount) }) : t('c3_ck.applied', { code: couponInput.toUpperCase() })); setCouponInput(''); }
      else toast.error(data.error || t('c1_cart2.couponBad'));
    } catch { toast.error(t('c1_cart2.couponFail')); }
    setCouponLoading(false);
  };

  if (allItems.length === 0) return (
    <div className="container-custom py-20 text-center">
      <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-6" />
      <h2 className="text-2xl font-bold text-gray-900 mb-3 font-display">{t('c1_cart2.emptyTitle')}</h2>
      <p className="text-gray-500 mb-5">{t('c1_cart2.emptySub')}</p>
      <Link href="/shop" className="btn-primary">{t('c1_cart2.shopNow')}</Link>
    </div>
  );

  return (
    <div className="container-custom py-5">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 font-display flex items-center gap-3"><ShoppingBag className="w-7 h-7 text-brand-600"/>{t('c1_cart2.title')} <span className="text-base font-normal text-gray-500">({t('c1_cart2.items', { n: items.length })})</span></h1>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {allItems.map(item=>(
            <div key={`${item.productId}-${item.variantId}`} className={`card p-4 flex gap-4 ${item.unavailable ? 'opacity-60' : ''}`}>
              <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                {item.image && <img src={item.image} alt={L(item as any, 'name')} className="w-full h-full object-cover"/>}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={String(item.productId).startsWith('bundle:') ? (item.slug && item.slug !== 'bundles' ? `/shop/bundles/${item.slug}` : '/bundles') : `/shop/products/${item.slug}`} className="font-semibold text-gray-800 hover:text-brand-700 text-sm line-clamp-2">{L(item as any, 'name')}</Link>
                {item.variantName && <p className="text-xs text-gray-500 mt-0.5">{L(item as any, 'variantName')}</p>}
                <p className="text-xs text-gray-400 font-mono mt-0.5">{t('c1_cart2.sku')}: <span dir="ltr">{item.sku}</span></p>
                {item.unavailable && <p className="text-xs font-semibold text-red-600 mt-1">{t('c1_pd.oos')}</p>}
                <div className="flex items-center justify-between mt-3">
                  {item.unavailable ? <span /> : <div className="flex items-center gap-1.5">
                    <button onClick={()=>updateQuantity(item.productId,item.quantity-1,item.variantId)} className="w-7 h-7 rounded-lg border border-gray-200 hover:border-brand-300 flex items-center justify-center transition-colors"><Minus className="w-3 h-3"/></button>
                    <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                    <button onClick={()=>updateQuantity(item.productId,item.quantity+1,item.variantId)} disabled={item.quantity>=item.stock} className="w-7 h-7 rounded-lg border border-gray-200 hover:border-brand-300 flex items-center justify-center transition-colors disabled:opacity-40"><Plus className="w-3 h-3"/></button>
                  </div>}
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-brand-700 text-end">{(dp.lines.find(l => l.item === item)?.saving || 0) > 0 && <span className="block text-xs font-normal text-gray-400 line-through">{formatPrice(item.price*item.quantity)}</span>}{formatPrice(dp.lines.find(l => l.item === item)?.total ?? item.price*item.quantity)}</span>
                    <button onClick={()=>{removeItem(item.productId,item.variantId);toast.success(t('c1_cart2.removed'));}} aria-label={t('c1_cart2.removeAria')} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          {/* Coupon */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-brand-600"/>{t('c1_cart2.couponTitle')}</h3>
            {couponCode ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <span className="text-green-700 font-bold text-sm">{t('c1_cart2.couponSave', { code: couponCode || '', amount: formatPrice(discountAmount) })}</span>
                <button onClick={removeCoupon} className="text-green-600 hover:text-red-500"><X className="w-4 h-4"/></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={couponInput} onChange={e=>setCouponInput(e.target.value.toUpperCase())} placeholder={t('c1_cart2.couponPh')} dir="ltr" className="input-field text-sm py-2 flex-1" onKeyDown={e=>e.key==='Enter'&&applyCoupon()}/>
                <button onClick={applyCoupon} disabled={couponLoading} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {couponLoading?'...':t('c1_cart2.apply')}
                </button>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4">{t('checkout.orderSummary')}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600"><span>{t('cart.subtotal')} ({items.reduce((s,i)=>s+i.quantity,0)} {t('cart.items')})</span><span>{formatPrice(subtotal)}</span></div>
              {dp.saving>0 && <div className="flex justify-between text-green-600 font-medium"><span>{t('c2_deal.saving')}</span><span>-{formatPrice(dp.saving)}</span></div>}
              {discountAmount>0 && <div className="flex justify-between text-green-600 font-medium"><span>{t('c1_cart2.discountCode', { code: couponCode || '' })}</span><span>-{formatPrice(discountAmount)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>{t('cart.shipping')}</span>{allItemsFreeShip ? <span className="text-green-600 font-semibold">{t('cart.free')}</span> : <span className="text-xs text-gray-500 text-end">{t('cart2.deliveryAtCheckout')}</span>}</div>

              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-gray-900 text-base">
                <span>{t('cart.total')}</span><span className="text-brand-700 text-lg">{formatPrice(total)}</span>
              </div>
            </div>
            {mixed && <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{t('cart2.mixedNote')}</p>}
            {!allItemsFreeShip && threshold > 0 && toFree > 0 && (
              <div className="mt-4 bg-brand-50 rounded-xl p-3 text-xs text-brand-700">
                <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" />{t('checkout.addMoreForFree').replace('{amount}', formatPrice(toFree))}</span>
                <div className="mt-2 bg-brand-100 rounded-full h-2"><div className="bg-brand-600 h-full rounded-full" style={{width:`${Math.min((chargeable / threshold)*100,100)}%`}}/></div>
              </div>
            )}

            {items.length === 0 ? (
              <span className="btn-primary w-full mt-4 py-3 justify-center opacity-50 cursor-not-allowed">{t('cart.checkout')} <ArrowRight className="w-4 h-4 rtl:rotate-180"/></span>
            ) : (
            <Link href="/checkout" className="btn-primary w-full mt-4 py-3 justify-center">
              {t('cart.checkout')} <ArrowRight className="w-4 h-4 rtl:rotate-180"/>
            </Link>)}
            <Link href="/shop" className="block text-center text-sm text-brand-600 hover:text-brand-700 font-medium mt-3">{t('c1_cart2.continue')}</Link>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
              <Lock className="w-3.5 h-3.5" />{t('c1_cart2.secured')}
            </div>
          </div>
        </div>
      </div>
      <div className="container-custom pb-10"><h2 className="font-display text-lg font-bold text-gray-900 mb-1">{t('c3_nudge.alsoNeed')}</h2><AIRecommendations productId={(items[0] || allItems[0]).productId} ids={items.map(i => i.productId).filter(id => !String(id).startsWith('bundle:')).slice(0, 12).join(',')} currentCategory={((items[0] || allItems[0]) as any).categoryId || ''} /><RecentlyViewed exclude={items.map(i => i.productId)} /></div>
    </div>
  );
}
