'use client';
import { useEffect, useState } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { SectionHeader } from './SectionHeader';
import type { Product } from '@/types';

/** Home page: products covered by an offer that is running now. Shows nothing at all when no offer is live (no empty heading). */
export function DealsProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => { fetch('/api/products?sale=true&limit=8').then(r => r.json()).then(d => setProducts(d.items || [])).catch(() => setProducts([])); }, []);
  if (!products?.length) return null;
  return (
    <section className="section">
      <div className="container-custom">
        <SectionHeader k="dealsNow" href="/deals" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{products.map(p => <ProductCard key={p.id} product={p} />)}</div>
      </div>
    </section>
  );
}
