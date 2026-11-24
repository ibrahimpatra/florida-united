'use client';
import { useEffect, useState } from 'react';
import { Plus, Package } from 'lucide-react';
import Link from '@/components/ui/LocLink';
import { QtyStepper } from '@/components/cart/QtyStepper';
import { useCartStore } from '@/store/cartStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';

/** "You may also need": a few small, in-stock items that go with what is in the cart, one tap to add. */
export function CheckoutSuggestions() {
  const { t, L } = useLanguage();
  const { items, addItem, updateQuantity } = useCartStore();
  const [recs, setRecs] = useState<any[]>([]);
  const [shown, setShown] = useState<any[] | null>(null);   // the three suggestions stay put while the shopper adds or removes them
  const seedId = items.map(i => i.productId).filter(id => !String(id).startsWith('bundle:')).slice(0, 12).join(',');

  useEffect(() => {
    if (!seedId) return;
    let dead = false;
    fetch(`/api/recommendations?ids=${encodeURIComponent(seedId)}&limit=8`).then(r => r.json()).then(d => { if (!dead) setRecs(d.recommendations || []); }).catch(() => {});
    return () => { dead = true; };
  }, [seedId]);

  useEffect(() => {
    if (shown || !recs.length) return;
    const inCart0 = new Set(items.map(i => i.productId));
    const pick = recs.filter(r => !inCart0.has(r.id) && r.stock > 0 && !r.variants?.length).slice(0, 3);
    if (pick.length) setShown(pick);
  }, [recs, shown, items]);
  const list = shown || [];
  if (!list.length) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-gray-800 mb-2">{t('c3_nudge.alsoNeed')}</p>
      <ul className="space-y-2">
        {list.map(p => {
          const line = items.find(i => i.productId === p.id && !i.variantId);
          return (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2">
            <Link href={`/shop/products/${p.slug}`} className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.images?.[0] ? <img src={p.images[0]} alt={L(p, 'name')} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-300" />}
              </div>
              <div className="min-w-0 flex-1"><p className="text-xs font-medium text-gray-800 line-clamp-2">{L(p, 'name')}</p><p className="text-xs text-brand-700 font-semibold">{formatPrice(p.price)}</p></div>
            </Link>
            {line ? <QtyStepper size="sm" qty={line.quantity} max={line.stock || p.stock} onChange={q => updateQuantity(p.id, q)} /> : (
              <button type="button" aria-label={`+ ${L(p, 'name')}`}
                onClick={() => addItem({ id: p.id, productId: p.id, categoryId: p.categoryId, name: p.name, nameAr: p.nameAr, slug: p.slug, price: p.price, comparePrice: p.comparePrice, image: p.images?.[0] || '', sku: p.sku, stock: p.stock, isReturnable: p.isReturnable, freeShipping: p.freeShipping })}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-brand-600 text-white hover:bg-brand-700"><Plus className="w-4 h-4" /></button>)}
          </li>);
        })}
      </ul>
    </div>
  );
}
