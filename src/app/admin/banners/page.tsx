'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'', subtitle:'', image:'', link:'', buttonText:'Shop Now', isActive:true, sortOrder:0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/banners').then(r=>r.json()).then(d=>{ setBanners(Array.isArray(d)?d:[]); setLoading(false); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/banners', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.id||data.success) { toast.success('Banner created!'); setShowForm(false); setForm({ title:'', subtitle:'', image:'', link:'', buttonText:'Shop Now', isActive:true, sortOrder:0 }); fetch('/api/banners').then(r=>r.json()).then(d=>setBanners(Array.isArray(d)?d:[])); }
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    await fetch(`/api/banners/${id}`, { method:'DELETE' });
    setBanners(bs=>bs.filter(b=>b.id!==id));
    toast.success('Deleted');
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-gray-900 font-display">Banners & Promotions</h1><p className="text-gray-500 text-sm">{banners.length} banners</p></div>
        <button onClick={()=>setShowForm(!showForm)} className="btn-primary py-2 px-4 text-sm"><Plus className="w-4 h-4"/>Add Banner</button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="font-bold text-gray-800 mb-4">New Banner</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Title *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="input-field" placeholder="Summer Sale"/></div>
            <div><label className="label">Subtitle</label><input value={form.subtitle} onChange={e=>setForm(f=>({...f,subtitle:e.target.value}))} className="input-field" placeholder="Up to 40% Off"/></div>
            <div className="sm:col-span-2"><label className="label">Image URL *</label><input value={form.image} onChange={e=>setForm(f=>({...f,image:e.target.value}))} className="input-field" placeholder="https://..."/></div>
            <div><label className="label">Link URL</label><input value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))} className="input-field" placeholder="/shop/electrical"/></div>
            <div><label className="label">Button Text</label><input value={form.buttonText} onChange={e=>setForm(f=>({...f,buttonText:e.target.value}))} className="input-field"/></div>
            <div><label className="label">Sort Order</label><input type="number" value={form.sortOrder} onChange={e=>setForm(f=>({...f,sortOrder:Number(e.target.value)}))} className="input-field"/></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="ba" checked={form.isActive} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))} className="w-4 h-4 accent-brand-600"/><label htmlFor="ba" className="text-sm font-medium">Active</label></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={()=>setShowForm(false)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving||!form.title||!form.image} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">{saving?'Creating...':'Create Banner'}</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? Array.from({length:3}).map((_,i)=><div key={i} className="card p-4"><div className="skeleton h-20 w-full rounded-xl"/></div>)
        : banners.length===0 ? <div className="card p-16 text-center text-gray-400"><p className="text-lg font-medium mb-1">No banners yet</p><p className="text-sm">Add a banner to display on your homepage carousel</p></div>
        : banners.map(b=>(
          <div key={b.id} className="card p-4 flex items-center gap-4">
            <GripVertical className="w-5 h-5 text-gray-300 cursor-grab flex-shrink-0"/>
            <div className="w-32 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
              {b.image && <img src={b.image} alt={b.title} className="w-full h-full object-cover"/>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800">{b.title}</p>
              {b.subtitle && <p className="text-sm text-gray-500">{b.subtitle}</p>}
              {b.link && <p className="text-xs text-brand-600">{b.link}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge text-xs font-bold ${b.isActive?'badge-green':'badge-gray'}`}>{b.isActive?'Active':'Inactive'}</span>
              <button onClick={()=>deleteBanner(b.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
