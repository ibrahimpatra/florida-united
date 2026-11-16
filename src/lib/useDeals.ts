'use client';
import { useEffect, useMemo, useState } from 'react';
import { applyFlashDeals, round3, type DealLike, type PricedLine } from './pricing';
import type { CartItem } from '@/store/cartStore';

let cache: DealLike[] | null = null;
let inflight: Promise<DealLike[]> | null = null;
const load = () => {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch('/api/flash-deals').then(r => (r.ok ? r.json() : [])).then(d => (cache = Array.isArray(d) ? d : [])).catch(() => (cache = []));
  return inflight;
};

/** Live flash deals (public, already filtered to active ones by the API). */
export function useDeals(): DealLike[] {
  const [d, setD] = useState<DealLike[]>(cache || []);
  useEffect(() => { let off = false; load().then(v => { if (!off) setD(v); }); return () => { off = true; }; }, []);
  return d;
}

export interface DealLine { item: CartItem; unitPrice: number; total: number; listTotal: number; saving: number; dealTitle?: string; dealTitleAr?: string }

/**
 * Prices cart items with the SAME pure function the server uses at checkout, so the cart can never promise
 * a different number from the one charged. (The server remains the only authority.)
 */
export function useDealPricing(items: CartItem[]) {
  const deals = useDeals();
  return useMemo(() => {
    const base = items.map(i => ({
      productId: i.productId, name: i.name, sku: i.sku || '', price: i.price, quantity: i.quantity, total: round3(i.price * i.quantity),
      freeShipping: false, isReturnable: true, categoryId: i.categoryId,
      bundleItems: i.productId.startsWith('bundle:') ? [] : undefined,
    }));
    const r = applyFlashDeals<PricedLine>(base, deals);
    const lines: DealLine[] = r.lines.map((l, k) => ({
      item: items[k], unitPrice: l.price, total: l.total, listTotal: round3(items[k].price * items[k].quantity),
      saving: l.dealSaving || 0, dealTitle: l.dealTitle, dealTitleAr: l.dealTitleAr,
    }));
    return { lines, subtotal: round3(lines.reduce((s, l) => s + l.total, 0)), saving: r.totalSaving };
  }, [items, deals]);
}
