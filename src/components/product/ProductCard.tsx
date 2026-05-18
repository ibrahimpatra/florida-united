'use client';
import Link from 'next/link';
import { Heart, ShoppingCart, Star, Eye, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { formatPrice, calculateDiscount, buildShareUrl } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Product } from '@/types';

interface Props {
  product: Product;
  showQuickView?: boolean;
}

export function ProductCard({ product, showQuickView = true }: Props) {
  const [adding, setAdding] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { addItem } = useCartStore();
  const { isInWishlist, toggleItem } = useWishlistStore();

  const inWishlist = isInWishlist(product.id);
  const discount = product.comparePrice ? calculateDiscount(product.comparePrice, product.price) : 0;
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= (product.lowStockAlert ?? 5);

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isOutOfStock) return;
    setAdding(true);
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      comparePrice: product.comparePrice,
      image: product.images?.[0] || '',
      sku: product.sku,
      stock: product.stock,
      isReturnable: product.isReturnable,
    });
    toast.success(`Added to cart!`, { icon: '🛒' });
    setTimeout(() => setAdding(false), 600);
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    const added = toggleItem(product.id);
    toast(added ? 'Added to wishlist' : 'Removed from wishlist', { icon: added ? '❤️' : '💔' });
  }

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    const url = buildShareUrl(product.slug);
    if (navigator.share) {
      navigator.share({ title: product.name, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  }

  return (
    <article className="product-card group">
      <Link href={`/shop/products/${product.slug}`} className="block">
        {/* Image */}
        <div className="relative overflow-hidden bg-gray-50 rounded-t-2xl aspect-square product-image-zoom">
          {!imgError && product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <span className="text-5xl">📦</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {discount > 0 && (
              <span className="badge-red badge text-xs font-bold">-{discount}%</span>
            )}
            {product.isNewArrival && !discount && (
              <span className="badge bg-brand-500 text-white text-xs">NEW</span>
            )}
            {isOutOfStock && (
              <span className="badge bg-gray-700 text-white text-xs">Out of Stock</span>
            )}
            {isLowStock && !isOutOfStock && (
              <span className="badge bg-orange-500 text-white text-xs">Low Stock</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
            <button
              onClick={handleWishlist}
              className={`w-8 h-8 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 ${
                inWishlist ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-500'
              }`}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className="w-4 h-4" fill={inWishlist ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleShare}
              className="w-8 h-8 rounded-lg shadow-md bg-white text-gray-600 hover:bg-brand-50 hover:text-brand-700 flex items-center justify-center transition-all duration-200"
              aria-label="Share product"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Add Overlay */}
          <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
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
              {isOutOfStock ? 'Out of Stock' : adding ? 'Adding...' : 'Quick Add'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {product.brand && (
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{product.brand}</p>
          )}
          <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 group-hover:text-brand-700 transition-colors leading-snug mb-2">
            {product.name}
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
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-brand-700">{formatPrice(product.price)}</span>
            {product.comparePrice && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(product.comparePrice)}</span>
            )}
          </div>

          {/* SKU */}
          <p className="text-xs text-gray-400 mt-1">SKU: {product.sku}</p>

          {/* Stock indicator */}
          {isLowStock && (
            <p className="text-xs text-orange-600 font-semibold mt-1">⚠ Only {product.stock} left!</p>
          )}
        </div>
      </Link>

      {/* Add to Cart button at bottom */}
      <div className="px-4 pb-4">
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock || adding}
          className={`w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            isOutOfStock
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white border border-brand-200 hover:border-brand-600'
          }`}
        >
          {adding ? (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ShoppingCart className="w-3.5 h-3.5" />
          )}
          {isOutOfStock ? 'Out of Stock' : adding ? 'Added!' : 'Add to Cart'}
        </button>
      </div>
    </article>
  );
}
