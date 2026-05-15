import type { Product } from '@/types';
import { getNewArrivals } from '@/lib/firestore';
import { ProductCard } from '@/components/product/ProductCard';

export async function NewArrivals() {
  let products: Product[] = [];
  try { products = await getNewArrivals(4); } catch {}
  if (!products.length) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({length:4}).map((_,i)=><div key={i} className="card p-4 space-y-3"><div className="skeleton h-48 w-full rounded-xl"/><div className="skeleton h-4 w-3/4 rounded"/></div>)}
    </div>
  );
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>;
}
