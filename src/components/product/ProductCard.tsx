'use client';
import Link from '@/components/ui/LocLink';
import { Heart, ShoppingCart, Star, Share2, Package, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useDeals } from '@/lib/useDeals';
import { bestDealFor } from '@/lib/pricing';
import { formatPrice, calculateDiscount } from '@/lib/utils';
import { productLink, shareLink } from '@/lib/site-url';
import { toast } from 'react-hot-toast';
import { toastAdded } from '@/lib/added-toast';
import { useCartStore as useCartStoreRaw } from '@/store/cartStore';
import { CardSlides } from './CardSlides';
import { QtyStepper } from '@/components/cart/QtyStepper';
import type { Product } from '@/types';

interface Props {
  product: Product;
  showQuickView?: boolean;
}

export function ProductCard({ product, showQuickView = true }: Props) {
  const { t, L, isArabic } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { addItem, updateQuantity } = useCartStore();
  const inCart = useCartStore(st => st.items.find(i => i.productId === product.id && !i.variantId));
  const { isInWishlist, toggleItem } = useWishlistStore();

  const inWishlist = isInWishlist(product.id);
  const deals = useDeals();
  const dealHit = bestDealFor(deals, product.id, product.categoryId, product.price);
  const discount = product.comparePrice ? calculateDiscount(product.comparePrice, product.price) : 0;
  const isOutOfStock = product.stock === 0;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isOutOfStock) return;
    setAdding(true);
    const before = useCartStoreRaw.getState().items.find(i => i.productId === product.id && !i.variantId)?.quantity || 0;
    addItem({
      id: product.id,
      productId: product.id,
      categoryId: product.categoryId,
      name: product.name,
      nameAr: product.nameAr,
      slug: product.slug,
      price: product.price,
      comparePrice: product.comparePrice,
      image: product.images?.[0] || '',
      sku: product.sku,
      stock: product.stock,
      isReturnable: product.isReturnable,
      freeShipping: product.freeShipping,
    });
    toastAdded(t('c1_card.added'), { productId: product.id, before }, { undo: t('smart.undo'), undone: t('smart.undone'), cart: t('smart.viewCart') });
    setTimeout(() => setAdding(false), 600);
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    const added = toggleItem(product.id);
    toast.success(added ? t('c1_card.wlAdded') : t('c1_card.wlRemoved'));
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const url = productLink(product.slug, window.location.pathname.startsWith('/ar'));
    const r = await shareLink(L(product, 'name'), url);
    if (r === 'copied') toast.success(t('c1_card.copied')); else if (r === 'failed') toast.error(url);
  }

  return (
    <article className="product-card group">
      <Link href={`/shop/products/${product.slug}`} className="block">
        {/* Image */}
        <div className="p-2 pb-0"><div className="relative overflow-hidden bg-gray-100/80 rounded-[1.25rem] aspect-square product-image-zoom">
          {!imgError && product.images?.[0]
            ? <CardSlides images={product.images} alt={L(product, 'name')} onError={() => setImgError(true)} />
            : <div className="w-full h-full flex items-center justify-center bg-gray-100"><Package className="w-12 h-12 text-gray-300" /></div>}

          {/* Badges */}
          <div className="absolute top-2.5 start-2.5 flex flex-col gap-1.5">
            {discount > 0 && (
              <span className="badge-red badge text-xs font-bold">{isArabic ? `${discount}%-` : `-${discount}%`}</span>
            )}
            {product.isNewArrival && !discount && (
              <span className="badge bg-brand-500 text-white text-xs">{t('c1_card.new')}</span>
            )}
            {isOutOfStock && (
              <span className="badge bg-gray-700 text-white text-xs">{t('c1_card.oos')}</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute top-2.5 end-2.5 flex flex-col gap-2 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-all duration-200">
            <button
              onClick={handleWishlist}
              className={`w-9 h-9 rounded-full shadow-soft flex items-center justify-center transition-all duration-200 active:scale-90 ${
                inWishlist ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-500'
              }`}
              aria-label={inWishlist ? t('c1_card.wlRemove') : t('c1_card.wlAdd')}
            >
              <Heart className="w-4 h-4" fill={inWishlist ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleShare}
              className="hidden md:flex w-9 h-9 rounded-full shadow-soft bg-white text-gray-600 hover:bg-brand-50 hover:text-brand-700 items-center justify-center transition-all duration-200"
              aria-label={t('c1_card.share')}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Add Overlay (hidden once the product is in the cart: the stepper below takes over) */}
          {!inCart && <div className="hidden md:block absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock || adding}
              className={`w-full py-2.5 text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                isOutOfStock
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
              }`}
            >
              {adding ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              {isOutOfStock ? t('c1_card.oos') : adding ? t('c1_card.adding') : t('c1_card.quick')}
            </button>
          </div>}
        </div></div>

        {/* Content */}
        <div className="px-3.5 pt-3 pb-2 md:px-4">
          {product.brand && (
            <p className="text-[11px] text-gray-400 font-medium mb-0.5">{product.brand}</p>
          )}
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-brand-700 transition-colors leading-snug mb-1.5 min-h-[2.5rem]">
            {L(product, 'name')}
          </h3>

          {/* Rating */}
          {product.totalReviews > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3 h-3 ${s <= Math.round(product.avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">({product.totalReviews})</span>
            </div>
          )}

          {/* Price */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="text-base md:text-lg font-extrabold text-gray-900 whitespace-nowrap">{formatPrice(dealHit && dealHit.deal.type !== 'bogo' ? dealHit.price : product.price)}</span>
            {dealHit && dealHit.deal.type !== 'bogo' && <span className="text-xs sm:text-sm text-gray-400 line-through whitespace-nowrap">{formatPrice(product.price)}</span>}
            {dealHit && dealHit.deal.type === 'bogo' && <span className="text-xs font-bold text-red-600">{t('c2_deal.bogo')}</span>}
            {!dealHit && product.comparePrice && (
              <span className="text-xs sm:text-sm text-gray-400 line-through whitespace-nowrap">{formatPrice(product.comparePrice)}</span>
            )}
          </div>

          {/* SKU */}
          <p className="hidden md:block text-[11px] text-gray-400 mt-1">{t('c1_card.sku')}: <span dir="ltr">{product.sku}</span></p>

        </div>
      </Link>

      {/* Add to cart, or - 1 + once it is in the cart */}
      <div className="px-3 pb-3 md:px-4 md:pb-4">
        {inCart ? (
          <div className="flex items-center justify-center rounded-full border border-brand-100 bg-brand-50 px-2 py-1">
            <QtyStepper qty={inCart.quantity} max={inCart.stock || product.stock} onChange={q => updateQuantity(product.id, q)} />
          </div>
        ) : (
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || adding}
            className={`w-full py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] ${
              isOutOfStock
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-brand-800 text-white hover:bg-brand-900 shadow-soft'
            }`}
          >
            {adding ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShoppingCart className="w-3.5 h-3.5" />
            )}
            {isOutOfStock ? t('c1_card.oos') : adding ? t('c1_card.addedBtn') : t('c1_card.addCart')}
          </button>
        )}
      </div>
    </article>
  );
}
