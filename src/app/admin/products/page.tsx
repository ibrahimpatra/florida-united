'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Edit2, Trash2, Eye, ToggleLeft, ToggleRight,
  RefreshCw, Filter, ChevronDown, X, Package,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Product, Category } from '@/types';

export default function AdminProductsPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [debounced, setDebounced] = useState('');
  const reqId = useRef(0);
  const [categoryId, setCategoryId] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [page, setPage]           = useState(1);
  const [sortBy, setSortBy]       = useState('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Load categories once
  useEffect(() => {
    fetch('/api/categories?all=true')
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const fetchProducts = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), sort: sortBy, limit: '20', admin: 'true',
      });
      if (debounced)  params.set('q', debounced);
      if (categoryId) params.set('categoryId', categoryId);
      if (stockFilter) params.set('stock', stockFilter);
      const res  = await fetch(`/api/products?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (my !== reqId.current) return;
      if (!res.ok) throw new Error(data?.error || 'Failed to load products');
      setProducts(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) { if (my === reqId.current) toast.error(e?.message || 'Failed to load products'); }
    if (my === reqId.current) setLoading(false);
  }, [page, sortBy, debounced, categoryId, stockFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const toggleActive = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  const clearFilters = () => {
    setSearch(''); setCategoryId(''); setStockFilter(''); setPage(1);
  };
  const hasFilters = !!(search || categoryId || stockFilter);
  const totalPages = Math.ceil(total / 20);

  // Group: roots + their subcategories for the filter dropdown
  const roots = categories.filter(c => !c.parentId);
  const subs  = (pid: string) => categories.filter(c => c.parentId === pid);

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 font-display">Products</h1>
          <p className="text-gray-500 text-sm">{total} products total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchProducts}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Refresh</span>
          </button>
          <Link href="/admin/products/new" className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /><span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchProducts()}
              placeholder="Search name, SKU, brand..." className="input-field pl-9 py-2 text-sm" />
          </div>
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm transition-colors ${filtersOpen || hasFilters ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 hover:bg-gray-50'}`}>
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasFilters && <span className="w-2 h-2 bg-brand-600 rounded-full" />}
          </button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
            {/* Category filter with subcategories */}
            <div className="flex-1 min-w-40">
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Category</label>
              <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }} className="input-field py-2 text-sm">
                <option value="">All Categories</option>
                {roots.map(root => (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name} (all)</option>
                    {subs(root.id).map(sub => (
                      <option key={sub.id} value={sub.id}>↳ {sub.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex-1 min-w-36">
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Sort By</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field py-2 text-sm">
                <option value="newest">Newest First</option>
                <option value="popular">Most Popular</option>
                <option value="price_asc">Price: Low–High</option>
                <option value="price_desc">Price: High–Low</option>
                <option value="name_asc">Name A–Z</option>
              </select>
            </div>

            {/* Stock */}
            <div className="flex-1 min-w-32">
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Stock Status</label>
              <select value={stockFilter} onChange={e => { setStockFilter(e.target.value); setPage(1); }} className="input-field py-2 text-sm">
                <option value="">All</option>
                <option value="out">Out of Stock</option>
                <option value="low">Low Stock</option>
              </select>
            </div>

            {hasFilters && (
              <div className="flex items-end">
                <button onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                  <X className="w-4 h-4" /> Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop Table ── */}
      <div className="card overflow-hidden hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Product', 'SKU', 'Category', 'Price', 'Stock', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="skeleton h-4 w-full rounded" /></td>
                      ))}
                    </tr>
                  ))
                : products.length === 0
                ? <tr><td colSpan={7} className="text-center py-16 text-gray-400">No products found</td></tr>
                : products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                            {p.images?.[0]
                              ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                              : <span className="flex items-center justify-center h-full text-lg"><Package className="w-5 h-5 text-gray-300" /></span>}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 max-w-[200px] truncate">{p.name}</p>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {p.isFeatured  && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">Featured</span>}
                              {p.isNewArrival && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">New</span>}
                              {p.isOnSale    && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Sale</span>}
                              {p.freeShipping && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">Free</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{p.categoryName || <span className="text-red-400 font-semibold">No category</span>}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{formatPrice(p.price)}</div>
                        {p.comparePrice && <div className="text-xs text-gray-400 line-through">{formatPrice(p.comparePrice)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-sm ${p.stock === 0 ? 'text-red-600' : p.stock <= (p.lowStockAlert ?? 5) ? 'text-orange-500' : 'text-green-600'}`}>
                          {p.stock === 0 ? 'Out' : p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(p)}
                          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${p.isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}>
                          {p.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          {(p as any).isArchived ? 'Archived' : p.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/shop/products/${p.slug}`} target="_blank"
                            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link href={`/admin/products/${p.id}/edit`}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button onClick={() => deleteProduct(p.id, p.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} products)</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-white transition-colors">← Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-white transition-colors">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile Card List ── */}
      <div className="lg:hidden space-y-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-4 flex items-center gap-3">
                <div className="skeleton w-14 h-14 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))
          : products.length === 0
          ? (
            <div className="card p-12 text-center">
              <p className="text-gray-400">No products found</p>
              <button onClick={clearFilters} className="btn-primary mt-4 text-sm">Clear Filters</button>
            </div>
          )
          : products.map(p => (
              <div key={p.id} className="card p-4">
                <div className="flex items-start gap-3">
                  {/* Image */}
                  <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                      : <span className="flex items-center justify-center h-full text-xl"><Package className="w-5 h-5 text-gray-300" /></span>}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm leading-tight truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{p.sku}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{formatPrice(p.price)}</span>
                      {p.comparePrice && <span className="text-xs text-gray-400 line-through">{formatPrice(p.comparePrice)}</span>}
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        p.stock === 0 ? 'bg-red-100 text-red-700' :
                        p.stock <= (p.lowStockAlert ?? 5) ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {p.categoryName && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{p.categoryName}</span>}
                      {p.isFeatured   && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">Featured</span>}
                      {p.isOnSale     && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Sale</span>}
                      {p.freeShipping && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">Free ship</span>}
                    </div>
                  </div>

                  {/* Active toggle */}
                  <button onClick={() => toggleActive(p)} className={`flex-shrink-0 ${p.isActive ? 'text-green-600' : 'text-gray-300'}`}>
                    {p.isActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </div>

                {/* Action row */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Link href={`/admin/products/${p.id}/edit`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Link>
                  <Link href={`/shop/products/${p.slug}`} target="_blank"
                    className="flex items-center justify-center gap-1.5 py-2 px-4 bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-100 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> View
                  </Link>
                  <button onClick={() => deleteProduct(p.id, p.name)}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 border rounded-xl text-sm disabled:opacity-40 hover:bg-white transition-colors">← Prev</button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 border rounded-xl text-sm disabled:opacity-40 hover:bg-white transition-colors">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
