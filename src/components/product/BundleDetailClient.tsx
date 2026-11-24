'use client';
import { useState } from 'react';
import Link from '@/components/ui/LocLink';
import { Package, ShoppingCart, ChevronRight, Check, Truck, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';
import { QtyStepper } from '@/components/cart/QtyStepper';
import { Share2 } from 'lucide-react';
import { siteBase, shareLink } from '@/lib/site-url';
import { bundlePath } from '@/lib/bundle-path';

/** A bundle page that works like a product page: gallery, price and saving, what is inside (each part opens its product), stock from the parts, add to cart. */
export function BundleDetailClient({ bundle: b }: { bundle: any }) {
  const { t, L } = useLanguage();
  const addItem = useCartStore(s => s.addItem);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const line = useCartStore(s => s.items.find(i => i.productId === `bundle:${b.id}`));
  const images: string[] = [...new Set([b.image, ...(b.items || []).map((i: any) => i.image)].filter(Boolean))] as string[];
  const [img, setImg] = useState(0);
  const sep = (b.items || []).reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
  const save = Math.max(0, sep - Number(b.bundlePrice));
  const inStock = b.available > 0;
  const share = async () => {
    const url = `${siteBase()}${window.location.pathname.startsWith('/ar') ? '/ar' : ''}${bundlePath(b)}`;
    const r = await shareLink(L(b, 'name'), url);
    if (r === 'copied') toast.success(t('c1_pd.copied')); else if (r === 'failed') toast.error(url);
  };
  const add = () => {
    addItem({ id: `bundle:${b.id}`, productId: `bundle:${b.id}`, name: b.name, nameAr: b.nameAr || undefined, slug: bundlePath(b).split('/').pop() as string, price: Number(b.bundlePrice), comparePrice: b.comparePrice || undefined, image: images[0] || '', sku: `BUNDLE-${String(b.id).slice(0, 6).toUpperCase()}`, stock: b.available, isReturnable: true, freeShipping: !!b.freeShipping });
    toast.success(t('bundles.added'));
  };
  return (
    <div className="container-custom py-6 md:py-10">
      <nav className="flex items-center gap-1 text-xs text-gray-500 mb-5" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-600">{t('nav.home')}</Link><ChevronRight className="w-3 h-3 rtl:rotate-180" />
        <Link href="/bundles" className="hover:text-brand-600">{t('bundles.title')}</Link><ChevronRight className="w-3 h-3 rtl:rotate-180" />
        <span className="text-gray-700 truncate">{L(b, 'name')}</span>
      </nav>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center">
            {images[img] /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={images[img]} alt={L(b, 'name')} className="w-full h-full object-contain" /> : <Package className="w-16 h-16 text-gray-300" />}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {images.map((u, i) => (
                <button key={u + i} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 ${i === img ? 'border-brand-500' : 'border-gray-100'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900">{L(b, 'name')}</h1>
            <button onClick={share} aria-label={t('c1_pd.share')} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-200"><Share2 className="w-5 h-5" /></button>
          </div>
          <div className="flex items-baseline gap-3 mt-3">
            <span className="text-3xl font-black text-brand-700">{formatPrice(b.bundlePrice)}</span>
            {sep > Number(b.bundlePrice) && <span className="text-lg text-gray-400 line-through">{formatPrice(sep)}</span>}
          </div>
          {save > 0 && <p className="text-sm text-green-600 font-semibold mt-1">{t('bundles.youSave')} {formatPrice(save)}</p>}
          <p className={`inline-flex items-center gap-1.5 text-sm font-semibold mt-3 px-3 py-1 rounded-full ${inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}><Check className="w-4 h-4" />{inStock ? t('c1_pd.inStockOnly') : t('bundles.outOfStock')}</p>
          {(b.description || b.descriptionAr) && <p className="text-gray-600 mt-4 leading-relaxed whitespace-pre-line">{L(b, 'description')}</p>}

          <div className="mt-5">
            {line ? (
              <div className="flex items-center gap-3"><QtyStepper qty={line.quantity} max={Math.max(b.available, 1)} onChange={(q: number) => updateQuantity(line.productId, q)} /><Link href="/cart" className="text-sm font-semibold text-brand-700 underline">{t('nav.cart')}</Link></div>
            ) : (
              <button onClick={add} disabled={!inStock} className="btn-primary w-full sm:w-auto px-8 py-3 flex items-center justify-center gap-2 disabled:opacity-50"><ShoppingCart className="w-5 h-5" />{inStock ? t('bundles.addBundle') : t('bundles.outOfStock')}</button>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-4">
            {b.freeShipping && <span className="inline-flex items-center gap-1"><Truck className="w-4 h-4" />{t('bundles.freeShipping')}</span>}
            <span className="inline-flex items-center gap-1"><RotateCcw className="w-4 h-4" />{t('bundles.returns')}</span>
          </div>

          <h2 className="text-sm font-bold text-gray-900 mt-8 mb-2">{t('bundles.includes')}</h2>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
            {(b.items || []).map((i: any) => (
              <li key={i.productId}>
                <Link href={i.slug ? `/shop/products/${i.slug}` : '/shop'} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                  <span className="w-12 h-12 rounded-lg bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">{i.image /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={i.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-300" />}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-800"><b>{i.quantity} ×</b> {L(i.productNameAr ? { n: i.productName, nAr: i.productNameAr } : { n: i.productName || i.name }, 'n')}</span>
                  {Number(i.price) > 0 && <span className="text-xs text-gray-400">{formatPrice(Number(i.price) * (Number(i.quantity) || 1))}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
