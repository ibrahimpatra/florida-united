'use client';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';

interface Props { isOpen: boolean; onClose: () => void; }

export function MiniCart({ isOpen, onClose }: Props) {
  const { items, removeItem, updateQuantity, getSubtotal, getTotal, discountAmount } = useCartStore();

  const subtotal = getSubtotal();
  const shipping = subtotal >= 99 ? 0 : 9.99;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[90]" onClick={onClose} />
      )}
      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-[95] flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-700" />
            <span className="font-bold text-gray-900 font-display">My Cart</span>
            {items.length > 0 && (
              <span className="w-5 h-5 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="text-6xl mb-4">🛒</div>
              <p className="text-gray-600 font-semibold mb-2">Your cart is empty</p>
              <p className="text-gray-400 text-sm mb-6">Add products to get started</p>
              <button onClick={onClose} className="btn-primary text-sm px-5 py-2.5">
                Browse Products
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/shop/products/${item.slug}`} onClick={onClose} className="text-sm font-semibold text-gray-800 hover:text-brand-700 line-clamp-2 block">
                    {item.name}
                  </Link>
                  {item.variantName && <p className="text-xs text-gray-500 mt-0.5">{item.variantName}</p>}
                  <p className="text-xs text-gray-400">SKU: {item.sku}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                        className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                        disabled={item.quantity >= item.stock}
                        className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-brand-700">{formatPrice(item.price * item.quantity)}</span>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {/* Shipping notice */}
            {subtotal < 99 && (
              <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-brand-700">
                Add <strong>{formatPrice(99 - subtotal)}</strong> more for free shipping! 🚚
                <div className="mt-1.5 bg-brand-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-brand-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((subtotal / 99) * 100, 100)}%` }} />
                </div>
              </div>
            )}
            {subtotal >= 99 && (
              <div className="bg-green-50 rounded-lg px-3 py-2 text-xs text-green-700 font-semibold">
                ✅ You qualify for FREE shipping!
              </div>
            )}

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span><span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{shipping === 0 ? <span className="text-green-600 font-semibold">FREE</span> : formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200 text-base">
                <span>Total</span><span className="text-brand-700">{formatPrice(subtotal - discountAmount + shipping)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Link href="/checkout" onClick={onClose}
                className="flex items-center justify-center gap-2 w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-colors shadow-md">
                Checkout <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/cart" onClick={onClose}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm">
                View Full Cart
              </Link>
            </div>

            {/* Payment icons */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="text-xs text-gray-400">Secured by</span>
              {['STRIPE', 'VISA', 'MC', 'GPAY'].map(p => (
                <span key={p} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-medium">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
