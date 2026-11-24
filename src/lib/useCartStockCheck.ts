'use client';
import { useEffect } from 'react';
import { useCartStore } from '@/store/cartStore';

let lastAt = 0, lastKey = '';
/** One batched stock check when the cart or checkout opens (not on every page, not on a timer). Marks sold-out lines so they are not counted or ordered. */
export function useCartStockCheck() {
  const items = useCartStore(s => s.items);
  const applyStock = useCartStore(s => s.applyStock);
  const key = items.map(i => i.productId).filter(id => !String(id).startsWith('bundle:')).sort().join(',');
  useEffect(() => {
    if (!key) return;
    if (key === lastKey && Date.now() - lastAt < 30_000) return;   // opened again within 30 s: nothing new to ask
    lastKey = key; lastAt = Date.now();
    fetch(`/api/stock?ids=${encodeURIComponent(key)}`).then(r => r.ok ? r.json() : null).then(m => { if (m) applyStock(m); }).catch(() => {});
  }, [key, applyStock]);
}
