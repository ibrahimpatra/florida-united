'use client';
import { NumberInput } from '@/components/ui/NumberInput';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Pencil, Eye, EyeOff } from 'lucide-react';
import { formatDate, formatPrice } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Coupon } from '@/types';
import { EntityPicker, categoryWithDescendants } from '@/components/admin/EntityPicker';

const TYPE_LABEL: Record<string, string> = { percentage: 'Percentage', fixed: 'Fixed amount', free_shipping: 'Free delivery', buy_x_get_y: 'Buy X get Y' };
const SEG_LABEL: Record<string, string> = { all: 'Everyone', new: 'New customers (no orders yet)', returning: 'Returning customers', vip: 'VIP (spent KD 200+)', inactive: 'Not ordered for 90+ days' };

const EMPTY = { code: '', type: 'percentage' as 'percentage' | 'fixed', value: '' as any, minOrderAmount: '' as any, maxDiscount: '' as any, usageLimit: '' as any, perUserLimit: '' as any, isActive: true, expiresAt: '', startsAt: '', showInAccount: false, segment: 'all', buyQty: 2, getQty: 1, scope: 'all' as 'all' | 'category' | 'products', categoryIds: [] as string[], productIds: [] as string[] };
const needsValue = (t: string) => t === 'percentage' || t === 'fixed';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [withSubs, setWithSubs] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/coupons', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to load coupons');
      setCoupons(Array.isArray(d) ? d : []);
    } catch (e: any) { toast.error(e.message || 'Failed to load coupons'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (saving || !form) return;
    setSaving(true);
    try {
      if (form.scope === 'category' && !(form.categoryIds || []).length) { toast.error('Pick at least one category.'); setSaving(false); return; }
      if (form.scope === 'products' && !(form.productIds || []).length) { toast.error('Pick at least one product.'); setSaving(false); return; }
      let categoryIds: string[] = form.scope === 'category' ? form.categoryIds : [];
      if (form.scope === 'category' && withSubs) categoryIds = [...new Set((await Promise.all(categoryIds.map(categoryWithDescendants))).flat())];
      const body = {
        code: String(form.code).trim().toUpperCase(), type: form.type, value: needsValue(form.type) ? Number(form.value) : 0,
        buyQty: Number(form.buyQty) || 0, getQty: Number(form.getQty) || 0,
        showInAccount: !!form.showInAccount, segment: form.segment || 'all', startsAt: form.startsAt || null,
        categoryIds, productIds: form.scope === 'products' ? form.productIds : [],
        minOrderAmount: form.minOrderAmount === '' ? 0 : Number(form.minOrderAmount),
        maxDiscount: form.maxDiscount === '' || form.maxDiscount == null ? null : Number(form.maxDiscount),
        usageLimit: form.usageLimit === '' || form.usageLimit == null ? null : Number(form.usageLimit),
        perUserLimit: form.perUserLimit === '' || form.perUserLimit == null ? null : Number(form.perUserLimit),
        isActive: !!form.isActive, expiresAt: form.expiresAt || null,
      };
      const res = await fetch(form.id ? `/api/coupons/${form.id}` : '/api/coupons', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || `Could not save (${res.status})`); return; }
      toast.success(form.id ? 'Coupon updated.' : 'Coupon created.');
      setForm(null); load();
    } catch { toast.error('Network error - not saved'); }
    finally { setSaving(false); }
  };

  const toggle = async (c: Coupon) => {
    try {
      const r = await fetch(`/api/coupons/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !c.isActive }) });
      if (!r.ok) { toast.error('Could not update the coupon.'); return; }
      setCoupons(cs => cs.map(x => x.id === c.id ? { ...x, isActive: !x.isActive } : x));
    } catch { toast.error('Network error'); }
  };

  const remove = async (id: string, code: string) => {
    if (!confirm(`Delete coupon ${code}?`)) return;
    try {
      const r = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'Could not delete the coupon.'); return; }
      if (j.archived) { setCoupons(cs => cs.map(c => c.id === id ? { ...c, isActive: false } : c)); toast(j.message, { icon: 'i', duration: 6000 }); }
      else { setCoupons(cs => cs.filter(c => c.id !== id)); toast.success('Deleted'); }
    } catch { toast.error('Network error'); }
  };

  const edit = (c: Coupon) => setForm({ ...EMPTY, ...c, maxDiscount: c.maxDiscount ?? '', usageLimit: c.usageLimit ?? '', perUserLimit: c.perUserLimit ?? '', minOrderAmount: c.minOrderAmount || '', expiresAt: c.expiresAt ? String(c.expiresAt).slice(0, 10) : '', startsAt: c.startsAt ? new Date(new Date(c.startsAt).getTime() + 3 * 3600e3).toISOString().slice(0, 10) : '', showInAccount: !!c.showInAccount, segment: c.segment || 'all', buyQty: c.buyQty || 2, getQty: c.getQty || 1, scope: (c.productIds?.length ? 'products' : c.categoryIds?.length ? 'category' : 'all'), categoryIds: c.categoryIds || [], productIds: c.productIds || [] });
  const expired = (c: Coupon) => !!c.expiresAt && new Date(c.expiresAt) < new Date();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900 font-display">Coupons</h1><p className="text-gray-500 text-sm">{coupons.length} coupons</p></div>
        <button onClick={() => setForm({ ...EMPTY })} className="btn-primary py-2 px-4 text-sm"><Plus className="w-4 h-4" />New Coupon</button>
      </div>

      {form && (
        <div className="card p-4 sm:p-6 mb-6">
          <div className="flex justify-between mb-4"><h3 className="font-bold text-gray-800">{form.id ? 'Edit Coupon' : 'Create Coupon'}</h3><button onClick={() => setForm(null)}><X className="w-4 h-4 text-gray-400" /></button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="label">Code *</label><input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} className="input-field font-mono uppercase" placeholder="SUMMER20" /></div>
            <div><label className="label">Type</label><select value={form.type} onChange={e => f('type', e.target.value)} className="input-field"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (KWD)</option><option value="free_shipping">Free delivery</option><option value="buy_x_get_y">Buy X get Y free</option></select></div>
            {needsValue(form.type) && <div><label className="label">Value * {form.type === 'percentage' ? '(%)' : '(KWD)'}</label><NumberInput type="number" min="0" step="0.001" value={form.value} onChange={e => f('value', e.target.value)} className="input-field" placeholder={form.type === 'percentage' ? '20' : '2.000'} /></div>}
            {form.type === 'buy_x_get_y' && <>
              <div><label className="label">Customer buys *</label><NumberInput type="number" min="1" step="1" value={form.buyQty} onChange={e => f('buyQty', e.target.value)} className="input-field" /></div>
              <div><label className="label">Gets free * <span className="text-gray-400 font-normal">(cheapest items)</span></label><NumberInput type="number" min="1" step="1" value={form.getQty} onChange={e => f('getQty', e.target.value)} className="input-field" /></div>
            </>}
            <div><label className="label">Minimum Order (KWD)</label><NumberInput type="number" min="0" step="0.001" value={form.minOrderAmount} onChange={e => f('minOrderAmount', e.target.value)} className="input-field" placeholder="None" /></div>
            {form.type === 'percentage' && <div><label className="label">Max Discount (KWD)</label><NumberInput type="number" min="0" step="0.001" value={form.maxDiscount} onChange={e => f('maxDiscount', e.target.value)} className="input-field" placeholder="No cap" /></div>}
            <div><label className="label">Usage Limit</label><NumberInput type="number" min="0" step="1" value={form.usageLimit} onChange={e => f('usageLimit', e.target.value)} className="input-field" placeholder="Unlimited" /></div>
            <div><label className="label">Uses per customer</label>
              <select value={String(form.perUserLimit ?? '')} onChange={e => f('perUserLimit', e.target.value)} className="input-field">
                <option value="">Unlimited</option><option value="1">Once per customer</option><option value="2">Twice per customer</option><option value="3">3 times per customer</option><option value="5">5 times per customer</option>
              </select></div>
            <div><label className="label">Who can use it</label><select value={form.segment} onChange={e => f('segment', e.target.value)} className="input-field">{Object.entries(SEG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Starts on</label><input type="date" value={form.startsAt} onChange={e => f('startsAt', e.target.value)} className="input-field" /></div>
            <div><label className="label">Valid Through</label><input type="date" value={form.expiresAt} onChange={e => f('expiresAt', e.target.value)} className="input-field" /></div>
            <label className="flex items-center gap-2 pt-6 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.showInAccount} onChange={e => f('showInAccount', e.target.checked)} className="w-4 h-4 accent-brand-600" />Show in matching customers' accounts</label>
            <label className="flex items-center gap-2 pt-6 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.isActive} onChange={e => f('isActive', e.target.checked)} className="w-4 h-4 accent-brand-600" />Active</label>
          </div>
          {form.type !== 'free_shipping' && (
            <div className="mt-4 space-y-2">
              <label className="label">Applies to</label>
              <div className="grid grid-cols-3 gap-2 max-w-md">
                {([['all', 'Whole cart'], ['category', 'Categories'], ['products', 'Products']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => f('scope', v)} className={`py-2 px-2 rounded-xl border-2 text-xs sm:text-sm font-semibold ${form.scope === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{l}</button>
                ))}
              </div>
              {form.scope === 'category' && <>
                <EntityPicker kind="category" multiple value={form.categoryIds || []} onChange={ids => f('categoryIds', ids)} placeholder="Search categories and sub-categories…" />
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={withSubs} onChange={e => setWithSubs(e.target.checked)} className="w-4 h-4" />Include every sub-category under the ones I pick</label>
              </>}
              {form.scope === 'products' && <EntityPicker kind="product" multiple value={form.productIds || []} onChange={ids => f('productIds', ids)} />}
              <p className="text-xs text-gray-500">Offers on a product (flash deals) that are marked "no coupons" still block any coupon in the cart. The minimum order is checked on the whole cart.</p>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setForm(null)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
            <button onClick={save} disabled={saving || !String(form.code).trim() || (needsValue(form.type) && !Number(form.value))} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">{saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Coupon'}</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Used</th><th>Status</th><th>Valid</th><th></th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton h-4 w-full rounded" /></td>)}</tr>)
              : coupons.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No coupons yet</td></tr>
              : coupons.map(c => (
                <tr key={c.id}>
                  <td><code className="bg-gray-100 text-brand-700 font-bold px-2 py-0.5 rounded text-sm">{c.code}</code></td>
                  <td className="text-gray-700 text-sm">{TYPE_LABEL[c.type] || c.type}{c.segment && c.segment !== 'all' ? <span className="block text-xs text-gray-400">{SEG_LABEL[c.segment]}</span> : null}{(c.productIds?.length || c.categoryIds?.length) ? <span className="block text-xs text-gray-400">selected {c.productIds?.length ? 'products' : 'categories'}</span> : null}</td>
                  <td className="font-bold text-gray-900">{c.type === 'percentage' ? `${c.value}%` : c.type === 'fixed' ? formatPrice(c.value) : c.type === 'free_shipping' ? 'Free delivery' : `Buy ${c.buyQty}, get ${c.getQty} free`}</td>
                  <td className="text-gray-700 text-sm">{c.minOrderAmount > 0 ? formatPrice(c.minOrderAmount) : 'Any'}</td>
                  <td className="text-gray-700 text-sm">{c.usedCount || 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}{c.perUserLimit ? <span className="block text-xs text-gray-400">{c.perUserLimit === 1 ? 'once per customer' : `${c.perUserLimit} per customer`}</span> : null}</td>
                  <td><span className={`badge text-xs font-bold ${expired(c) ? 'badge-red' : c.isActive ? 'badge-green' : 'badge-gray'}`}>{expired(c) ? 'Expired' : c.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="text-gray-500 text-xs">{c.startsAt ? `${formatDate(c.startsAt)} → ` : ''}{c.expiresAt ? formatDate(c.expiresAt) : 'No expiry'}</td>
                  <td className="whitespace-nowrap">
                    <button onClick={() => toggle(c)} title={c.isActive ? 'Deactivate' : 'Activate'} className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg">{c.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    <button onClick={() => edit(c)} title="Edit" className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(c.id, c.code)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
