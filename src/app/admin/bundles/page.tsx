'use client';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { SeoFields, AiFillButton } from '@/components/admin/SeoFields';
import { TranslateButton } from '@/components/admin/TranslateButton';
import { NumberInput } from '@/components/ui/NumberInput';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X, Package, Search, ToggleLeft, ToggleRight, Gift } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

interface BundleItem { productId: string; productName: string; quantity: number; price: number; image?: string; }
interface Bundle {
  id: string; name: string; description: string; slug: string;
  items: BundleItem[]; bundlePrice: number; comparePrice?: number;
  discount: number; discountType: 'percentage' | 'fixed';
  image?: string; isActive: boolean; tags: string[];
  createdAt?: string;
}

const EMPTY_BUNDLE = {
  name: '', nameAr: '', description: '', descriptionAr: '', slug: '', image: '',
  items: [] as BundleItem[], bundlePrice: 0, comparePrice: 0,
  discount: 0, discountType: 'percentage' as const, isActive: true, tags: [],
};

export default function AdminBundlesPage() {
  const [bundles, setBundles]   = useState<Bundle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Bundle | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm]         = useState<any>(EMPTY_BUNDLE);
  const [saving, setSaving]     = useState(false);

  // Product search for adding items
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/bundles');
      const data = await res.json();
      setBundles(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load bundles'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setProductResults([]); return; }
    setSearching(true);
    try {
      const res  = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=8&admin=true`);
      const data = await res.json();
      setProductResults(data.items || []);
    } catch {}
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch, searchProducts]);

  const addItem = (product: Product) => {
    if (form.items.find((i: BundleItem) => i.productId === product.id)) {
      toast('Already in bundle'); return;
    }
    const item: BundleItem = {
      productId: product.id, productName: product.name,
      quantity: 1, price: product.price, image: product.images?.[0],
    };
    setForm((f: any) => ({ ...f, items: [...f.items, item] }));
    setProductSearch(''); setProductResults([]);
  };

  const updateItem = (idx: number, key: string, value: any) => {
    setForm((f: any) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...f, items };
    });
  };

  const removeItem = (idx: number) =>
    setForm((f: any) => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) }));

  // Auto-calc bundle total
  const itemsTotal = form.items.reduce((s: number, i: BundleItem) => s + i.price * i.quantity, 0);

  const startEdit = (b: Bundle) => {
    setEditing(b); setCreating(false);
    setForm({ ...b });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.items.length < 2) { toast.error('A bundle needs at least 2 products'); return; }
    if (!form.bundlePrice) { toast.error('Bundle price is required'); return; }
    setSaving(true);
    try {
      const url    = editing ? `/api/bundles/${editing.id}` : '/api/bundles';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data   = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || `Save failed (${res.status})`); return; }
      toast.success(editing ? 'Bundle updated!' : 'Bundle created!');
      setEditing(null); setCreating(false); setForm(EMPTY_BUNDLE);
      load();
    } catch { toast.error('Network error - please try again'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (b: Bundle) => {
    try {
      const r = await fetch(`/api/bundles/${b.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.error || 'Failed'); return; }
      setBundles(bs => bs.map(x => x.id === b.id ? { ...x, isActive: !x.isActive } : x));
      toast.success(b.isActive ? 'Bundle deactivated' : 'Bundle activated');
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete bundle "${name}"?`)) return;
    try {
      await fetch(`/api/bundles/${id}`, { method: 'DELETE' });
      setBundles(bs => bs.filter(b => b.id !== id));
      toast.success('Bundle deleted');
    } catch { toast.error('Delete failed'); }
  };

  const f = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  return (
    <div className="p-3 lg:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Gift className="w-6 h-6 text-brand-600" /> Product Bundles
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Group products into kits with a combined discount</p>
        </div>
        {!creating && !editing && (
          <button onClick={() => { setCreating(true); setEditing(null); setForm(EMPTY_BUNDLE); }}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Bundle
          </button>
        )}
      </div>

      {/* ── Form ── */}
      {(creating || editing) && (
        <div className="card p-5 mb-4 border-2 border-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800 text-lg">{editing ? `Edit: ${editing.name}` : 'New Bundle'}</h3>
            <button onClick={() => { setEditing(null); setCreating(false); setForm(EMPTY_BUNDLE); }}
              className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="label">Bundle Name *</label>
                <input value={form.name} onChange={e => f('name', e.target.value)}
                  className="input-field" placeholder="e.g. Electrical Starter Kit" />
              </div>
              <div className="flex">
                <TranslateButton context="a product bundle of a hardware store" fields={[
                  { en: form.name, ar: form.nameAr, set: v => f('nameAr', v) },
                  { en: form.description, ar: form.descriptionAr, set: v => f('descriptionAr', v) },
                ]} />
              </div>
              <div>
                <label className="label">Arabic Name <span dir="rtl" className="text-gray-400 font-normal">(الاسم بالعربية)</span></label>
                <input value={form.nameAr || ''} onChange={e => f('nameAr', e.target.value)} dir="rtl" lang="ar"
                  className="input-field" placeholder="مثال: طقم التمديدات الكهربائية" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={e => f('description', e.target.value)}
                  className="input-field resize-none h-20 text-sm"
                  placeholder="What's included and why it's great..." />
              </div>
              <div>
                <label className="label">Arabic Description <span dir="rtl" className="text-gray-400 font-normal">(الوصف بالعربية)</span></label>
                <textarea value={form.descriptionAr || ''} onChange={e => f('descriptionAr', e.target.value)} dir="rtl" lang="ar"
                  className="input-field resize-none h-20 text-sm" />
              </div>
              <ImageUploadField label="Bundle picture" value={form.image || ''} onChange={v => f('image', v)} folder="bundles" name={form.name} maxSide={1000} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Bundle Price (KD) *</label>
                  <NumberInput type="number" step="0.001" value={form.bundlePrice}
                    onChange={e => f('bundlePrice', Number(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="label">Compare Price (KD)</label>
                  <NumberInput type="number" step="0.001" value={form.comparePrice || ''}
                    onChange={e => f('comparePrice', Number(e.target.value))} className="input-field"
                    placeholder={itemsTotal ? itemsTotal.toFixed(3) : ''} />
                </div>
              </div>
              {itemsTotal > 0 && form.bundlePrice > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                  Save {formatPrice(itemsTotal - form.bundlePrice)} vs buying separately
                  ({((1 - form.bundlePrice / itemsTotal) * 100).toFixed(0)}% off)
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => f('isActive', e.target.checked)}
                  className="w-4 h-4 accent-brand-600 rounded" />
                <span className="text-sm text-gray-700 font-medium">Active (visible in store)</span>
              </label>
            </div>

            <div>
              <label className="label">Add Products to Bundle</label>
              {/* Product search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                  className="input-field pl-9 text-sm" placeholder="Search products by name or SKU..." />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {productResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-64 overflow-y-auto">
                    {productResults.map(p => (
                      <button key={p.id} onClick={() => addItem(p)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-50 transition-colors text-left border-b border-gray-50 last:border-0">
                        <div className="w-9 h-9 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 m-2 text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{formatPrice(p.price)}</p>
                        </div>
                        <Plus className="w-4 h-4 text-brand-600 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items list */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {form.items.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                    Search and add at least 2 products
                  </p>
                ) : form.items.map((item: BundleItem, idx: number) => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="w-10 h-10 bg-white rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 m-2.5 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.productName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Qty:</span>
                        <NumberInput type="number" min="1" value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="w-16 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-center" />
                        <span className="text-xs text-gray-500">@ KD</span>
                        <NumberInput type="number" step="0.001" value={item.price}
                          onChange={e => updateItem(idx, 'price', Number(e.target.value))}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-center" />
                      </div>
                    </div>
                    <button onClick={() => removeItem(idx)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {form.items.length > 0 && (
                <div className="mt-3 text-sm text-gray-500 flex justify-between">
                  <span>{form.items.length} items, {form.items.reduce((s: number, i: BundleItem) => s + i.quantity, 0)} units</span>
                  <span className="font-semibold">Total retail: {formatPrice(itemsTotal)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <AiFillButton collection="bundles" doc={form} onPatch={p => setForm((x: any) => ({ ...x, ...p }))} label="Fill Arabic + SEO with AI" />
            <SeoFields value={form} onChange={p => setForm((x: any) => ({ ...x, ...p }))} />
          </div>

          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => { setEditing(null); setCreating(false); setForm(EMPTY_BUNDLE); }}
              className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {editing ? 'Save Changes' : 'Create Bundle'}
            </button>
          </div>
        </div>
      )}

      {/* ── Bundle Cards ── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="card h-48 skeleton" />)}
        </div>
      ) : bundles.length === 0 ? (
        <div className="card p-16 text-center">
          <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold text-lg">No bundles yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first product bundle to offer combined discounts</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map(b => (
            <div key={b.id} className={`card overflow-hidden ${!b.isActive ? 'opacity-60' : ''}`}>
              {b.image && <img src={b.image} alt={b.name} className="w-full h-36 object-cover" />}
              {!b.image && (
                <div className="w-full h-28 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
                  <Gift className="w-10 h-10 text-brand-400" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-800 text-sm leading-tight">{b.name}</h3>
                  <button onClick={() => toggleActive(b)}
                    className={b.isActive ? 'text-green-500' : 'text-gray-300'}>
                    {b.isActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </div>
                {b.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{b.description}</p>}
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-black text-brand-700 text-lg">{formatPrice(b.bundlePrice)}</span>
                  {b.comparePrice && b.comparePrice > b.bundlePrice && (
                    <span className="text-sm text-gray-400 line-through">{formatPrice(b.comparePrice)}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(b.items || []).slice(0, 4).map((item, i) => (
                    <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.productName.split(' ').slice(0, 2).join(' ')}
                    </span>
                  ))}
                  {(b.items || []).length > 4 && (
                    <span className="text-[10px] text-gray-400">+{b.items.length - 4} more</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(b)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => handleDelete(b.id, b.name)}
                    className="flex items-center justify-center py-2 px-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
