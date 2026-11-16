'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

const EMPTY = { title: '', titleAr: '', subtitle: '', subtitleAr: '', image: '', link: '', buttonText: 'Shop Now', buttonTextAr: 'تسوق الآن', isActive: true, sortOrder: 0 };

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any | null>(null); // null = closed
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/banners?all=true', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to load');
      setBanners(Array.isArray(d) ? d : []);
    } catch (e: any) { toast.error(e.message || 'Failed to load banners'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (saving || !form) return;
    setSaving(true);
    try {
      const url = form.id ? `/api/banners/${form.id}` : '/api/banners';
      const res = await fetch(url, { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || `Could not save (${res.status})`); return; }
      toast.success(form.id ? 'Banner updated.' : 'Banner created.');
      setForm(null); load();
    } catch { toast.error('Network error - not saved'); }
    finally { setSaving(false); }
  };

  const toggle = async (b: any) => {
    try {
      const r = await fetch(`/api/banners/${b.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !b.isActive }) });
      if (!r.ok) { toast.error('Could not update the banner.'); return; }
      setBanners(bs => bs.map(x => x.id === b.id ? { ...x, isActive: !x.isActive } : x));
    } catch { toast.error('Network error'); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    try {
      const r = await fetch(`/api/banners/${id}`, { method: 'DELETE' });
      if (!r.ok) { toast.error('Could not delete the banner.'); return; }
      setBanners(bs => bs.filter(b => b.id !== id)); toast.success('Deleted');
    } catch { toast.error('Network error'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Homepage Banners</h1>
          <p className="text-gray-500 text-sm">{banners.length} banners. Active banners replace the default hero slides on the homepage, in sort order.</p>
        </div>
        <button onClick={() => setForm({ ...EMPTY, sortOrder: banners.length })} className="btn-primary py-2 px-4 text-sm"><Plus className="w-4 h-4" />Add Banner</button>
      </div>

      {form && (
        <div className="card p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">{form.id ? 'Edit Banner' : 'New Banner'}</h3>
            <button onClick={() => setForm(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Title *</label><input value={form.title} onChange={e => f('title', e.target.value)} className="input-field" placeholder="Summer Sale" /></div>
            <div><label className="label">Arabic Title <span dir="rtl" className="text-gray-400 font-normal">(العنوان بالعربية)</span></label><input value={form.titleAr || ''} onChange={e => f('titleAr', e.target.value)} dir="rtl" lang="ar" className="input-field" placeholder="تخفيضات الصيف" /></div>
            <div><label className="label">Subtitle</label><input value={form.subtitle || ''} onChange={e => f('subtitle', e.target.value)} className="input-field" placeholder="Up to 40% off selected items" /></div>
            <div><label className="label">Arabic Subtitle <span dir="rtl" className="text-gray-400 font-normal">(الوصف بالعربية)</span></label><input value={form.subtitleAr || ''} onChange={e => f('subtitleAr', e.target.value)} dir="rtl" lang="ar" className="input-field" placeholder="خصم يصل إلى 40% على منتجات مختارة" /></div>
            <div className="sm:col-span-2"><label className="label">Image URL *</label><input value={form.image} onChange={e => f('image', e.target.value)} className="input-field" placeholder="https://..." /></div>
            <div><label className="label">Link</label><input value={form.link || ''} onChange={e => f('link', e.target.value)} className="input-field" placeholder="/shop/electrical" /></div>
            <div><label className="label">Sort Order</label><input type="number" value={form.sortOrder} onChange={e => f('sortOrder', Number(e.target.value))} className="input-field" /></div>
            <div><label className="label">Button Text</label><input value={form.buttonText || ''} onChange={e => f('buttonText', e.target.value)} className="input-field" /></div>
            <div><label className="label">Arabic Button Text <span dir="rtl" className="text-gray-400 font-normal">(نص الزر)</span></label><input value={form.buttonTextAr || ''} onChange={e => f('buttonTextAr', e.target.value)} dir="rtl" lang="ar" className="input-field" /></div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.isActive} onChange={e => f('isActive', e.target.checked)} className="w-4 h-4 accent-brand-600" />Active</label>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setForm(null)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim() || !form.image.trim()} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">{saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Banner'}</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="card p-4"><div className="skeleton h-20 w-full rounded-xl" /></div>)
          : banners.length === 0 ? <div className="card p-12 text-center text-gray-400"><p className="text-lg font-medium mb-1">No banners yet</p><p className="text-sm">Without banners the homepage shows its default slides.</p></div>
          : banners.map(b => (
            <div key={b.id} className="card p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
              <div className="w-28 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {b.image && <img src={b.image} alt={b.title} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 truncate">{b.title}{b.titleAr && <span className="text-gray-400 font-normal" dir="rtl"> / {b.titleAr}</span>}</p>
                {b.subtitle && <p className="text-sm text-gray-500 truncate">{b.subtitle}</p>}
                {b.link && <p className="text-xs text-brand-600 truncate">{b.link}</p>}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <span className={`badge text-xs font-bold ${b.isActive ? 'badge-green' : 'badge-gray'}`}>{b.isActive ? 'Active' : 'Hidden'}</span>
                <button onClick={() => toggle(b)} title={b.isActive ? 'Hide' : 'Show'} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-50 rounded-xl">{b.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                <button onClick={() => setForm({ ...EMPTY, ...b })} title="Edit" className="p-2 text-gray-400 hover:text-brand-600 hover:bg-gray-50 rounded-xl"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(b.id)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
