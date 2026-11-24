'use client';
import { useEffect, useState } from 'react';
import { Package, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';
import Link from '@/components/ui/LocLink';
import { bundlePath } from '@/lib/bundle-path';

export function BundlesClient() {
  const { t, L } = useLanguage();
  const addItem = useCartStore(s => s.addItem);
  const [bundles, setBundles] = useState<any[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let off = false;
    fetch('/api/bundles?active=true')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (!off) { setBundles(Array.isArray(d) ? d : []); setState('ok'); } })
      .catch(() => !off && setState('error'));
    return () => { off = true; };
  }, []);

  const add = (b: any) => {
    addItem({
      id: `bundle:${b.id}`, productId: `bundle:${b.id}`, name: b.name, nameAr: b.nameAr || undefined, slug: bundlePath(b).split('/').pop() as string,
      price: Number(b.bundlePrice), comparePrice: b.comparePrice || undefined,
      image: b.image || '', sku: `BUNDLE-${String(b.id).slice(0, 6).toUpperCase()}`,
      stock: b.available, isReturnable: true, freeShipping: !!b.freeShipping,
    });
    toast.success(t('bundles.added'));
  };

  return (
    <div className="container-custom py-8">
      <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900">{t('bundles.title')}</h1>
      <p className="text-gray-500 mt-1 mb-6">{t('bundles.subtitle')}</p>
      {state === 'loading' && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>}
      {state === 'error' && <p className="text-center text-red-600 py-20">{t('common.error') === 'common.error' ? 'Could not load bundles.' : t('common.error')}</p>}
      {state === 'ok' && bundles.length === 0 && <p className="text-center text-gray-500 py-20">{t('bundles.empty')}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.map(b => {
          const sep = (b.items || []).reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
          const save = Math.max(0, sep - Number(b.bundlePrice));
          const out = !b.available;
          return (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <Link href={bundlePath(b)} className="aspect-[4/3] bg-gray-50 flex items-center justify-center">
                {b.image || b.items?.[0]?.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={b.image || b.items[0].image} alt={L(b, 'name')} className="w-full h-full object-cover" />
                  : <Package className="w-12 h-12 text-gray-300" />}
              </Link>
              <div className="p-4 flex flex-col flex-1">
                <h2 className="font-bold text-gray-900"><Link href={bundlePath(b)} className="hover:text-brand-600">{L(b, 'name')}</Link></h2>
                {(b.description || b.descriptionAr) && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{L(b, 'description')}</p>}
                <p className="text-xs font-semibold text-gray-400 uppercase mt-3 mb-1">{t('bundles.includes')}</p>
                <ul className="text-sm text-gray-600 space-y-0.5 mb-3">
                  {(b.items || []).map((i: any) => <li key={i.productId}>{i.quantity} x {L(i.productNameAr ? { n: i.productName, nAr: i.productNameAr } : { n: i.productName || i.name }, 'n')}</li>)}
                </ul>
                <div className="mt-auto">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-brand-700">{formatPrice(b.bundlePrice)}</span>
                    {sep > Number(b.bundlePrice) && <span className="text-sm text-gray-400 line-through">{formatPrice(sep)}</span>}
                  </div>
                  {save > 0 && <p className="text-xs text-green-600 font-semibold">{t('bundles.youSave')} {formatPrice(save)}</p>}
                  <button onClick={() => add(b)} disabled={out}
                    className="btn-primary w-full mt-3 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    <ShoppingCart className="w-4 h-4" />{out ? t('bundles.outOfStock') : t('bundles.addBundle')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
