'use client';
import { useEffect, useState } from 'react';
import { Plus, Check, Package } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';

/** "You may also need": a few small, in-stock items that go with what is in the cart, one tap to add. */
export function CheckoutSuggestions() {
  const { t, L } = useLanguage();
  const { items, addItem } = useCartStore();
  const [recs, setRecs] = useState<any[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const seedId = items.map(i => i.productId).filter(id => !String(id).startsWith('bundle:')).slice(0, 12).join(',');

  useEffect(() => {
    if (!seedId) return;
    let dead = false;
    fetch(`/api/recommendations?ids=${encodeURIComponent(seedId)}&limit=8`).then(r => r.json()).then(d => { if (!dead) setRecs(d.recommendations || []); }).catch(() => {});
    return () => { dead = true; };
  }, [seedId]);

  const inCart = new Set(items.map(i => i.productId));
  const list = recs.filter(r => !inCart.has(r.id) && r.stock > 0 && !r.variants?.length).slice(0, 3);
  if (!list.length) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-gray-800 mb-2">{t('c3_nudge.alsoNeed')}</p>
      <ul className="space-y-2">
        {list.map(p => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2">
            <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.images?.[0] ? <img src={p.images[0]} alt={L(p, 'name')} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-300" />}
            </div>
            <div className="min-w-0 flex-1"><p className="text-xs font-medium text-gray-800 line-clamp-2">{L(p, 'name')}</p><p className="text-xs text-brand-700 font-semibold">{formatPrice(p.price)}</p></div>
            <button type="button" aria-label={`+ ${L(p, 'name')}`} disabled={added[p.id]}
              onClick={() => { addItem({ id: p.id, productId: p.id, categoryId: p.categoryId, name: p.name, nameAr: p.nameAr, slug: p.slug, price: p.price, comparePrice: p.comparePrice, image: p.images?.[0] || '', sku: p.sku, stock: p.stock, isReturnable: p.isReturnable, freeShipping: p.freeShipping }); setAdded(a => ({ ...a, [p.id]: true })); }}
              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${added[p.id] ? 'bg-green-100 text-green-700' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
              {added[p.id] ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
