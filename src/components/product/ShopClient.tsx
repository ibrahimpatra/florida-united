'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SlidersHorizontal, Grid3X3, List, X, ChevronDown, SearchX, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RecentlyViewed } from './RecentlyViewed';
import { ProductCard } from './ProductCard';
import type { Product, ProductFilters, Category } from '@/types';

const SORT_OPTIONS = [
  { value: 'newest', key: 'newest' }, { value: 'popular', key: 'popular' },
  { value: 'price_asc', key: 'priceAsc' }, { value: 'price_desc', key: 'priceDesc' },
  { value: 'rating', key: 'rating' }, { value: 'name_asc', key: 'nameAsc' },
];

/** Page numbers with 0 as an ellipsis marker. */
function pageWindow(cur: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, cur, cur - 1, cur + 1]);
  const pages = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: number[] = [];
  pages.forEach((n, i) => { if (i && n - pages[i - 1] > 1) out.push(0); out.push(n); });
  return out;
}

export function ShopClient({ initialFilters = {} }: { initialFilters?: Record<string, string> }) {
  const { t, L, dir } = useLanguage();
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [products,      setProducts]      = useState<Product[]>([]);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [view,          setView]          = useState<'grid' | 'list'>('grid');
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [expandedCats,  setExpandedCats]  = useState<Set<string>>(new Set());
  const [page,          setPage]          = useState(1);
  const [filters,       setFilters]       = useState<ProductFilters>({
    sortBy:      (initialFilters.sort as any) || 'newest',
    categoryId:  initialFilters.categoryId || '',
    brand:       initialFilters.brand || undefined,
    minPrice:    initialFilters.minPrice ? Number(initialFilters.minPrice) : undefined,
    maxPrice:    initialFilters.maxPrice ? Number(initialFilters.maxPrice) : undefined,
    inStock:     initialFilters.inStock === 'true',
    isFeatured:  initialFilters.featured === 'true' ? true : undefined,
    isNewArrival: initialFilters.new === 'true' ? true : undefined,
    isOnSale:    initialFilters.sale === 'true' ? true : undefined,
    search:      initialFilters.q || '',
    pageSize:    24,
  });

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then((cats: Category[]) => {
        const active = cats.filter(c => c.isActive);
        setCategories(active);
        if (initialFilters.categoryId) {
          const sel = active.find(c => c.id === initialFilters.categoryId);
          if (sel?.parentId) setExpandedCats(new Set([sel.parentId]));
        }
      })
      .catch(() => {});
  }, []);

  const reqId = useRef(0);
  const fetchProducts = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sortBy)     params.set('sort',     filters.sortBy);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      if (filters.brand)      params.set('brand',      filters.brand);
      if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
      if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
      if (filters.inStock)    params.set('inStock',   'true');
      if (filters.isFeatured) params.set('featured',  'true');
      if (filters.isNewArrival) params.set('new',     'true');
      if (filters.isOnSale)   params.set('sale',      'true');
      if (filters.search)     params.set('q',         filters.search);
      params.set('page',  String(page));
      params.set('limit', '24');
      const res  = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (my !== reqId.current) return; // a newer request superseded this one
      if (!res.ok) throw new Error(data?.error || 'failed');
      setProducts(data.items || []);
      setTotal(data.total   || 0);
    } catch { if (my === reqId.current) { setProducts([]); setTotal(0); } }
    if (my === reqId.current) setLoading(false);
  }, [filters, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const updateFilter = (key: string, value: any) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => { setFilters({ sortBy: 'newest', pageSize: 24, brand: initialFilters.brand || undefined }); setPage(1); };

  const hasFilters = !!(filters.categoryId || filters.minPrice || filters.maxPrice ||
    filters.inStock || filters.isOnSale || filters.isNewArrival || filters.isFeatured);
  const totalPages = Math.ceil(total / 24);

  const roots = categories.filter(c => !c.parentId);
  const subs  = (pid: string) => categories.filter(c => c.parentId === pid);
  const toggleExpand = (id: string) =>
    setExpandedCats(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const FilterPanel = () => (
    <div className="space-y-6">
      {hasFilters && (
        <button onClick={clearFilters} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-semibold">
          <X className="w-4 h-4" /> {t('c1_shop.clear')}
        </button>
      )}
      <div>
        <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">{t('c1_shop.category')}</h3>
        <div className="space-y-0.5">
          <label className="flex items-center gap-2 cursor-pointer py-1.5 group">
            <input type="radio" name="cat" value="" checked={!filters.categoryId}
              onChange={() => updateFilter('categoryId', '')} className="accent-brand-600" />
            <span className="text-sm text-gray-700 font-semibold group-hover:text-brand-700">{t('c1_shop.allCats')}</span>
          </label>
          {roots.map(root => {
            const children = subs(root.id);
            const expanded = expandedCats.has(root.id);
            const isSel    = filters.categoryId === root.id;
            return (
              <div key={root.id}>
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-2 cursor-pointer py-1.5 group flex-1">
                    <input type="radio" name="cat" value={root.id} checked={isSel}
                      onChange={() => updateFilter('categoryId', root.id)} className="accent-brand-600" />
                    <span className={`text-sm group-hover:text-brand-700 ${isSel ? 'text-brand-700 font-bold' : 'text-gray-700'}`}>
                      {L(root, 'name')}
                    </span>
                  </label>
                  {children.length > 0 && (
                    <button onClick={() => toggleExpand(root.id)} className="p-0.5 text-gray-400 hover:text-gray-600">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {expanded && children.length > 0 && (
                  <div className="ms-5 border-s border-gray-200 ps-3 space-y-0.5">
                    {children.map(sub => (
                      <label key={sub.id} className="flex items-center gap-2 cursor-pointer py-1 group">
                        <input type="radio" name="cat" value={sub.id}
                          checked={filters.categoryId === sub.id}
                          onChange={() => updateFilter('categoryId', sub.id)} className="accent-brand-600" />
                        <span className={`text-sm group-hover:text-brand-700 ${filters.categoryId === sub.id ? 'text-brand-700 font-semibold' : 'text-gray-600'}`}>
                          {L(sub, 'name')}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">{t('c1_shop.price')}</h3>
        <div className="flex gap-2">
          <input type="number" placeholder={t('c1_shop.min')} value={filters.minPrice || ''}
            onChange={e => updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)}
            className="input-field text-sm py-2 px-3 w-full" />
          <input type="number" placeholder={t('c1_shop.max')} value={filters.maxPrice || ''}
            onChange={e => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
            className="input-field text-sm py-2 px-3 w-full" />
        </div>
      </div>
      <div>
        <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">{t('c1_shop.filterBy')}</h3>
        <div className="space-y-2.5">
          {[
            { key: 'inStock',      label: t('c1_shop.inStock') },
            { key: 'isOnSale',    label: t('c1_shop.onSale') },
            { key: 'isNewArrival', label: t('c1_shop.newArr') },
            { key: 'isFeatured',  label: t('c1_shop.featured') },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!(filters as any)[key]}
                onChange={e => updateFilter(key, e.target.checked || undefined)} className="accent-brand-600 rounded" />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div dir={dir} className="container-custom py-8">
      <div className="flex gap-8">
        <aside className="w-60 flex-shrink-0 hidden lg:block">
          <div className="sticky top-24 card p-5">{FilterPanel()}</div>
        </aside>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:border-brand-300 transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
                {t('c1_shop.filters')} {hasFilters && <span className="w-2 h-2 bg-brand-600 rounded-full" />}
              </button>
              <p className="text-sm text-gray-500">{loading ? t('c1_shop.loading') : t('c1_shop.count', { n: total })}</p>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <select value={filters.sortBy} onChange={e => updateFilter('sortBy', e.target.value)}
                className="max-w-[10rem] sm:max-w-none text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-brand-400 cursor-pointer">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`c1_shop.${o.key}`)}</option>)}
              </select>
              <div className="hidden sm:flex gap-1 border border-gray-200 rounded-xl p-1">
                <button onClick={() => setView('grid')} aria-label={t('c1_shop.grid')}
                  className={`p-1.5 rounded-lg transition-colors ${view === 'grid' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setView('list')} aria-label={t('c1_shop.list')}
                  className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="card overflow-hidden">
                  <div className="skeleton h-48 w-full" />
                  <div className="p-4 space-y-2">
                    <div className="skeleton h-4 w-full rounded" />
                    <div className="skeleton h-4 w-3/4 rounded" />
                    <div className="skeleton h-5 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <SearchX className="w-14 h-14 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">{t('c1_shop.none')}</h3>
              <p className="text-gray-500 mb-6">{t('c1_shop.noneSub')}</p>
              <button onClick={clearFilters} className="btn-primary">{t('c1_shop.clearBtn')}</button>
            </div>
          ) : (
            <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-4'}>
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
          <RecentlyViewed />
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4 rtl:rotate-180" />{t('c1_shop.prev')}</button>
              {pageWindow(page, totalPages).map((p, i) => p === 0
                ? <span key={`e${i}`} className="w-8 h-10 flex items-center justify-center text-gray-400">...</span>
                : <button key={p} onClick={() => setPage(p)}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${p === page ? 'bg-brand-600 text-white' : 'border hover:bg-gray-50'}`}>{p}</button>)}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1">{t('c1_shop.next')}<ChevronRight className="w-4 h-4 rtl:rotate-180" /></button>
            </div>
          )}
        </div>
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative ms-auto w-80 max-w-full bg-white h-full overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-800">{t('c1_shop.filters')}</h3>
              <button onClick={() => setSidebarOpen(false)} aria-label={t('c1_shop.close')} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            {FilterPanel()}
            <button onClick={() => setSidebarOpen(false)} className="btn-primary w-full mt-6">
              {t('c1_shop.show', { n: total })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
