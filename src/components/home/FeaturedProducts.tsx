import type { Product } from '@/types';
import { getFeaturedProducts } from '@/lib/firestore';
import { ProductCard } from '@/components/product/ProductCard';

export async function FeaturedProducts() {
  let products: Product[] = [];
  try { products = await getFeaturedProducts(8); } catch {}
  if (!products.length) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="skeleton h-48 w-full rounded-xl" />
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
