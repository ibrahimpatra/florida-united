'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { SeoFields, AiFillButton } from '@/components/admin/SeoFields';
import { TranslateButton } from '@/components/admin/TranslateButton';

const SWATCHES = ['#b91c1c', '#c2410c', '#15803d', '#1d4ed8', '#7c3aed', '#111827'];
const EMPTY = { title: '', titleAr: '', badge: '', badgeAr: '', link: '/shop', image: '', color: '#b91c1c', isActive: true, sortOrder: 0 };

export default function AdminPromoTilesPage() {
  const [tiles, setTiles] = useState<any[]>([]);
  const [form, setForm] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetch('/api/promo-tiles?all=true', { cache: 'no-store' }); const d = await r.json(); setTiles(Array.isArray(d) ? d : []); } catch { toast.error('Could not load tiles'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (saving || !form) return; setSaving(true);
    try {
      const r = await fetch('/api/promo-tiles', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast.error(d.error || 'Could not save');
      toast.success('Saved'); setForm(null); load();
    } finally { setSaving(false); }
  };
  const patch = async (id: string, body: any) => { const r = await fetch('/api/promo-tiles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }); if (!r.ok) toast.error('Could not update'); load(); };
  const remove = async (id: string) => { if (!confirm('Delete this tile?')) return; await fetch(`/api/promo-tiles?id=${id}`, { method: 'DELETE' }); load(); };

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Promo tiles</h1>
          <p className="text-gray-500 text-sm">Small clickable boxes on the home page, like Clearance sale, New in or Bundles. Each one opens any page you choose.</p>
        </div>
        <button onClick={() => setForm({ ...EMPTY, sortOrder: tiles.length })} className="btn-primary text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Add tile</button>
      </div>

      {form && (
        <div className="card p-5 mb-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Title (English) *</label><input className="input-field" value={form.title} onChange={e => f('title', e.target.value)} placeholder="Clearance sale" /></div>
            <div><label className="label">Title (Arabic)</label><input dir="rtl" className="input-field" value={form.titleAr || ''} onChange={e => f('titleAr', e.target.value)} /></div>
            <div><label className="label">Small label (English)</label><input className="input-field" value={form.badge || ''} onChange={e => f('badge', e.target.value)} placeholder="Up to 50% off" /></div>
            <div><label className="label">Small label (Arabic)</label><input dir="rtl" className="input-field" value={form.badgeAr || ''} onChange={e => f('badgeAr', e.target.value)} /></div>
          </div>
          <TranslateButton context="a small promo tile on a hardware store home page" fields={[{ en: form.title, ar: form.titleAr, set: v => f('titleAr', v) }, { en: form.badge, ar: form.badgeAr, set: v => f('badgeAr', v) }]} />
          <div><label className="label">Opens this page</label><input className="input-field" value={form.link} onChange={e => f('link', e.target.value)} placeholder="/deals or /shop?search=cable" />
            <p className="text-xs text-gray-500 mt-1">Examples: /deals, /bundles, /shop/electrical, /shop?new=true</p></div>
          <ImageUploadField label="Picture (optional)" value={form.image || ''} onChange={v => f('image', v)} folder="banners" name={form.title} maxSide={800} />
          <div><label className="label">Colour (shown when there is no picture)</label>
            <div className="flex gap-2 items-center">{SWATCHES.map(c => <button key={c} type="button" aria-label={c} onClick={() => f('color', c)} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-gray-900 scale-110' : 'border-white shadow'}`} style={{ background: c }} />)}
              <input type="color" value={form.color} onChange={e => f('color', e.target.value)} className="w-8 h-8 rounded cursor-pointer" aria-label="Custom colour" /></div></div>
          <AiFillButton collection="promoTiles" doc={form} onPatch={p => setForm((x: any) => ({ ...x, ...p }))} label="Fill Arabic + picture text with AI" />
          <SeoFields value={form} onChange={p => setForm((x: any) => ({ ...x, ...p }))} meta={false} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setForm(null)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="btn-primary text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save tile'}</button>
          </div>
        </div>
      )}

      {!tiles.length ? <div className="card p-10 text-center text-gray-400">No tiles yet. Add one and it appears on the home page straight away.</div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tiles.map(t => (
            <div key={t.id} className={`card overflow-hidden ${t.isActive ? '' : 'opacity-50'}`}>
              <div className="aspect-[4/3] relative text-white flex items-end p-2" style={{ background: t.color }}>
                {t.image && <img src={t.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                {t.badge && <span className="absolute top-2 left-2 rounded bg-white text-gray-900 text-[10px] font-extrabold px-1.5">{t.badge}</span>}
                <span className="relative font-bold text-sm">{t.title}</span>
              </div>
              <div className="flex items-center justify-between p-2">
                <button onClick={() => patch(t.id, { isActive: !t.isActive })} className="p-1.5 text-gray-500 hover:text-gray-900" aria-label="Show or hide">{t.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                <button onClick={() => setForm(t)} className="p-1.5 text-gray-500 hover:text-brand-700" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(t.id)} className="p-1.5 text-gray-500 hover:text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
