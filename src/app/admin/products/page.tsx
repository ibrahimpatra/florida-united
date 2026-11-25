'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cachedJson, dropCached } from '@/lib/client-cache';
import Link from 'next/link';
import {
  Plus, Search, Edit2, Trash2, Eye, ToggleLeft, ToggleRight, RefreshCw, X, Package,
  LayoutGrid, List, Download, ImagePlus, ChevronDown, Check,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Product, Category } from '@/types';

const PAGE_SIZE = 30;
type Bulk = '' | 'category' | 'brand' | 'price' | 'stock' | 'delete';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const reqId = useRef(0);
  const forceFresh = useRef(false);   // only Refresh re-reads every product from the database
  const [rootId, setRootId] = useState('');
  const [subId, setSubId] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [flag, setFlag] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('newest');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);   // phones only: the filters fold away to leave room for the list
  const [ready, setReady] = useState(false);
  const keepPage = useRef(false);

  // selection + bulk
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [bulkKind, setBulkKind] = useState<Bulk>('');
  const [bulkVal, setBulkVal] = useState('');
  const [bulkMode, setBulkMode] = useState<'percent' | 'amount'>('percent');
  const [busy, setBusy] = useState(false);

  // Filters, page and view are remembered for this tab: coming back from editing lands on the same list.
  useEffect(() => {
    try {
      const m = JSON.parse(sessionStorage.getItem('admin-products-view') || 'null');
      if (m) {
        setSearch(m.search || ''); setDebounced(m.search || ''); setRootId(m.rootId || ''); setSubId(m.subId || ''); setBrand(m.brand || '');
        setStatus(m.status || ''); setStockFilter(m.stockFilter || ''); setFlag(m.flag || ''); setSortBy(m.sortBy || 'newest'); setPage(m.page || 1);
        keepPage.current = (m.page || 1) > 1;
      }
      const v = localStorage.getItem('admin-products-layout'); if (v === 'grid' || v === 'list') setView(v);
    } catch { /* optional */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { sessionStorage.setItem('admin-products-view', JSON.stringify({ search, rootId, subId, brand, status, stockFilter, flag, sortBy, page })); } catch { /* optional */ } }, [ready, search, rootId, subId, brand, status, stockFilter, flag, sortBy, page]);
  useEffect(() => { if (ready) try { localStorage.setItem('admin-products-layout', view); } catch { /* optional */ } }, [ready, view]);

  const loadLists = useCallback((fresh = false) => {
    if (fresh) { dropCached('/api/categories'); dropCached('/api/brands'); }
    cachedJson<any>('/api/categories?admin=1', { force: fresh }).then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
    cachedJson<any>('/api/brands?all=1', { force: fresh }).then(d => setBrands(Array.isArray(d) ? d.map((b: any) => b.name).filter(Boolean) : [])).catch(() => {});
  }, []);
  useEffect(() => { loadLists(); }, [loadLists]);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); if (keepPage.current) keepPage.current = false; else setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const categoryId = subId || rootId;
  const query = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ sort: sortBy, admin: 'true', ...extra });
    if (debounced) p.set('q', debounced);
    if (categoryId) p.set('categoryId', categoryId);
    if (brand) p.set('brand', brand);
    if (status) p.set('status', status);
    if (stockFilter) p.set('stock', stockFilter);
    if (flag === 'featured') p.set('featured', 'true');
    if (flag === 'sale') p.set('sale', 'true');
    if (flag === 'new') p.set('new', 'true');
    return p;
  }, [sortBy, debounced, categoryId, brand, status, stockFilter, flag]);

  const fetchProducts = useCallback(async () => {
    if (!ready) return;
    const my = ++reqId.current;
    setLoading(true);
    try {
      const params = query({ page: String(page), limit: String(PAGE_SIZE) });
      if (forceFresh.current) { params.set('fresh', '1'); forceFresh.current = false; }
      const res = await fetch(`/api/products?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (my !== reqId.current) return;
      if (!res.ok) throw new Error(data?.error || 'Failed to load products');
      setProducts(data.items || []); setTotal(data.total || 0);
    } catch (e: any) { if (my === reqId.current) toast.error(e?.message || 'Failed to load products'); }
    if (my === reqId.current) setLoading(false);
  }, [page, query, ready]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  // a different filter means a different list: drop the selection
  useEffect(() => { setSel(new Set()); setAllMatching(false); }, [debounced, categoryId, brand, status, stockFilter, flag]);

  const roots = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  const subsOf = useMemo(() => categories.filter(c => c.parentId === rootId), [categories, rootId]);

  const toggleActive = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive, ...((product as any).isArchived && !product.isActive ? { isArchived: false } : {}) }),
      });
      if (!res.ok) throw new Error();
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, isActive: !p.isActive, ...((p as any).isArchived ? { isArchived: false } : {}) } as any : p));
      toast.success(`Product ${!product.isActive ? 'activated' : 'deactivated'}`);
    } catch { toast.error('Failed to update'); }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?\n\nIf it was ever ordered it will be archived (hidden, kept for order history) instead of deleted.`)) return;
    try {
      const r = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'Delete failed'); return; }
      if (j.archived) { setProducts(ps => ps.map(p => p.id === id ? { ...p, isActive: false, isArchived: true } as any : p)); toast(j.message, { icon: 'i', duration: 7000 }); }
      else { setProducts(ps => ps.filter(p => p.id !== id)); setTotal(t => t - 1); toast.success('Product deleted'); }
    } catch { toast.error('Delete failed'); }
  };

  const clearFilters = () => { setSearch(''); setRootId(''); setSubId(''); setBrand(''); setStatus(''); setStockFilter(''); setFlag(''); setPage(1); };
  const hasFilters = !!(search || rootId || subId || brand || status || stockFilter || flag);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── selection ──
  const pageIds = products.map(p => p.id);
  const allOnPage = pageIds.length > 0 && pageIds.every(id => sel.has(id));
  const toggleOne = (id: string) => { setAllMatching(false); setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const togglePage = () => { setAllMatching(false); setSel(s => { const n = new Set(s); if (allOnPage) pageIds.forEach(id => n.delete(id)); else pageIds.forEach(id => n.add(id)); return n; }); };
  const selectAllMatching = async () => {
    try {
      const r = await fetch(`/api/products?${query({ idsOnly: '1', limit: '5000' })}`, { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error();
      setSel(new Set<string>(j.ids)); setAllMatching(true);
    } catch { toast.error('Could not select all'); }
  };
  const clearSel = () => { setSel(new Set()); setAllMatching(false); setBulkKind(''); setBulkVal(''); };

  const runBulk = async (body: Record<string, unknown>, label: string) => {
    const ids = [...sel]; if (!ids.length || busy) return;
    setBusy(true);
    try {
      let updated = 0, skipped = 0; const errors: string[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const r = await fetch('/api/admin/products/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ids.slice(i, i + 500), ...body }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Bulk update failed');
        updated += j.updated || 0; skipped += j.skipped || 0; errors.push(...(j.errors || []));
      }
      if (body.action === 'brand') dropCached('/api/brands');
      toast.success(`${label}: ${updated} product${updated === 1 ? '' : 's'}${skipped ? `, ${skipped} not found` : ''}`);
      if (errors.length) toast.error(errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n+${errors.length - 3} more` : ''), { duration: 8000 });
      clearSel(); await fetchProducts();
    } catch (e: any) { toast.error(e?.message || 'Bulk update failed'); }
    setBusy(false);
  };

  const applyBulk = () => {
    if (bulkKind === 'category') { if (!bulkVal) return toast.error('Choose a category'); return runBulk({ action: 'category', categoryId: bulkVal }, 'Moved'); }
    if (bulkKind === 'brand') return runBulk({ action: 'brand', brand: bulkVal.trim() }, bulkVal.trim() ? 'Brand set' : 'Brand cleared');
    if (bulkKind === 'price') {
      const v = Number(bulkVal); if (!Number.isFinite(v) || v === 0) return toast.error('Enter a change, e.g. 10 or -5');
      if (!confirm(`Change the price of ${sel.size} product(s) by ${v > 0 ? '+' : ''}${v}${bulkMode === 'percent' ? '%' : ' KWD'}?`)) return;
      return runBulk({ action: 'price', mode: bulkMode, value: v }, 'Price changed');
    }
    if (bulkKind === 'stock') { const v = Number(bulkVal); if (!(v >= 0) || bulkVal === '') return toast.error('Enter the stock number'); return runBulk({ action: 'stock', value: v }, 'Stock set'); }
    if (bulkKind === 'delete') {
      if (!confirm(`Delete ${sel.size} product(s)?\n\nAnything that was ever ordered is archived instead (hidden, kept for order history). Products inside a bundle are skipped.`)) return;
      return runBulk({ action: 'delete' }, 'Deleted / archived');
    }
  };

  const exportCsv = async () => {
    try {
      const r = await fetch(`/api/products?${query({ limit: '5000', page: '1' })}`, { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error();
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [['sku', 'name', 'name_ar', 'category', 'brand', 'price', 'compare_price', 'stock', 'status', 'image'], ...(j.items as any[]).map(p => [p.sku, p.name, p.nameAr, p.categoryName, p.brand, p.price, p.comparePrice, p.stock, p.isArchived ? 'archived' : p.isActive === false ? 'inactive' : 'active', p.images?.[0]])];
      const blob = new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
    } catch { toast.error('Export failed'); }
  };

  const stockCls = (p: Product) => p.stock === 0 ? 'text-red-600' : p.stock <= (p.lowStockAlert ?? 5) ? 'text-orange-500' : 'text-green-600';
  const statusLabel = (p: Product) => (p as any).isArchived ? 'Archived' : p.isActive ? 'Active' : 'Inactive';
  const sm = 'input-field py-1.5 text-sm';

  const Thumb = ({ p, cls }: { p: Product; cls: string }) => (
    <div className={`${cls} bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200`}>
      {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <span className="flex items-center justify-center h-full"><Package className="w-4 h-4 text-gray-300" /></span>}
    </div>
  );
  const Check_ = ({ id }: { id: string }) => (
    <input type="checkbox" checked={sel.has(id)} onChange={() => toggleOne(id)} aria-label="Select product" className="w-4 h-4 rounded border-gray-300 accent-brand-600 cursor-pointer" />
  );
  const Actions = ({ p }: { p: Product }) => (
    <div className="flex items-center gap-0.5">
      <Link href={`/shop/products/${p.slug}`} target="_blank" className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg" title="View"><Eye className="w-4 h-4" /></Link>
      <Link href={`/admin/products/${p.id}/edit`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Edit2 className="w-4 h-4" /></Link>
      <button onClick={() => deleteProduct(p.id, p.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
    </div>
  );

  return (
    <div className="p-3 lg:p-5 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="text-lg lg:text-xl font-bold text-gray-900 font-display leading-tight">Products</h1>
          <p className="text-gray-500 text-xs">{total} {hasFilters ? 'match' : 'in total'}</p>
        </div>
        <div className="flex gap-1.5">
          <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white" role="group" aria-label="Layout">
            <button onClick={() => setView('list')} aria-pressed={view === 'list'} title="List view" className={`px-2.5 py-1.5 ${view === 'list' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setView('grid')} aria-pressed={view === 'grid'} title="Grid view" className={`px-2.5 py-1.5 border-s border-gray-200 ${view === 'grid' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <button onClick={exportCsv} title="Download what is listed as CSV" className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 bg-white"><Download className="w-4 h-4" /><span className="hidden sm:inline">Export</span></button>
          <button onClick={() => { forceFresh.current = true; loadLists(true); fetchProducts(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 bg-white"><RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Refresh</span></button>
          <Link href="/admin/products/photos" title="Upload many pictures named by SKU" className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 bg-white"><ImagePlus className="w-4 h-4" /><span className="hidden sm:inline">Photos</span></Link>
          <Link href="/admin/products/new" className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" /><span>Add</span></Link>
        </div>
      </div>

      {/* Filters: always visible, one compact block */}
      <div className="card p-2.5 mb-3">
        <div className="flex gap-2 md:mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, brand..." className="input-field pl-9 py-1.5 text-sm" />
          </div>
          <button onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen} className={`md:hidden flex items-center gap-1 px-3 rounded-xl border text-sm ${filtersOpen || hasFilters ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600'}`}>
            Filters{hasFilters && <span className="w-2 h-2 rounded-full bg-brand-600" />}<ChevronDown className={`w-4 h-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <div className={`${filtersOpen ? 'grid mt-2' : 'hidden'} md:grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2`}>
          <select aria-label="Category" value={rootId} onChange={e => { setRootId(e.target.value); setSubId(''); setPage(1); }} className={sm}>
            <option value="">All categories</option>
            {roots.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Sub-category" value={subId} onChange={e => { setSubId(e.target.value); setPage(1); }} disabled={!rootId || !subsOf.length} className={`${sm} disabled:opacity-50`}>
            <option value="">{rootId && !subsOf.length ? 'No sub-categories' : 'All sub-categories'}</option>
            {subsOf.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Brand" value={brand} onChange={e => { setBrand(e.target.value); setPage(1); }} className={sm}>
            <option value="">All brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select aria-label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={sm}>
            <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
          </select>
          <select aria-label="Stock" value={stockFilter} onChange={e => { setStockFilter(e.target.value); setPage(1); }} className={sm}>
            <option value="">Any stock</option><option value="out">Out of stock</option><option value="low">Low stock</option>
          </select>
          <select aria-label="Tag" value={flag} onChange={e => { setFlag(e.target.value); setPage(1); }} className={sm}>
            <option value="">Any tag</option><option value="featured">Featured</option><option value="sale">On sale</option><option value="new">New arrival</option>
          </select>
          <select aria-label="Sort" value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} className={sm}>
            <option value="newest">Newest first</option><option value="popular">Most popular</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
            <option value="name_asc">Name A–Z</option><option value="stock_asc">Stock: low to high</option><option value="stock_desc">Stock: high to low</option>
          </select>
          <button onClick={clearFilters} disabled={!hasFilters} className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-40 disabled:hover:bg-transparent"><X className="w-4 h-4" /> Clear</button>
        </div>
      </div>

      {/* Selection banner */}
      {sel.size > 0 && (
        <div className="mb-2 text-xs text-gray-600 flex flex-wrap items-center gap-2 px-1">
          <span><b>{sel.size}</b> selected{allMatching ? ' (everything that matches)' : ''}</span>
          {!allMatching && total > sel.size && <button onClick={selectAllMatching} className="text-brand-700 font-semibold hover:underline">Select all {total} that match</button>}
          <button onClick={clearSel} className="text-gray-500 hover:underline">Clear selection</button>
        </div>
      )}

      {/* ── List (table on large screens, compact rows on phones) ── */}
      {view === 'list' && (
        <>
          <div className="card overflow-hidden hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-2 w-8"><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select this page" className="w-4 h-4 rounded border-gray-300 accent-brand-600 cursor-pointer" /></th>
                    {['Product', 'SKU', 'Category', 'Brand', 'Price', 'Stock', 'Status', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-500">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading
                    ? Array.from({ length: 10 }).map((_, i) => <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-3 py-2"><div className="skeleton h-4 w-full rounded" /></td>)}</tr>)
                    : products.length === 0
                    ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">No products match. {hasFilters && <button onClick={clearFilters} className="text-brand-700 font-semibold hover:underline">Clear filters</button>}</td></tr>
                    : products.map(p => (
                      <tr key={p.id} className={`hover:bg-gray-50/60 ${sel.has(p.id) ? 'bg-brand-50/40' : ''}`}>
                        <td className="px-3 py-1.5"><Check_ id={p.id} /></td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2.5">
                            <Thumb p={p} cls="w-9 h-9 rounded-lg" />
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 max-w-[260px] truncate">{p.name}</p>
                              <div className="flex gap-1 flex-wrap">
                                {p.isFeatured && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-full font-semibold">Featured</span>}
                                {p.isNewArrival && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full font-semibold">New</span>}
                                {p.isOnSale && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded-full font-semibold">Sale</span>}
                                {p.freeShipping && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded-full font-semibold">Free ship</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{p.sku}</td>
                        <td className="px-3 py-1.5 text-gray-600 text-xs">{p.categoryName || <span className="text-red-400 font-semibold">No category</span>}</td>
                        <td className="px-3 py-1.5 text-gray-600 text-xs">{p.brand || '—'}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap"><span className="font-bold text-gray-900">{formatPrice(p.price)}</span>{p.comparePrice ? <span className="ms-1.5 text-xs text-gray-400 line-through">{formatPrice(p.comparePrice)}</span> : null}</td>
                        <td className="px-3 py-1.5"><span className={`font-bold ${stockCls(p)}`}>{p.stock === 0 ? 'Out' : p.stock}</span></td>
                        <td className="px-3 py-1.5">
                          <button onClick={() => toggleActive(p)} className={`flex items-center gap-1 text-xs font-semibold ${p.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                            {p.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}{statusLabel(p)}
                          </button>
                        </td>
                        <td className="px-3 py-1.5"><Actions p={p} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:hidden space-y-2">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="card p-3 flex items-center gap-3"><div className="skeleton w-12 h-12 rounded-lg" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/4 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div></div>)
              : products.length === 0
              ? <div className="card p-8 text-center"><p className="text-gray-400 text-sm">No products match</p>{hasFilters && <button onClick={clearFilters} className="btn-primary mt-3 text-sm">Clear filters</button>}</div>
              : products.map(p => (
                <div key={p.id} className={`card p-2.5 ${sel.has(p.id) ? 'ring-1 ring-brand-400' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <Check_ id={p.id} />
                    <Thumb p={p} cls="w-12 h-12 rounded-lg" />
                    <Link href={`/admin/products/${p.id}/edit`} className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm leading-tight truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono truncate">{p.sku}{p.categoryName ? ` · ${p.categoryName}` : ''}</p>
                      <p className="text-sm mt-0.5"><span className="font-bold text-gray-900">{formatPrice(p.price)}</span> <span className={`text-xs font-bold ${stockCls(p)}`}>{p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`}</span></p>
                    </Link>
                    <button onClick={() => toggleActive(p)} aria-label="Switch on or off" className={`flex-shrink-0 ${p.isActive ? 'text-green-600' : 'text-gray-300'}`}>{p.isActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}</button>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* ── Grid ── */}
      {view === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <div key={i} className="card p-2"><div className="skeleton aspect-square rounded-lg" /><div className="skeleton h-3 w-3/4 rounded mt-2" /></div>)
            : products.length === 0
            ? <div className="card p-8 text-center col-span-full"><p className="text-gray-400 text-sm">No products match</p>{hasFilters && <button onClick={clearFilters} className="btn-primary mt-3 text-sm">Clear filters</button>}</div>
            : products.map(p => (
              <div key={p.id} className={`card p-2 relative ${sel.has(p.id) ? 'ring-2 ring-brand-400' : ''} ${p.isActive ? '' : 'opacity-70'}`}>
                <div className="absolute top-3 start-3 z-10 bg-white/90 rounded p-0.5"><Check_ id={p.id} /></div>
                <Link href={`/admin/products/${p.id}/edit`} className="block">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
                    {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <span className="flex items-center justify-center h-full"><Package className="w-8 h-8 text-gray-300" /></span>}
                  </div>
                  <p className="font-semibold text-gray-800 text-[13px] leading-tight line-clamp-2 mt-1.5 min-h-[2rem]">{p.name}</p>
                </Link>
                <p className="text-[11px] text-gray-400 font-mono truncate">{p.sku}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-bold text-sm text-gray-900">{formatPrice(p.price)}</span>
                  <span className={`text-xs font-bold ${stockCls(p)}`}>{p.stock === 0 ? 'Out' : p.stock}</span>
                </div>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-100">
                  <button onClick={() => toggleActive(p)} className={`flex items-center gap-1 text-[11px] font-semibold ${p.isActive ? 'text-green-600' : 'text-gray-400'}`}>{p.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}{statusLabel(p)}</button>
                  <Actions p={p} />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded-lg text-sm bg-white disabled:opacity-40 hover:bg-gray-50">← Prev</button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded-lg text-sm bg-white disabled:opacity-40 hover:bg-gray-50">Next →</button>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {sel.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-float p-2.5" role="region" aria-label="Bulk actions">
          <div className="max-w-5xl mx-auto flex items-center gap-2 pe-14 overflow-x-auto thin-scroll [&>*]:shrink-0">
            <span className="text-sm font-bold text-gray-800 me-1">{sel.size} selected</span>
            <button disabled={busy} onClick={() => runBulk({ action: 'activate' }, 'Activated')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100">Activate</button>
            <button disabled={busy} onClick={() => runBulk({ action: 'deactivate' }, 'Deactivated')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Deactivate</button>
            <button disabled={busy} onClick={() => runBulk({ action: 'archive' }, 'Archived')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Archive</button>
            <button disabled={busy} onClick={() => runBulk({ action: 'feature' }, 'Featured')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100">Feature</button>
            <button disabled={busy} onClick={() => runBulk({ action: 'outOfStock' }, 'Marked out of stock')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100">Out of stock</button>
            <div className="relative">
              <select aria-label="More actions" value={bulkKind} onChange={e => { setBulkKind(e.target.value as Bulk); setBulkVal(''); }} className="input-field py-1.5 text-xs pe-7">
                <option value="">More…</option><option value="category">Move to category</option><option value="brand">Set brand</option>
                <option value="price">Change price</option><option value="stock">Set stock</option><option value="delete">Delete</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {bulkKind === 'category' && (
              <select aria-label="Category" value={bulkVal} onChange={e => setBulkVal(e.target.value)} className="input-field py-1.5 text-xs w-auto">
                <option value="">Choose…</option>
                {roots.map(r => (<optgroup key={r.id} label={r.name}><option value={r.id}>{r.name}</option>{categories.filter(c => c.parentId === r.id).map(c => <option key={c.id} value={c.id}>↳ {c.name}</option>)}</optgroup>))}
              </select>
            )}
            {bulkKind === 'brand' && (<><input list="bulk-brands" value={bulkVal} onChange={e => setBulkVal(e.target.value)} placeholder="Brand (empty clears)" className="input-field py-1.5 text-xs w-40" /><datalist id="bulk-brands">{brands.map(b => <option key={b} value={b} />)}</datalist></>)}
            {bulkKind === 'price' && (<>
              <select aria-label="Type" value={bulkMode} onChange={e => setBulkMode(e.target.value as any)} className="input-field py-1.5 text-xs w-auto"><option value="percent">%</option><option value="amount">KWD</option></select>
              <input type="number" step="any" value={bulkVal} onChange={e => setBulkVal(e.target.value)} placeholder="+10 or -5" className="input-field py-1.5 text-xs w-24" /></>)}
            {bulkKind === 'stock' && <input type="number" min={0} value={bulkVal} onChange={e => setBulkVal(e.target.value)} placeholder="Stock" className="input-field py-1.5 text-xs w-24" />}
            {bulkKind && <button disabled={busy} onClick={applyBulk} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-white ${bulkKind === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}><Check className="w-3.5 h-3.5" />{busy ? 'Working…' : 'Apply'}</button>}
            <button onClick={clearSel} className="ms-auto p-1.5 text-gray-400 hover:text-gray-600" aria-label="Clear selection"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
