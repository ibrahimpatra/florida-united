'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cachedJson } from '@/lib/client-cache';
import { SlidersHorizontal, Grid3X3, List, X, ChevronDown, SearchX, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProductCard } from './ProductCard';
import type { Product, ProductFilters, Category } from '@/types';

const SORT_OPTIONS = [
  { value: 'newest', key: 'newest' }, { value: 'popular', key: 'popular' },
  { value: 'price_asc', key: 'priceAsc' }, { value: 'price_desc', key: 'priceDesc' },
  { value: 'rating', key: 'rating' }, { value: 'name_asc', key: 'nameAsc' },
];

/* ── Back-button memory ───────────────────────────────────────────────
 * The page number and filters live in the address bar (so "back" from a product returns to the same page),
 * and when a product is opened from the list we remember how far down it was and the products shown, so the
 * shopper lands on the very same row instead of the top of page 1. */
const SAVE_KEY = 'fk-shop-return';
let poppedAt = 0;
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { poppedAt = Date.now(); });
type Saved = { url: string; y: number; t: number; data?: { items: Product[]; total: number; brands: any[] } };
const readSaved = (): Saved | null => { try { return JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } };
const writeSaved = (v: Saved) => { try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch { /* storage full or blocked: back just opens the right page without the exact row */ } };

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
  const [brands,        setBrands]        = useState<Array<{ name: string; count: number }>>([]);
  const [didYouMean,    setDidYouMean]    = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [view,          setView]          = useState<'grid' | 'list'>('grid');
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [expandedCats,  setExpandedCats]  = useState<Set<string>>(new Set());
  const [page,          setPage]          = useState(1);
  const [ready,         setReady]         = useState(false);   // address-bar state has been applied
  const restored = useRef(false);
  const lastData = useRef<Saved['data']>();
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

  // On arrival (including "back" from a product) take page + filters from the address bar, and show the remembered list straight away
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const has = (k: string) => q.has(k);
    if (['page', 'sort', 'categoryId', 'brand', 'minPrice', 'maxPrice', 'inStock', 'featured', 'new', 'sale', 'q'].some(has)) {
      setFilters(f => ({
        ...f,
        sortBy: (q.get('sort') as any) || f.sortBy,
        categoryId: q.get('categoryId') ?? f.categoryId,
        brand: q.get('brand') || f.brand,
        minPrice: has('minPrice') ? Number(q.get('minPrice')) : f.minPrice,
        maxPrice: has('maxPrice') ? Number(q.get('maxPrice')) : f.maxPrice,
        inStock: has('inStock') ? q.get('inStock') === 'true' : f.inStock,
        isFeatured: has('featured') ? true : f.isFeatured,
        isNewArrival: has('new') ? true : f.isNewArrival,
        isOnSale: has('sale') ? true : f.isOnSale,
        search: has('q') ? q.get('q') || '' : f.search,
      }));
      const pg = Number(q.get('page'));
      if (pg > 1) setPage(Math.floor(pg));
    }
    const saved = readSaved();
    // arrived through the browser's back/forward buttons (in-app navigation, or a full page load after one)
    const nav = (performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined)?.type;
    const viaBack = Date.now() - poppedAt < 3000 || nav === 'back_forward';
    if (saved && viaBack && saved.url === window.location.pathname + window.location.search && Date.now() - saved.t < 30 * 60000 && saved.data) {
      setProducts(saved.data.items); setTotal(saved.data.total); setBrands(saved.data.brands || []); setLoading(false);
      restored.current = true;
      // the page below the list (footer, recently viewed…) may still be laying out: retry briefly until we are on the same row
      let tries = 0;
      const go = () => { window.scrollTo({ top: saved.y, behavior: 'instant' as ScrollBehavior }); if (Math.abs(window.scrollY - saved.y) > 3 && ++tries < 30) setTimeout(go, 60); };
      requestAnimationFrame(go);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    cachedJson<Category[]>('/api/categories')
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
    if (!restored.current) setLoading(true);
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
      if (initialFilters.deal) params.set('deal', initialFilters.deal);
      if (filters.search)     params.set('q',         filters.search);
      params.set('page',  String(page));
      params.set('limit', '24');
      const res  = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (my !== reqId.current) return; // a newer request superseded this one
      if (!res.ok) throw new Error(data?.error || 'failed');
      setProducts(data.items || []);
      setTotal(data.total   || 0);
      setBrands(Array.isArray(data.brands) ? data.brands : []);
      lastData.current = { items: data.items || [], total: data.total || 0, brands: Array.isArray(data.brands) ? data.brands : [] };
      setDidYouMean(typeof data.didYouMean === 'string' ? data.didYouMean : null);
    } catch { if (my === reqId.current) { setProducts([]); setTotal(0); } }
    if (my === reqId.current) { setLoading(false); restored.current = false; }   // first fetch after "back" refreshes quietly; later ones show the loading state
  }, [filters, page]);

  useEffect(() => { if (ready) fetchProducts(); }, [fetchProducts, ready]);

  // Address bar mirrors page + filters (replaceState: no extra history entries, no reload)
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams();
    if (filters.search) q.set('q', filters.search);
    if (filters.sortBy && filters.sortBy !== 'newest') q.set('sort', filters.sortBy);
    if (filters.categoryId && filters.categoryId !== initialFilters.categoryId) q.set('categoryId', filters.categoryId);
    if (filters.brand && filters.brand !== initialFilters.brand) q.set('brand', filters.brand);
    if (filters.minPrice !== undefined) q.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== undefined) q.set('maxPrice', String(filters.maxPrice));
    if (filters.inStock) q.set('inStock', 'true');
    if (filters.isFeatured) q.set('featured', 'true');
    if (filters.isNewArrival) q.set('new', 'true');
    if (filters.isOnSale && !initialFilters.sale) q.set('sale', 'true');
    if (initialFilters.deal) q.set('deal', initialFilters.deal);
    if (page > 1) q.set('page', String(page));
    const qs = q.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : '');
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, '', url);
  }, [filters, page, ready]);

  // Opening a product from the list: remember the scroll position and the products on screen
  const rememberPosition = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('a')) return;
    writeSaved({ url: window.location.pathname + window.location.search, y: window.scrollY, t: Date.now(), data: lastData.current });
  };

  const topRef = useRef<HTMLDivElement>(null);
  /** Next/previous/numbered page: switch and bring the top of the list into view */
  const goPage = (n: number) => { setPage(n); requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const updateFilter = (key: string, value: any) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => { setFilters({ sortBy: 'newest', pageSize: 24, brand: initialFilters.brand || undefined }); setPage(1); };

  const hasFilters = !!(filters.categoryId || filters.brand || filters.minPrice || filters.maxPrice ||
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
        <h3 className="font-bold text-gray-900 text-sm mb-3">{t('c1_shop.category')}</h3>
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
        <h3 className="font-bold text-gray-900 text-sm mb-3">{t('c1_shop.price')}</h3>
        <div className="flex gap-2">
          <input type="number" placeholder={t('c1_shop.min')} value={filters.minPrice || ''}
            onChange={e => updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)}
            className="input-field text-sm py-2 px-3 w-full" />
          <input type="number" placeholder={t('c1_shop.max')} value={filters.maxPrice || ''}
            onChange={e => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
            className="input-field text-sm py-2 px-3 w-full" />
        </div>
      </div>
      {brands.length > 1 && (
        <div>
          <h3 className="font-bold text-gray-900 text-sm mb-3">{t('c1_shop.brand')}</h3>
          <select value={filters.brand || ''} onChange={e => updateFilter('brand', e.target.value || undefined)} className="input-field text-sm py-2 px-3 w-full">
            <option value="">{t('c1_shop.allBrands')}</option>
            {brands.map(b => <option key={b.name} value={b.name}>{b.name} ({b.count})</option>)}
          </select>
        </div>
      )}
      <div>
        <h3 className="font-bold text-gray-900 text-sm mb-3">{t('c1_shop.filterBy')}</h3>
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
    <div dir={dir} className="container-custom !max-w-[1760px] py-6">
      <div className="flex gap-6 xl:gap-8">
        <aside className="w-64 xl:w-72 flex-shrink-0 hidden lg:block">
          {/* stays in view while you scroll the products; a long list scrolls inside the panel (thin bar) */}
          <div className="sticky top-28 card p-5 max-h-[calc(100vh-8rem)] overflow-y-auto thin-scroll">{FilterPanel()}</div>
        </aside>
        <div className="flex-1 min-w-0">
          <div ref={topRef} className="flex flex-wrap items-center justify-between gap-3 mb-4 scroll-mt-28">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(true)}
                className="lg:hidden chip">
                <SlidersHorizontal className="w-4 h-4" />
                {t('c1_shop.filters')} {hasFilters && <span className="w-2 h-2 bg-brand-600 rounded-full" />}
              </button>
              <p className="text-sm text-gray-500">{loading ? t('c1_shop.loading') : t('c1_shop.count', { n: total })}</p>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <select value={filters.sortBy} onChange={e => updateFilter('sortBy', e.target.value)}
                className="max-w-[10rem] sm:max-w-none text-sm font-semibold border border-gray-100 shadow-soft rounded-full ps-4 pe-8 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 cursor-pointer">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`c1_shop.${o.key}`)}</option>)}
              </select>
              <div className="hidden sm:flex gap-1 bg-white shadow-soft border border-gray-100 rounded-full p-1">
                <button onClick={() => setView('grid')} aria-label={t('c1_shop.grid')}
                  className={`p-2 rounded-full transition-colors ${view === 'grid' ? 'bg-brand-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setView('list')} aria-label={t('c1_shop.list')}
                  className={`p-2 rounded-full transition-colors ${view === 'list' ? 'bg-brand-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          {roots.length > 0 && (
            <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-3 mb-1">
              <button onClick={() => updateFilter('categoryId', '')} className={`chip ${!filters.categoryId ? 'chip-active' : ''}`}>{t('c1_shop.allCats')}</button>
              {roots.map(r => <button key={r.id} onClick={() => updateFilter('categoryId', r.id)} className={`chip ${filters.categoryId === r.id ? 'chip-active' : ''}`}>{L(r, 'name')}</button>)}
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-5">
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
              {didYouMean && <p className="mb-3 text-gray-700">{t('c1_shop.didYouMean')}: <a href={`/search?q=${encodeURIComponent(didYouMean)}`} className="font-bold text-brand-700 hover:underline">{didYouMean}</a>?</p>}
              <p className="text-gray-500 mb-6">{t('c1_shop.noneSub')}</p>
              <button onClick={clearFilters} className="btn-primary">{t('c1_shop.clearBtn')}</button>
            </div>
          ) : (
            <div onClickCapture={rememberPosition} className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-5' : 'space-y-4'}>
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              <button disabled={page === 1} onClick={() => goPage(page - 1)}
                className="chip disabled:opacity-40"><ChevronLeft className="w-4 h-4 rtl:rotate-180" />{t('c1_shop.prev')}</button>
              {pageWindow(page, totalPages).map((p, i) => p === 0
                ? <span key={`e${i}`} className="w-8 h-10 flex items-center justify-center text-gray-400">...</span>
                : <button key={p} onClick={() => goPage(p)}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-colors ${p === page ? 'bg-brand-800 text-white shadow-soft' : 'bg-white border border-gray-100 hover:bg-gray-50'}`}>{p}</button>)}
              <button disabled={page === totalPages} onClick={() => goPage(page + 1)}
                className="chip disabled:opacity-40">{t('c1_shop.next')}<ChevronRight className="w-4 h-4 rtl:rotate-180" /></button>
            </div>
          )}
        </div>
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative ms-auto w-80 max-w-full bg-white h-full overflow-y-auto p-6 shadow-2xl rounded-s-3xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-800">{t('c1_shop.filters')}</h3>
              <button onClick={() => setSidebarOpen(false)} aria-label={t('c1_shop.close')} className="p-2 hover:bg-gray-100 rounded-full">
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
