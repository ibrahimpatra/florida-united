'use client';
import { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Grid3X3, List, ChevronDown, X } from 'lucide-react';
import { ProductCard } from './ProductCard';
import type { Product, ProductFilters } from '@/types';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'name_asc', label: 'Name A-Z' },
];

export function ShopClient({ initialFilters = {} }: { initialFilters?: Record<string,string> }) {
  const [categories, setCategories] = useState<Array<{id:string; name:string; slug:string}>>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then((cats: Array<{id:string; name:string; slug:string; isActive:boolean; parentId?:string}>) => {
        setCategories(cats.filter(c => c.isActive && !c.parentId).map(c => ({ id: c.id, name: c.name, slug: c.slug })));
      })
      .catch(() => {});
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ProductFilters>({
    sortBy: (initialFilters.sort as any) || 'newest',
    categoryId: initialFilters.categoryId || '',
    minPrice: initialFilters.minPrice ? Number(initialFilters.minPrice) : undefined,
    maxPrice: initialFilters.maxPrice ? Number(initialFilters.maxPrice) : undefined,
    inStock: initialFilters.inStock === 'true',
    isFeatured: initialFilters.featured === 'true' ? true : undefined,
    isNewArrival: initialFilters.new === 'true' ? true : undefined,
    isOnSale: initialFilters.sale === 'true' ? true : undefined,
    search: initialFilters.q || '',
    pageSize: 24,
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sortBy) params.set('sort', filters.sortBy);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
      if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
      if (filters.inStock) params.set('inStock', 'true');
      if (filters.isFeatured) params.set('featured', 'true');
      if (filters.isNewArrival) params.set('new', 'true');
      if (filters.isOnSale) params.set('sale', 'true');
      if (filters.search) params.set('q', filters.search);
      params.set('page', String(page));
      params.set('limit', '24');

      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const updateFilter = (key: string, value: any) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ sortBy: 'newest', pageSize: 24 });
    setPage(1);
  };

  const hasFilters = !!(filters.categoryId || filters.minPrice || filters.maxPrice || filters.inStock || filters.isOnSale || filters.isNewArrival || filters.isFeatured);
  const totalPages = Math.ceil(total / 24);

  return (
    <div className="container-custom py-8">
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className={`w-64 flex-shrink-0 hidden lg:block`}>
          <div className="sticky top-24 space-y-6">
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium">
                <X className="w-4 h-4"/> Clear all filters
              </button>
            )}

            {/* Categories */}
            <div>
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Category</h3>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer py-1.5 group">
                  <input type="radio" name="cat" value="" checked={!filters.categoryId} onChange={() => updateFilter('categoryId','')} className="accent-brand-600"/>
                  <span className="text-sm text-gray-700 group-hover:text-brand-700">All Categories</span>
                </label>
                {categories.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer py-1.5 group">
                    <input type="radio" name="cat" value={c.id} checked={filters.categoryId===c.id} onChange={() => updateFilter('categoryId',c.id)} className="accent-brand-600"/>
                    <span className="text-sm text-gray-700 group-hover:text-brand-700">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price */}
            <div>
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Price Range</h3>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={filters.minPrice||''} onChange={e=>updateFilter('minPrice',e.target.value?Number(e.target.value):undefined)}
                  className="input-field text-sm py-2 px-3 w-full"/>
                <input type="number" placeholder="Max" value={filters.maxPrice||''} onChange={e=>updateFilter('maxPrice',e.target.value?Number(e.target.value):undefined)}
                  className="input-field text-sm py-2 px-3 w-full"/>
              </div>
            </div>

            {/* Quick Filters */}
            <div>
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Filter By</h3>
              <div className="space-y-2">
                {[
                  {key:'inStock', label:'In Stock Only'},
                  {key:'isOnSale', label:'On Sale'},
                  {key:'isNewArrival', label:'New Arrivals'},
                  {key:'isFeatured', label:'Featured'},
                ].map(({key,label}) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!(filters as any)[key]} onChange={e=>updateFilter(key,e.target.checked||undefined)} className="accent-brand-600 rounded"/>
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="lg:hidden flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:border-brand-300 transition-colors">
                <SlidersHorizontal className="w-4 h-4"/> Filters
              </button>
              <p className="text-sm text-gray-500">{loading ? 'Loading...' : `${total} products`}</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={filters.sortBy} onChange={e=>updateFilter('sortBy',e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-brand-400 cursor-pointer">
                {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="hidden sm:flex gap-1 border border-gray-200 rounded-xl p-1">
                <button onClick={()=>setView('grid')} className={`p-1.5 rounded-lg transition-colors ${view==='grid'?'bg-brand-600 text-white':'text-gray-500 hover:bg-gray-100'}`}><Grid3X3 className="w-4 h-4"/></button>
                <button onClick={()=>setView('list')} className={`p-1.5 rounded-lg transition-colors ${view==='list'?'bg-brand-600 text-white':'text-gray-500 hover:bg-gray-100'}`}><List className="w-4 h-4"/></button>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({length:12}).map((_,i)=>(
                <div key={i} className="card overflow-hidden">
                  <div className="skeleton h-48 w-full"/>
                  <div className="p-4 space-y-2"><div className="skeleton h-4 w-full rounded"/><div className="skeleton h-4 w-3/4 rounded"/><div className="skeleton h-5 w-1/2 rounded"/></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">No products found</h3>
              <p className="text-gray-500 mb-6">Try adjusting your filters or search term</p>
              <button onClick={clearFilters} className="btn-primary">Clear Filters</button>
            </div>
          ) : (
            <div className={view==='grid' ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-4'}>
              {products.map(p=><ProductCard key={p.id} product={p}/>)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40">← Prev</button>
              {Array.from({length:Math.min(totalPages,7)}).map((_,i)=>{
                const p = i+1;
                return <button key={p} onClick={()=>setPage(p)} className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${p===page?'bg-brand-600 text-white':'border hover:bg-gray-50'}`}>{p}</button>;
              })}
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
