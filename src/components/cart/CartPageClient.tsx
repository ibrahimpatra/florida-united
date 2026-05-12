'use client';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { toast } from 'react-hot-toast';

export function CartPageClient() {
  const { items, removeItem, updateQuantity, getSubtotal, discountAmount, couponCode, setCoupon, removeCoupon } = useCartStore();
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const subtotal = getSubtotal();
  const shipping = subtotal >= 99 ? 0 : 9.99;
  const tax = +(subtotal * 0.07).toFixed(2);
  const total = subtotal - discountAmount + shipping + tax;

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch('/api/coupons/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: couponInput, orderAmount: subtotal }) });
      const data = await res.json();
      if (data.valid) { setCoupon(couponInput.toUpperCase(), data.discount); toast.success(`Coupon applied! You save ${formatPrice(data.discount)} 🎉`); setCouponInput(''); }
      else toast.error(data.error || 'Invalid coupon');
    } catch { toast.error('Failed to apply coupon'); }
    setCouponLoading(false);
  };

  if (items.length === 0) return (
    <div className="container-custom py-20 text-center">
      <div className="text-8xl mb-6">🛒</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3 font-display">Your cart is empty</h2>
      <p className="text-gray-500 mb-8">Add some awesome hardware and electrical products!</p>
      <Link href="/shop" className="btn-primary">Shop Now →</Link>
    </div>
  );

  return (
    <div className="container-custom py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 font-display flex items-center gap-3"><ShoppingBag className="w-7 h-7 text-brand-600"/>Shopping Cart <span className="text-base font-normal text-gray-500">({items.length} items)</span></h1>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item=>(
            <div key={`${item.productId}-${item.variantId}`} className="card p-4 flex gap-4">
              <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/shop/products/${item.slug}`} className="font-semibold text-gray-800 hover:text-brand-700 text-sm line-clamp-2">{item.name}</Link>
                {item.variantName && <p className="text-xs text-gray-500 mt-0.5">{item.variantName}</p>}
                <p className="text-xs text-gray-400 font-mono mt-0.5">SKU: {item.sku}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={()=>updateQuantity(item.productId,item.quantity-1,item.variantId)} className="w-7 h-7 rounded-lg border border-gray-200 hover:border-brand-300 flex items-center justify-center transition-colors"><Minus className="w-3 h-3"/></button>
                    <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                    <button onClick={()=>updateQuantity(item.productId,item.quantity+1,item.variantId)} disabled={item.quantity>=item.stock} className="w-7 h-7 rounded-lg border border-gray-200 hover:border-brand-300 flex items-center justify-center transition-colors disabled:opacity-40"><Plus className="w-3 h-3"/></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-brand-700">{formatPrice(item.price*item.quantity)}</span>
                    <button onClick={()=>{removeItem(item.productId,item.variantId);toast.success('Removed');}} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4"/></button>
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
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-brand-600"/>Coupon Code</h3>
            {couponCode ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <span className="text-green-700 font-bold text-sm">{couponCode} — Save {formatPrice(discountAmount)}</span>
                <button onClick={removeCoupon} className="text-green-600 hover:text-red-500"><X className="w-4 h-4"/></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={couponInput} onChange={e=>setCouponInput(e.target.value.toUpperCase())} placeholder="Enter code" className="input-field text-sm py-2 flex-1" onKeyDown={e=>e.key==='Enter'&&applyCoupon()}/>
                <button onClick={applyCoupon} disabled={couponLoading} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {couponLoading?'...':'Apply'}
                </button>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal ({items.reduce((s,i)=>s+i.quantity,0)} items)</span><span>{formatPrice(subtotal)}</span></div>
              {discountAmount>0 && <div className="flex justify-between text-green-600 font-medium"><span>Discount ({couponCode})</span><span>-{formatPrice(discountAmount)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>Shipping</span><span>{shipping===0?<span className="text-green-600 font-semibold">FREE</span>:formatPrice(shipping)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Tax (7%)</span><span>{formatPrice(tax)}</span></div>
              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-gray-900 text-base">
                <span>Total</span><span className="text-brand-700 text-lg">{formatPrice(total)}</span>
              </div>
            </div>
            {subtotal<99 && (
              <div className="mt-4 bg-blue-50 rounded-xl p-3 text-xs text-brand-700">
                Add <strong>{formatPrice(99-subtotal)}</strong> more for FREE shipping! 🚚
                <div className="mt-2 bg-brand-100 rounded-full h-2"><div className="bg-brand-600 h-full rounded-full" style={{width:`${Math.min((subtotal/99)*100,100)}%`}}/></div>
              </div>
            )}
            <Link href="/checkout" className="btn-primary w-full mt-4 py-3 justify-center">
              Proceed to Checkout <ArrowRight className="w-4 h-4"/>
            </Link>
            <Link href="/shop" className="block text-center text-sm text-brand-600 hover:text-brand-700 font-medium mt-3">← Continue Shopping</Link>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
              🔒 Secured by Stripe · Visa · MasterCard · GPay
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
