'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShippingSelector } from '@/components/shipping/ShippingSelector';
import { KuwaitCheckoutForm } from '@/components/checkout/KuwaitCheckoutForm';
import { Lock, ShoppingBag } from 'lucide-react';
import type { ShippingOption } from '@/lib/shipping';

export default function CheckoutPage() {
  const { data: session } = useSession();
  const { items, getSubtotal, discountAmount, couponCode } = useCartStore();
  const [shippingOption, setShippingOption] = useState<ShippingOption | null>(null);
  const [governorate, setGovernorate] = useState('');

  const subtotal = getSubtotal();
  const shippingCost = shippingOption?.price ?? 1.500; // default KWD 1.500

  if (!session) return (
    <><Header />
    <div className="container-custom py-20 text-center">
      <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-800 mb-2">Sign in to checkout</h2>
      <Link href="/auth/login?callbackUrl=/checkout" className="btn-primary mt-2">Sign In to Continue</Link>
    </div><Footer /></>
  );

  if (!items.length) return (
    <><Header />
    <div className="container-custom py-20 text-center">
      <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
      <Link href="/shop" className="btn-primary mt-2">Continue Shopping</Link>
    </div><Footer /></>
  );

  return (
    <><Header />
    <div className="container-custom py-10 max-w-6xl">
      <h1 className="text-2xl font-black text-gray-900 mb-8">Checkout</h1>
      <div className="grid lg:grid-cols-2 gap-10">
        {/* Left: Form */}
        <div>
          {/* Shipping selector */}
          <div className="mb-6">
            <h3 className="text-base font-bold text-gray-900 mb-3">📍 Select Governorate for Shipping Rates</h3>
            <select
              value={governorate}
              onChange={e => setGovernorate(e.target.value)}
              className="input-field">
              <option value="">-- Select your governorate --</option>
              {['Capital (العاصمة)','Hawalli (حولي)','Farwaniya (الفروانية)','Ahmadi (الأحمدي)','Jahra (الجهراء)','Mubarak Al-Kabeer (مبارك الكبير)'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {governorate && (
              <div className="mt-3">
                <ShippingSelector
                  orderAmount={subtotal}
                  governorate={governorate}
                  onShippingSelected={setShippingOption}
                  selectedOptionId={shippingOption?.rateId}
                />
              </div>
            )}
          </div>

          <KuwaitCheckoutForm
            items={items}
            subtotal={subtotal}
            discount={discountAmount}
            shippingOption={shippingOption}
            couponCode={couponCode ?? undefined}
            userEmail={session.user.email || ''}
          />
        </div>

        {/* Right: Cart Summary */}
        <div className="lg:sticky lg:top-24 space-y-4 h-fit">
          <div className="bg-gray-50 rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 mb-4">Order Summary ({items.length} items)</h3>
            <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className="flex gap-3 items-center">
                  <div className="w-12 h-12 bg-white rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                    {item.image
                      ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                    {item.variantName && <p className="text-xs text-gray-400">{item.variantName}</p>}
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 flex-shrink-0">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatPrice(discountAmount)}</span></div>}
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{shippingOption ? (shippingOption.isFree ? <span className="text-green-600 font-semibold">FREE</span> : formatPrice(shippingOption.price)) : '—'}</span>
              </div>
              <div className="flex justify-between font-black text-gray-900 text-base border-t pt-2">
                <span>Total</span>
                <span className="text-brand-700">{formatPrice(subtotal - discountAmount + shippingCost)}</span>
              </div>
              <p className="text-xs text-gray-400 text-center">All prices in Kuwaiti Dinar (KWD). No VAT.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Footer /></>
  );
}
