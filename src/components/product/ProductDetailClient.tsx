'use client';
import { QtyStepper } from '@/components/cart/QtyStepper';
import { productLink, shareLink } from '@/lib/site-url';
import { useState, useEffect } from 'react';
import { ShoppingCart, Heart, Share2, MessageCircle, Star, Truck, Shield, RotateCcw, ChevronRight, Plus, Minus, Check, Package, Ruler } from 'lucide-react';
import Link from '@/components/ui/LocLink';
import { returnWindowDays } from '@/lib/returns';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useDeals } from '@/lib/useDeals';
import { bestDealFor } from '@/lib/pricing';
import { formatPrice, calculateDiscount } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { toastAdded } from '@/lib/added-toast';
import { ProductGallery } from './ProductGallery';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStoreSettings } from '@/lib/useStoreSettings';
import type { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { AIRecommendations } from './AIRecommendations';
import { renderDescription } from '@/lib/sanitize-html';
import { RecentlyViewed } from './RecentlyViewed';
import { useRecentStore } from '@/store/recentStore';

export function ProductDetailClient({ product, relatedProducts }: { product: Product; relatedProducts: Product[] }) {
  const storeSettings = useStoreSettings();
  const { t, L, isArabic } = useLanguage();
  const { freeShippingThreshold } = useStoreSettings();
  const [qty, setQty] = useState(1);
  const addRecent = useRecentStore(st => st.add);
  useEffect(() => { addRecent(product.id); }, [product.id, addRecent]);
  const name = L(product, 'name');
  // No live fetch on every visit: the page is cached and is refreshed by the server when stock changes. The number here is capped (about 10) and never shown.
  const liveStock = product.stock;
  const [unitId, setUnitId] = useState<string | undefined>(undefined);
  const unit = (product.units || []).find(u => u.id === unitId);
  const factor = unit ? unit.factor : 1;
  const unitPrice = unit ? unit.price : product.price;
  // stock shown/selectable is in the chosen unit (base stock / units per pack)
  const stock = Math.floor(liveStock / factor);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<'desc' | 'specs'>('desc');
  const { addItem, updateQuantity } = useCartStore();
  const cartLine = useCartStore(st => st.items.find(i => i.productId === product.id && (i.variantId || undefined) === (unitId || undefined)));
  const { isInWishlist, toggleItem } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);
  const deals = useDeals();
  const dealHit = bestDealFor(deals, product.id, product.categoryId, unitPrice);
  const discount = !unit && product.comparePrice ? calculateDiscount(product.comparePrice, product.price) : 0;

  const handleAddToCart = () => {
    if (stock === 0) return;
    setAdding(true);
    const before = useCartStore.getState().items.find(i => i.productId === product.id && (i.variantId || '') === (unit?.id || ''))?.quantity || 0;
    addItem({
      id: product.id, productId: product.id, categoryId: product.categoryId, name: product.name, nameAr: product.nameAr, slug: product.slug,
      price: unitPrice, comparePrice: unit ? undefined : product.comparePrice,
      image: product.images?.[0] || '', sku: product.sku,
      ...(unit ? { variantId: unit.id, variantName: unit.name, variantNameAr: unit.nameAr } : {}),
      quantity: qty, stock: stock, isReturnable: product.isReturnable,
      freeShipping: product.freeShipping,
    });
    toastAdded(t('c1_pd.addedQty', { qty, name }), { productId: product.id, variantId: unit?.id, before }, { undo: t('smart.undo'), undone: t('smart.undone'), cart: t('smart.viewCart') });
    setTimeout(() => setAdding(false), 800);
  };

  const handleShare = async () => {
    const url = productLink(product.slug, window.location.pathname.startsWith('/ar'));
    const r = await shareLink(name, url);
    if (r === 'copied') toast.success(t('c1_pd.copied')); else if (r === 'failed') toast.error(url);
  };

  const handleWhatsApp = async () => {
    try {
      const res = await fetch(`/api/whatsapp?productId=${product.id}`);
      const data = await res.json();
      window.open(data.whatsappUrl, '_blank');
    } catch { toast.error(t('c1_pd.failed')); }
  };

  return (
    <div className="container-custom py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6" aria-label={t('c1_pd.breadcrumb')}>
        <Link href="/" className="hover:text-brand-600">{t('c1_pd.home')}</Link><ChevronRight className="w-4 h-4 rtl:rotate-180" />
        <Link href="/shop" className="hover:text-brand-600">{t('c1_pd.shop')}</Link><ChevronRight className="w-4 h-4 rtl:rotate-180" />
        <span className="text-gray-800 font-medium truncate max-w-[200px]">{name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10 mb-16">
        {/* Images */}
        <ProductGallery images={product.images || []} alt={name}>
          {discount > 0 && <span className="absolute top-4 start-4 badge-red badge font-bold">{isArabic ? `${discount}%-` : `-${discount}%`}</span>}
        </ProductGallery>

        {/* Info */}
        <div>
          {product.brand && <p className="text-xs text-brand-600 font-bold mb-2">{product.brand}</p>}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 font-display leading-tight">{name}</h1>

          {/* Rating */}
          {product.totalReviews > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex">{[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(product.avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />)}</div>
              <span className="text-sm font-semibold text-gray-700">{product.avgRating}</span>
              <span className="text-sm text-gray-400">({t('c1_pd.reviewsN', { n: product.totalReviews })})</span>
            </div>
          )}

          {/* Price — KWD */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-5">
            <span className="text-2xl sm:text-3xl font-black text-brand-700 whitespace-nowrap">{formatPrice(dealHit && dealHit.deal.type !== 'bogo' ? dealHit.price : unitPrice)}</span>
            {dealHit && dealHit.deal.type !== 'bogo' && <span className="text-lg text-gray-400 line-through">{formatPrice(unitPrice)}</span>}
            {dealHit && <span className="badge-red badge font-bold">{dealHit.deal.type === 'bogo' ? t('c2_deal.bogo') : L(dealHit.deal as any, 'title')}</span>}
            {!unit && !dealHit && product.comparePrice && <span className="text-lg text-gray-400 line-through">{formatPrice(product.comparePrice)}</span>}
            {discount > 0 && <span className="badge-red badge font-bold">{t('c1_pd.save', { n: discount })}</span>}
          </div>

          {(product.units || []).length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2">{t('c1_pd.sellAs')}</p>
              <div className="flex flex-wrap gap-2">
                {[{ id: undefined as string | undefined, label: product.uomName ? L(product, 'uomName') : t('c1_pd.baseUnit'), sub: formatPrice(product.price) },
                  ...(product.units || []).map(u => ({ id: u.id as string | undefined, label: L(u as any, 'name'), sub: formatPrice(u.price) }))].map(o => (
                  <button key={o.id || 'base'} type="button" onClick={() => { setUnitId(o.id); setQty(1); }}
                    className={`px-3 py-2 rounded-xl border-2 text-start transition-colors ${unitId === o.id ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="block text-sm font-semibold text-gray-800">{o.label}</span>
                    <span className="block text-xs text-gray-500">{o.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* UOM badge */}
          {product.uomName && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 mb-3">
              <Ruler className="w-3.5 h-3.5" /> {t('c1_pd.per', { name: L(product, 'uomName'), abbr: L(product, 'uomAbbr') })}
            </div>
          )}

          {product.shortDescription && <p className="text-gray-600 text-sm leading-relaxed mb-5 border-s-4 border-brand-200 ps-4">{L(product, 'shortDescription')}</p>}

          {/* Stock */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-5 ${stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {stock > 0 && <Check className="w-3 h-3" />}
            {stock > 0 ? t('c1_pd.inStockOnly') : t('c1_pd.oos')}
          </div>

          {/* Meta */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm space-y-1.5">
            <div className="flex gap-4"><span className="text-gray-500 w-24">{t('c1_pd.sku')}:</span><span dir="ltr" className="font-mono font-semibold text-gray-800">{product.sku}</span></div>
            {product.brand && <div className="flex gap-4"><span className="text-gray-500 w-24">{t('c1_pd.brand')}:</span><span className="text-gray-800">{product.brand}</span></div>}
            {product.categoryName && <div className="flex gap-4"><span className="text-gray-500 w-24">{t('c1_pd.category')}:</span><span className="text-gray-800">{L(product, 'categoryName')}</span></div>}
            {(product.tags?.length ?? 0) > 0 && <div className="flex gap-4"><span className="text-gray-500 w-24">{t('c1_pd.tags')}:</span><div className="flex flex-wrap gap-1">{(product.tags || []).map(tg => <span key={tg} className="badge-gray badge text-xs">{tg}</span>)}</div></div>}
          </div>

          {/* Qty + Add to cart */}
          {cartLine ? (
            <div className="flex items-center justify-center rounded-full border border-brand-100 bg-brand-50 py-2 mb-4">
              <QtyStepper qty={cartLine.quantity} max={Math.max(stock, 0)} onChange={q => updateQuantity(product.id, q, unitId)} />
            </div>
          ) : (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center border border-gray-200 bg-white rounded-full overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-3 hover:bg-gray-50 transition-colors"><Minus className="w-4 h-4" /></button>
              <span className="px-4 py-3 font-bold text-gray-800 min-w-[3rem] text-center">{qty}</span>
              <button onClick={() => setQty(q => Math.min(stock, q + 1))} disabled={qty >= stock} className="px-3 py-3 hover:bg-gray-50 transition-colors disabled:opacity-40"><Plus className="w-4 h-4" /></button>
            </div>
            <button onClick={handleAddToCart} disabled={stock === 0 || adding}
              className="flex-1 btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed">
              {adding ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
              {stock === 0 ? t('c1_pd.oos') : adding ? t('c1_pd.adding') : t('c1_pd.addCart')}
            </button>
          </div>
          )}
          {/* Phones: the one bottom bar for this page: save, share, WhatsApp and Add to cart with the price */}
          <div className="md:hidden fixed inset-x-3 z-40 no-print" style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-1.5 rounded-full bg-brand-900/95 backdrop-blur-md shadow-float p-1.5">
              <button type="button" onClick={() => toggleItem(product.id)} aria-label={inWishlist ? t('c1_pd.wishlisted') : t('c1_pd.wishlist')}
                className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90 ${inWishlist ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}>
                <Heart className="w-5 h-5" fill={inWishlist ? 'currentColor' : 'none'} />
              </button>
              <button type="button" onClick={handleShare} aria-label={t('c1_pd.share')} className="shrink-0 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition"><Share2 className="w-5 h-5" /></button>
              <button type="button" onClick={handleWhatsApp} aria-label={t('c1_pd.whatsapp')} className="shrink-0 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition"><MessageCircle className="w-5 h-5" /></button>
              {cartLine ? (
                <Link href="/cart" className="flex-1 min-w-0 inline-flex items-center justify-center h-11 rounded-full bg-accent-500 text-brand-950 font-bold text-sm whitespace-nowrap px-2">{t('bnav.cart')} · {cartLine.quantity}</Link>
              ) : (
                <button onClick={handleAddToCart} disabled={stock === 0 || adding} className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-11 rounded-full bg-accent-500 text-brand-950 font-bold text-sm whitespace-nowrap px-2 disabled:opacity-50">
                  {stock === 0 ? t('c1_pd.oos') : adding ? t('c1_pd.adding') : <><span>{t('c1_pd.addCart')}</span><span className="font-extrabold">{formatPrice(dealHit && dealHit.deal.type !== 'bogo' ? dealHit.price : unitPrice)}</span></>}
                </button>
              )}
            </div>
          </div>

          {/* Secondary actions */}
          <div className="hidden md:flex gap-2 mb-6">
            <button onClick={() => toggleItem(product.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${inWishlist ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-500'}`}>
              <Heart className="w-4 h-4" fill={inWishlist ? 'currentColor' : 'none'} />{inWishlist ? t('c1_pd.wishlisted') : t('c1_pd.wishlist')}
            </button>
            <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-brand-200 hover:text-brand-600 transition-all">
              <Share2 className="w-4 h-4" />{t('c1_pd.share')}
            </button>
            <button onClick={handleWhatsApp} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-green-200 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-all">
              <MessageCircle className="w-4 h-4" />{t('c1_pd.whatsapp')}
            </button>
          </div>

          {/* Delivery Info — Kuwait */}
          <div className="space-y-3 border border-gray-100 rounded-2xl p-4">
            {[
              { icon: Truck, text: freeShippingThreshold ? t('c1_pd.delFree', { amount: formatPrice(freeShippingThreshold) }) : t('c1_pd.delStd'), sub: t('c1_pd.delFreeSub') },
              { icon: Shield, text: t('c1_pd.paySecure'), sub: t('c1_pd.paySub') },
              { icon: RotateCcw, text: product.isReturnable ? t('c1_pd.ret', { n: returnWindowDays(storeSettings.returnWindowDays) }) : t('c1_pd.noRet'), sub: product.isReturnable ? t('c1_pd.retSub') : t('c1_pd.noRetSub') },
            ].map(({ icon: Icon, text, sub }) => (
              <div key={text} className="flex gap-3">
                <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4 text-brand-600" /></div>
                <div><p className="text-sm font-semibold text-gray-800">{text}</p><p className="text-xs text-gray-500">{sub}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-6">
          {(['desc', 'specs'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)}
              className={`pb-3 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === k ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {k === 'desc' ? t('c1_pd.desc') : t('c1_pd.specs')}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-16">
        {tab === 'desc' && <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: renderDescription(L(product, 'description')) }} />}
        {tab === 'specs' && (
          <div className="text-sm text-gray-600 space-y-2">
            {product.weight && <div className="flex gap-4 py-2 border-b"><span className="w-32 text-gray-500">{t('c1_pd.weight')}</span><span>{product.weight} {t('c1_pd.kg')}</span></div>}
            {product.brand && <div className="flex gap-4 py-2 border-b"><span className="w-32 text-gray-500">{t('c1_pd.brand')}</span><span>{product.brand}</span></div>}
            <div className="flex gap-4 py-2 border-b"><span className="w-32 text-gray-500">{t('c1_pd.sku')}</span><span dir="ltr" className="font-mono">{product.sku}</span></div>
            {product.uomName && <div className="flex gap-4 py-2"><span className="w-32 text-gray-500">{t('c1_pd.uom')}</span><span>{L(product, 'uomName')} ({L(product, 'uomAbbr')})</span></div>}
          </div>
        )}
      </div>

      {/* AI-powered recommendations */}
      <AIRecommendations productId={product.id} currentCategory={product.categoryId} />
      <RecentlyViewed exclude={[product.id]} />

      {/* Fallback related products (category-based) */}
      {relatedProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 mb-5">{t('c1_pd.more')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedProducts.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
