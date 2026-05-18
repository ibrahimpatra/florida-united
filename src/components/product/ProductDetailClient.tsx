'use client';
import { useState } from 'react';
import { ShoppingCart, Heart, Share2, MessageCircle, Star, Truck, Shield, RotateCcw, ChevronRight, Plus, Minus, Check } from 'lucide-react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { formatPrice, calculateDiscount } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { AIRecommendations } from './AIRecommendations';

export function ProductDetailClient({ product, relatedProducts }: { product: Product; relatedProducts: Product[] }) {
  const [qty, setQty] = useState(1);
  const [mainImg, setMainImg] = useState(0);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<'desc' | 'specs' | 'reviews'>('desc');
  const { addItem } = useCartStore();
  const { isInWishlist, toggleItem } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);
  const discount = product.comparePrice ? calculateDiscount(product.comparePrice, product.price) : 0;

  const handleAddToCart = () => {
    if (product.stock === 0) return;
    setAdding(true);
    addItem({
      id: product.id, productId: product.id, name: product.name, slug: product.slug,
      price: product.price, comparePrice: product.comparePrice,
      image: product.images?.[0] || '', sku: product.sku,
      quantity: qty, stock: product.stock, isReturnable: product.isReturnable,
    });
    toast.success(`${qty} × ${product.name} added to cart! 🛒`);
    setTimeout(() => setAdding(false), 800);
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: product.name, url });
    else { navigator.clipboard.writeText(url); toast.success('Link copied! 🔗'); }
  };

  const handleWhatsApp = async () => {
    try {
      const res = await fetch(`/api/whatsapp?productId=${product.id}`);
      const data = await res.json();
      window.open(data.whatsappUrl, '_blank');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="container-custom py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-600">Home</Link><ChevronRight className="w-4 h-4" />
        <Link href="/shop" className="hover:text-brand-600">Shop</Link><ChevronRight className="w-4 h-4" />
        <span className="text-gray-800 font-medium truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10 mb-16">
        {/* Images */}
        <div>
          <div className="relative bg-gray-50 rounded-2xl overflow-hidden aspect-square mb-4 group">
            {product.images?.[mainImg]
              ? <img src={product.images[mainImg]} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              : <div className="w-full h-full flex items-center justify-center text-8xl">📦</div>
            }
            {discount > 0 && <span className="absolute top-4 left-4 badge-red badge font-bold">-{discount}%</span>}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setMainImg(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-colors ${i === mainImg ? 'border-brand-500' : 'border-transparent hover:border-gray-300'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.brand && <p className="text-xs text-brand-600 font-bold uppercase tracking-widest mb-2">{product.brand}</p>}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 font-display leading-tight">{product.name}</h1>

          {/* Rating */}
          {product.totalReviews > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex">{[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(product.avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />)}</div>
              <span className="text-sm font-semibold text-gray-700">{product.avgRating}</span>
              <span className="text-sm text-gray-400">({product.totalReviews} reviews)</span>
            </div>
          )}

          {/* Price — KWD */}
          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-3xl font-black text-brand-700">{formatPrice(product.price)}</span>
            {product.comparePrice && <span className="text-lg text-gray-400 line-through">{formatPrice(product.comparePrice)}</span>}
            {discount > 0 && <span className="badge-red badge font-bold">Save {discount}%</span>}
          </div>

          {/* UOM badge */}
          {product.uomName && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 mb-3">
              📐 Per {product.uomName} ({product.uomAbbr})
            </div>
          )}

          {product.shortDescription && <p className="text-gray-600 text-sm leading-relaxed mb-5 border-l-4 border-brand-200 pl-4">{product.shortDescription}</p>}

          {/* Stock */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-5 ${product.stock > 10 ? 'bg-green-50 text-green-700' : product.stock > 0 ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
            {product.stock > 0 && <Check className="w-3 h-3" />}
            {product.stock > 10 ? `In Stock (${product.stock} available)` : product.stock > 0 ? `Low Stock — Only ${product.stock} left!` : 'Out of Stock'}
          </div>

          {/* Meta */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm space-y-1.5">
            <div className="flex gap-4"><span className="text-gray-500 w-24">SKU:</span><span className="font-mono font-semibold text-gray-800">{product.sku}</span></div>
            {product.brand && <div className="flex gap-4"><span className="text-gray-500 w-24">Brand:</span><span className="text-gray-800">{product.brand}</span></div>}
            {product.categoryName && <div className="flex gap-4"><span className="text-gray-500 w-24">Category:</span><span className="text-gray-800">{product.categoryName}</span></div>}
            {(product.tags?.length ?? 0) > 0 && <div className="flex gap-4"><span className="text-gray-500 w-24">Tags:</span><div className="flex flex-wrap gap-1">{(product.tags || []).map(t => <span key={t} className="badge-gray badge text-xs">{t}</span>)}</div></div>}
          </div>

          {/* Qty + Add to cart */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-3 hover:bg-gray-50 transition-colors"><Minus className="w-4 h-4" /></button>
              <span className="px-4 py-3 font-bold text-gray-800 min-w-[3rem] text-center">{qty}</span>
              <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} disabled={qty >= product.stock} className="px-3 py-3 hover:bg-gray-50 transition-colors disabled:opacity-40"><Plus className="w-4 h-4" /></button>
            </div>
            <button onClick={handleAddToCart} disabled={product.stock === 0 || adding}
              className="flex-1 btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed">
              {adding ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
              {product.stock === 0 ? 'Out of Stock' : adding ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>

          {/* Secondary actions */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => toggleItem(product.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${inWishlist ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-500'}`}>
              <Heart className="w-4 h-4" fill={inWishlist ? 'currentColor' : 'none'} />{inWishlist ? 'Wishlisted' : 'Wishlist'}
            </button>
            <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-brand-200 hover:text-brand-600 transition-all">
              <Share2 className="w-4 h-4" />Share
            </button>
            <button onClick={handleWhatsApp} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-green-200 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-all">
              <MessageCircle className="w-4 h-4" />WhatsApp
            </button>
          </div>

          {/* Delivery Info — Kuwait */}
          <div className="space-y-3 border border-gray-100 rounded-2xl p-4">
            {[
              { icon: Truck, text: 'Free delivery on orders over KWD 10', sub: 'Same day & next day delivery available in Kuwait' },
              { icon: Shield, text: 'Secure payment via TAP', sub: 'KNET, Visa, Mastercard, Apple Pay — or Cash on Delivery' },
              { icon: RotateCcw, text: product.isReturnable ? `${product.returnDays}-day easy returns` : 'Non-returnable item', sub: product.isReturnable ? 'Photo verification · Instant approval for small orders' : 'Final sale — no returns accepted' },
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
          {(['desc', 'specs', 'reviews'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'desc' ? 'Description' : t === 'specs' ? 'Specifications' : 'Reviews'}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-16">
        {tab === 'desc' && <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: product.description }} />}
        {tab === 'specs' && (
          <div className="text-sm text-gray-600 space-y-2">
            {product.weight && <div className="flex gap-4 py-2 border-b"><span className="w-32 text-gray-500">Weight</span><span>{product.weight} kg</span></div>}
            {product.brand && <div className="flex gap-4 py-2 border-b"><span className="w-32 text-gray-500">Brand</span><span>{product.brand}</span></div>}
            <div className="flex gap-4 py-2 border-b"><span className="w-32 text-gray-500">SKU</span><span className="font-mono">{product.sku}</span></div>
            {product.uomName && <div className="flex gap-4 py-2"><span className="w-32 text-gray-500">Unit of Measure</span><span>{product.uomName} ({product.uomAbbr})</span></div>}
          </div>
        )}
        {tab === 'reviews' && (
          <div className="text-center py-12 text-gray-400">
            <Star className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-semibold">No reviews yet</p>
            <p className="text-sm mt-1">Be the first to review this product</p>
          </div>
        )}
      </div>

      {/* AI-powered recommendations */}
      <AIRecommendations productId={product.id} currentCategory={product.categoryId} />

      {/* Fallback related products (category-based) */}
      {relatedProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 mb-5">More from this Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedProducts.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
