'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Pencil, Eye, EyeOff } from 'lucide-react';
import { formatDate, formatPrice } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Coupon } from '@/types';

const EMPTY = { code: '', type: 'percentage' as 'percentage' | 'fixed', value: '' as any, minOrderAmount: '' as any, maxDiscount: '' as any, usageLimit: '' as any, isActive: true, expiresAt: '' };

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

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
      const body = {
        code: String(form.code).trim().toUpperCase(), type: form.type, value: Number(form.value),
        minOrderAmount: form.minOrderAmount === '' ? 0 : Number(form.minOrderAmount),
        maxDiscount: form.maxDiscount === '' || form.maxDiscount == null ? null : Number(form.maxDiscount),
        usageLimit: form.usageLimit === '' || form.usageLimit == null ? null : Number(form.usageLimit),
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
      if (!r.ok) { toast.error('Could not delete the coupon.'); return; }
      setCoupons(cs => cs.filter(c => c.id !== id)); toast.success('Deleted');
    } catch { toast.error('Network error'); }
  };

  const edit = (c: Coupon) => setForm({ ...EMPTY, ...c, maxDiscount: c.maxDiscount ?? '', usageLimit: c.usageLimit ?? '', minOrderAmount: c.minOrderAmount || '', expiresAt: c.expiresAt ? String(c.expiresAt).slice(0, 10) : '' });
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
            <div><label className="label">Type</label><select value={form.type} onChange={e => f('type', e.target.value)} className="input-field"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (KWD)</option></select></div>
            <div><label className="label">Value * {form.type === 'percentage' ? '(%)' : '(KWD)'}</label><input type="number" min="0" step="0.001" value={form.value} onChange={e => f('value', e.target.value)} className="input-field" placeholder={form.type === 'percentage' ? '20' : '2.000'} /></div>
            <div><label className="label">Minimum Order (KWD)</label><input type="number" min="0" step="0.001" value={form.minOrderAmount} onChange={e => f('minOrderAmount', e.target.value)} className="input-field" placeholder="None" /></div>
            <div><label className="label">Max Discount (KWD)</label><input type="number" min="0" step="0.001" value={form.maxDiscount} onChange={e => f('maxDiscount', e.target.value)} className="input-field" placeholder="No cap" /></div>
            <div><label className="label">Usage Limit</label><input type="number" min="0" step="1" value={form.usageLimit} onChange={e => f('usageLimit', e.target.value)} className="input-field" placeholder="Unlimited" /></div>
            <div><label className="label">Valid Through</label><input type="date" value={form.expiresAt} onChange={e => f('expiresAt', e.target.value)} className="input-field" /></div>
            <label className="flex items-center gap-2 pt-6 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.isActive} onChange={e => f('isActive', e.target.checked)} className="w-4 h-4 accent-brand-600" />Active</label>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setForm(null)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
            <button onClick={save} disabled={saving || !String(form.code).trim() || !Number(form.value)} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">{saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Coupon'}</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Used</th><th>Status</th><th>Valid Through</th><th></th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><div className="skeleton h-4 w-full rounded" /></td>)}</tr>)
              : coupons.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No coupons yet</td></tr>
              : coupons.map(c => (
                <tr key={c.id}>
                  <td><code className="bg-gray-100 text-brand-700 font-bold px-2 py-0.5 rounded text-sm">{c.code}</code></td>
                  <td className="text-gray-700 text-sm capitalize">{c.type}</td>
                  <td className="font-bold text-gray-900">{c.type === 'percentage' ? `${c.value}%` : formatPrice(c.value)}</td>
                  <td className="text-gray-700 text-sm">{c.minOrderAmount > 0 ? formatPrice(c.minOrderAmount) : 'Any'}</td>
                  <td className="text-gray-700 text-sm">{c.usedCount || 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td><span className={`badge text-xs font-bold ${expired(c) ? 'badge-red' : c.isActive ? 'badge-green' : 'badge-gray'}`}>{expired(c) ? 'Expired' : c.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="text-gray-500 text-xs">{c.expiresAt ? formatDate(c.expiresAt) : 'No expiry'}</td>
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
