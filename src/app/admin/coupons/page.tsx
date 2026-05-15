'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { formatDate, formatPrice } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Coupon } from '@/types';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code:'', type:'percentage' as 'percentage'|'fixed', value:0, minOrderAmount:0, maxDiscount:'', usageLimit:'', isActive:true, expiresAt:'' });

  useEffect(() => {
    fetch('/api/coupons').then(r=>r.json()).then(d=>{ setCoupons(Array.isArray(d)?d:[]); setLoading(false); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/coupons', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, code: form.code.toUpperCase(), value:Number(form.value), minOrderAmount:Number(form.minOrderAmount), maxDiscount:form.maxDiscount?Number(form.maxDiscount):null, usageLimit:form.usageLimit?Number(form.usageLimit):null, usedCount:0 }) });
      const data = await res.json();
      if (data.success||data.id) {
        toast.success('Coupon created!');
        setShowForm(false);
        const res2 = await fetch('/api/coupons');
        setCoupons(await res2.json());
      } else toast.error(data.error||'Failed');
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon ${code}?`)) return;
    await fetch(`/api/coupons/${id}`, { method:'DELETE' });
    setCoupons(cs=>cs.filter(c=>c.id!==id));
    toast.success('Deleted');
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-gray-900 font-display">Coupons</h1><p className="text-gray-500 text-sm">{coupons.length} coupons</p></div>
        <button onClick={()=>setShowForm(!showForm)} className="btn-primary py-2 px-4 text-sm"><Plus className="w-4 h-4"/>New Coupon</button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <div className="flex justify-between mb-4"><h3 className="font-bold text-gray-800">Create Coupon</h3><button onClick={()=>setShowForm(false)}><X className="w-4 h-4 text-gray-400"/></button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="label">Code *</label><input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} className="input-field font-mono uppercase" placeholder="SUMMER20"/></div>
            <div><label className="label">Type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value as any}))} className="input-field"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed ($)</option></select></div>
            <div><label className="label">Value *</label><input type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:Number(e.target.value)}))} className="input-field" placeholder={form.type==='percentage'?'20':'10.00'}/></div>
            <div><label className="label">Min Order ($)</label><input type="number" value={form.minOrderAmount} onChange={e=>setForm(f=>({...f,minOrderAmount:Number(e.target.value)}))} className="input-field"/></div>
            <div><label className="label">Max Discount ($)</label><input type="number" value={form.maxDiscount} onChange={e=>setForm(f=>({...f,maxDiscount:e.target.value}))} className="input-field" placeholder="Optional"/></div>
            <div><label className="label">Usage Limit</label><input type="number" value={form.usageLimit} onChange={e=>setForm(f=>({...f,usageLimit:e.target.value}))} className="input-field" placeholder="Unlimited"/></div>
            <div><label className="label">Expires At</label><input type="date" value={form.expiresAt} onChange={e=>setForm(f=>({...f,expiresAt:e.target.value}))} className="input-field"/></div>
            <div className="flex items-center gap-2 pt-5"><input type="checkbox" id="ca" checked={form.isActive} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))} className="w-4 h-4 accent-brand-600"/><label htmlFor="ca" className="text-sm font-medium text-gray-700">Active</label></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={()=>setShowForm(false)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving||!form.code||!form.value} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">{saving?'Creating...':'Create Coupon'}</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Used</th><th>Status</th><th>Expires</th><th></th></tr></thead>
        <tbody>
          {loading ? Array.from({length:5}).map((_,i)=><tr key={i}>{Array.from({length:8}).map((_,j)=><td key={j}><div className="skeleton h-4 w-full rounded"/></td>)}</tr>)
          : coupons.length===0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No coupons yet</td></tr>
          : coupons.map(c=>(
            <tr key={c.id}>
              <td><code className="bg-gray-100 text-brand-700 font-bold px-2 py-0.5 rounded text-sm">{c.code}</code></td>
              <td className="text-gray-700 text-sm capitalize">{c.type}</td>
              <td className="font-bold text-gray-900">{c.type==='percentage'?`${c.value}%`:formatPrice(c.value)}</td>
              <td className="text-gray-700 text-sm">{c.minOrderAmount>0?formatPrice(c.minOrderAmount):'Any'}</td>
              <td className="text-gray-700 text-sm">{c.usedCount}{c.usageLimit?` / ${c.usageLimit}`:''}</td>
              <td><span className={`badge text-xs font-bold ${c.isActive?'badge-green':'badge-gray'}`}>{c.isActive?'Active':'Inactive'}</span></td>
              <td className="text-gray-500 text-xs">{c.expiresAt?formatDate(c.expiresAt):'Never'}</td>
              <td><button onClick={()=>handleDelete(c.id,c.code)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button></td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
