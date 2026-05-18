'use client';
import { useEffect, useState } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductSkeleton } from '@/components/product/ProductSkeleton';
import type { Product } from '@/types';

export function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products?featured=true&limit=8')
      .then(r => r.json())
      .then(d => { setProducts(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
    </div>
  );

  if (!products.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
