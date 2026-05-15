'use client';
import { useEffect, useState } from 'react';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useWishlistStore } from '@/store/wishlistStore';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Product } from '@/types';

export default function WishlistPage() {
  const { items: wishlistIds, removeItem } = useWishlistStore();
  const { addItem } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlistProducts = async () => {
      if (!wishlistIds.length) { setLoading(false); return; }
      try {
        const results = await Promise.all(
          wishlistIds.map(id => fetch(`/api/products/${id}`).then(r => r.ok ? r.json() : null))
        );
        setProducts(results.filter(Boolean));
      } catch {}
      setLoading(false);
    };
    fetchWishlistProducts();
  }, [wishlistIds]);

  const handleAddToCart = (p: Product) => {
    addItem({ id: p.id, productId: p.id, name: p.name, slug: p.slug, price: p.price, comparePrice: p.comparePrice, image: p.images?.[0]||'', sku: p.sku, stock: p.stock, isReturnable: p.isReturnable });
    toast.success('Added to cart! 🛒');
  };

  return (
    <><Header/>
    <main className="bg-gray-50 min-h-screen">
      <div className="page-hero"><div className="container-custom"><h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-3"><Heart className="w-7 h-7 text-red-500 fill-red-500"/>My Wishlist</h1><p className="text-gray-500 mt-1">{wishlistIds.length} saved items</p></div></div>
      <div className="container-custom py-8">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i)=><div key={i} className="card overflow-hidden"><div className="skeleton h-48 w-full"/><div className="p-4 space-y-2"><div className="skeleton h-4 w-full rounded"/><div className="skeleton h-4 w-3/4 rounded"/></div></div>)}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20"><Heart className="w-16 h-16 text-gray-200 mx-auto mb-4"/><h2 className="text-xl font-bold text-gray-700 mb-2">Your wishlist is empty</h2><p className="text-gray-500 mb-6">Save products you love to buy later</p><Link href="/shop" className="btn-primary">Browse Products</Link></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <div key={p.id} className="card overflow-hidden group">
                <Link href={`/shop/products/${p.slug}`} className="block relative aspect-square bg-gray-50 overflow-hidden">
                  {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/> : <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>}
                  {p.stock === 0 && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="bg-white/90 text-gray-800 text-xs font-bold px-2 py-1 rounded-lg">Out of Stock</span></div>}
                </Link>
                <div className="p-4">
                  <Link href={`/shop/products/${p.slug}`} className="font-semibold text-gray-800 text-sm line-clamp-2 hover:text-brand-700 block mb-2">{p.name}</Link>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-bold text-brand-700">{formatPrice(p.price)}</span>
                    {p.comparePrice && <span className="text-xs text-gray-400 line-through">{formatPrice(p.comparePrice)}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAddToCart(p)} disabled={p.stock===0}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <ShoppingCart className="w-3.5 h-3.5"/>{p.stock===0?'Out of Stock':'Add to Cart'}
                    </button>
                    <button onClick={() => { removeItem(p.id); setProducts(ps => ps.filter(x=>x.id!==p.id)); toast('Removed from wishlist'); }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
    <Footer/></>
  );
}
