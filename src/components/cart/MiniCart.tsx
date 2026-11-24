'use client';
import { useDealPricing } from '@/lib/useDeals';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Truck, CheckCircle2 } from 'lucide-react';
import Link from '@/components/ui/LocLink';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStoreSettings } from '@/lib/useStoreSettings';

interface Props { isOpen: boolean; onClose: () => void; }

export function MiniCart({ isOpen, onClose }: Props) {
  const { t, L, dir } = useLanguage();
  const { freeShippingThreshold, defaultShippingCost } = useStoreSettings();
  const { items, removeItem, updateQuantity, getSubtotal, discountAmount } = useCartStore();

  const dp = useDealPricing(items);
  const subtotal = dp.subtotal;
  const th = freeShippingThreshold;
  const allItemsFreeShip = items.length > 0 && items.every(i => (i as any).freeShipping);
  const qualifies = allItemsFreeShip || (th !== null && th !== undefined && subtotal >= th);
  const shipping = qualifies ? 0 : defaultShippingCost;
  const count = items.reduce((s, i) => i.unavailable ? s : s + i.quantity, 0);

  return (
    <div dir={dir}>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-[90]" onClick={onClose} />}
      <div aria-hidden={!isOpen} className={`fixed end-0 top-0 h-full w-full max-w-sm bg-white z-[95] flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0 shadow-2xl' : 'ltr:translate-x-full rtl:-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-700" />
            <span className="font-bold text-gray-900 font-display">{t('c1_cart.myCart')}</span>
            {count > 0 && <span className="min-w-5 h-5 px-1 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center font-bold">{count}</span>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label={t('c1_cart.close')}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <ShoppingBag className="w-14 h-14 text-gray-300 mb-4" />
              <p className="text-gray-600 font-semibold mb-2">{t('c1_cart.empty')}</p>
              <p className="text-gray-400 text-sm mb-6">{t('c1_cart.emptySub')}</p>
              <button onClick={onClose} className="btn-primary text-sm px-5 py-2.5">{t('c1_cart.browse')}</button>
            </div>
          ) : items.map(item => (
            <div key={`${item.productId}-${item.variantId}`} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                {item.image && <img src={item.image} alt={L(item as any, 'name')} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/shop/products/${item.slug}`} onClick={onClose} className="text-sm font-semibold text-gray-800 hover:text-brand-700 line-clamp-2 block">{L(item as any, 'name')}</Link>
                {item.variantName && <p className="text-xs text-gray-500 mt-0.5">{L(item as any, 'variantName')}</p>}
                <p className="text-xs text-gray-400">{t('c1_cart.sku')}: <span dir="ltr">{item.sku}</span></p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)} className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"><Minus className="w-3 h-3" /></button>
                    <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)} disabled={item.quantity >= item.stock} className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors disabled:opacity-40"><Plus className="w-3 h-3" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-700">{formatPrice(dp.lines.find(l => l.item === item)?.total ?? item.price * item.quantity)}</span>
                    <button onClick={() => removeItem(item.productId, item.variantId)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" aria-label={t('c1_cart.remove')}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {th ? (qualifies ? (
              <div className="bg-green-50 rounded-lg px-3 py-2 text-xs text-green-700 font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{t('c1_cart.qualify')}</div>
            ) : (
              <div className="bg-brand-50 rounded-lg px-3 py-2 text-xs text-brand-700">
                <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" />{t('c1_cart.addMore', { amount: formatPrice(th - subtotal) })}</span>
                <div className="mt-1.5 bg-brand-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-brand-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((subtotal / th) * 100, 100)}%` }} />
                </div>
              </div>
            )) : null}

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>{t('c1_cart.subtotal')}</span><span>{formatPrice(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>{t('c1_cart.discount')}</span><span>-{formatPrice(discountAmount)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>{t('c1_cart.shipping')}</span><span>{shipping === 0 ? <span className="text-green-600 font-semibold">{t('c1_cart.free')}</span> : formatPrice(shipping)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200 text-base"><span>{t('c1_cart.total')}</span><span className="text-brand-700">{formatPrice(subtotal - discountAmount + shipping)}</span></div>
              <p className="text-xs text-gray-400">{t('c1_cart.finalAtCheckout')}</p>
            </div>

            <div className="space-y-2">
              <Link href="/checkout" onClick={onClose} className="flex items-center justify-center gap-2 w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-colors shadow-md">
                {t('c1_cart.checkout')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
              <Link href="/cart" onClick={onClose} className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm">{t('c1_cart.viewCart')}</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
