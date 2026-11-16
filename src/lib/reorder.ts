'use client';
import type { Order } from '@/types';

export interface ReorderResult { added: number; unavailable: string[] }

/**
 * Re-adds the items of a past order using LIVE product data (current price, real slug and stock),
 * never the historical order line. Bundle lines are re-read from the active bundles list.
 */
export async function reorder(order: Order, addItem: (i: any) => void, lang: 'en' | 'ar'): Promise<ReorderResult> {
  const unavailable: string[] = [];
  let added = 0;
  const hasBundle = order.items.some(i => String(i.productId).startsWith('bundle:'));
  let bundles: any[] = [];
  if (hasBundle) {
    try { const r = await fetch('/api/bundles?active=true'); bundles = r.ok ? await r.json() : []; } catch {}
  }
  const label = (n?: string, ar?: string) => (lang === 'ar' && ar ? ar : n || '');

  const results = await Promise.all(order.items.map(async item => {
    if (String(item.productId).startsWith('bundle:')) {
      const b = bundles.find((x: any) => `bundle:${x.id}` === item.productId);
      return { item, kind: 'bundle' as const, data: b || null };
    }
    const p = await fetch(`/api/products/${item.productId}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    return { item, kind: 'product' as const, data: p };
  }));

  for (const { item, kind, data } of results) {
    const name = label(item.productName, item.productNameAr);
    if (!data || (kind === 'product' && (data.isActive === false || !(data.stock > 0))) || (kind === 'bundle' && !data.available)) { unavailable.push(name); continue; }
    if (kind === 'product') {
      addItem({
        id: data.id, productId: data.id, name: data.name, nameAr: data.nameAr, slug: data.slug, price: data.price, comparePrice: data.comparePrice,
        image: data.images?.[0] || item.image || '', sku: data.sku, quantity: Math.min(item.quantity, data.stock), stock: data.stock,
        isReturnable: data.isReturnable, freeShipping: data.freeShipping,
      });
    } else {
      addItem({
        id: `bundle:${data.id}`, productId: `bundle:${data.id}`, name: data.name, nameAr: data.nameAr, slug: 'bundles', price: Number(data.bundlePrice),
        comparePrice: data.comparePrice || undefined, image: data.image || item.image || '', sku: `BUNDLE-${String(data.id).slice(0, 6).toUpperCase()}`,
        quantity: Math.min(item.quantity, data.available), stock: data.available, isReturnable: true, freeShipping: !!data.freeShipping,
      });
    }
    added++;
  }
  return { added, unavailable };
}
