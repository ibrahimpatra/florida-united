'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Edit2, Trash2, Eye, ToggleLeft, ToggleRight, RefreshCw, Upload } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Product } from '@/types';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('newest');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), sort: sortBy, limit: '20' });
      if (search) params.set('q', search);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.items || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, [page, sortBy, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const toggleActive = async (product: Product) => {
    try {
      await fetch(`/api/products/${product.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isActive: !product.isActive }) });
      setProducts(ps => ps.map(p => p.id===product.id ? {...p, isActive:!p.isActive} : p));
      toast.success(`Product ${!product.isActive?'activated':'deactivated'}`);
    } catch { toast.error('Failed'); }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/products/${id}`, { method:'DELETE' });
      setProducts(ps => ps.filter(p => p.id !== id));
      toast.success('Product deleted');
    } catch { toast.error('Delete failed'); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Products</h1>
          <p className="text-gray-500 text-sm">{total} products total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchProducts} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4"/>Refresh
          </button>
          <Link href="/admin/products/new" className="btn-primary py-2 px-4 text-sm">
            <Plus className="w-4 h-4"/>Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchProducts()}
            placeholder="Search products, SKU, brand..." className="input-field pl-9 py-2 text-sm"/>
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="input-field py-2 text-sm w-44">
          <option value="newest">Newest First</option>
          <option value="popular">Most Popular</option>
          <option value="price_asc">Price: Low-High</option>
          <option value="price_desc">Price: High-Low</option>
          <option value="name_asc">Name A-Z</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrapper rounded-none">
          <table className="table">
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:7}).map((_,j)=><td key={j}><div className="skeleton h-4 w-full rounded"/></td>)}</tr>
                ))
              ) : products.length===0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No products found</td></tr>
              ) : products.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover"/> : <span className="flex items-center justify-center h-full text-lg">📦</span>}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm max-w-[180px] truncate">{p.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {p.isFeatured && <span className="badge-blue badge text-xs">Featured</span>}
                          {p.isNewArrival && <span className="badge-green badge text-xs">New</span>}
                          {p.isOnSale && <span className="badge-red badge text-xs">Sale</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="text-gray-700 text-sm">{p.categoryName || '—'}</td>
                  <td>
                    <div>
                      <span className="font-bold text-gray-900">{formatPrice(p.price)}</span>
                      {p.comparePrice && <span className="text-xs text-gray-400 line-through ml-1">{formatPrice(p.comparePrice)}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`font-bold text-sm ${p.stock===0?'text-red-600':p.stock<=((p.lowStockAlert ?? 5)??5)?'text-orange-600':'text-green-600'}`}>
                      {p.stock===0?'Out of Stock':p.stock}
                    </span>
                  </td>
                  <td>
                    <button onClick={()=>toggleActive(p)} className={`flex items-center gap-1.5 text-xs font-semibold ${p.isActive?'text-green-600':'text-gray-400'}`}>
                      {p.isActive ? <ToggleRight className="w-4 h-4"/> : <ToggleLeft className="w-4 h-4"/>}
                      {p.isActive?'Active':'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link href={`/shop/products/${p.slug}`} target="_blank" className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4"/></Link>
                      <Link href={`/admin/products/${p.id}/edit`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-4 h-4"/></Link>
                      <button onClick={()=>deleteProduct(p.id, p.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages>1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} products)</p>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
