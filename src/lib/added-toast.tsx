'use client';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';

/**
 * "Added to cart" message with an Undo button and a shortcut to the cart.
 * Undo puts the quantity back to what it was before this add (or removes the line if it was new).
 */
export function toastAdded(message: string, line: { productId: string; variantId?: string; before: number }, labels: { undo: string; undone: string; cart: string }) {
  toast.custom(tt => (
    <div className={`transition-all duration-300 ${tt.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} flex items-center gap-3 rounded-full bg-brand-900 text-white shadow-float ps-4 pe-2 py-2 max-w-[92vw] text-sm`}>
      <span className="truncate">{message}</span>
      <button type="button" className="shrink-0 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 font-semibold"
        onClick={() => {
          const st = useCartStore.getState();
          if (line.before > 0) st.updateQuantity(line.productId, line.before, line.variantId); else st.removeItem(line.productId, line.variantId);
          toast.dismiss(tt.id); toast.success(labels.undone, { duration: 1500 });
        }}>{labels.undo}</button>
      <Link href="/cart" onClick={() => toast.dismiss(tt.id)} className="shrink-0 rounded-full bg-accent-500 text-brand-950 px-3 py-1.5 font-bold">{labels.cart}</Link>
    </div>
  ), { duration: 4000 });
}
