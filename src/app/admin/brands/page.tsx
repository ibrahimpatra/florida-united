'use client';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { TranslateButton } from '@/components/admin/TranslateButton';
import { NumberInput } from '@/components/ui/NumberInput';
import { SeoFields, AiFillButton } from '@/components/admin/SeoFields';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Upload } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { generateSlug } from '@/lib/utils';
import type { Brand } from '@/types';

const EMPTY = { name: '', nameAr: '', slug: '', description: '', descriptionAr: '', image: '', imageAlt: '', imageAltAr: '', website: '', isActive: true, showOnHome: true, sortOrder: 0, metaTitle: '', metaDesc: '', metaTitleAr: '', metaDescAr: '', tags: [] as string[] };

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/brands?all=1').then(r => r.json()).then(d => { setBrands(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => { toast.error('Failed to load brands'); setLoading(false); });
  useEffect(() => { load(); }, []);

  const close = () => { setEditing(null); setCreating(false); setForm(EMPTY); };
  const startEdit = (b: Brand) => {
    setEditing(b); setCreating(false);
    setForm({ name: b.name, nameAr: b.nameAr || '', slug: b.slug, description: b.description || '', descriptionAr: b.descriptionAr || '', image: b.image || '', imageAlt: b.imageAlt || '', imageAltAr: b.imageAltAr || '',
      website: b.website || '', isActive: b.isActive !== false, showOnHome: b.showOnHome !== false, sortOrder: b.sortOrder || 0, metaTitle: b.metaTitle || '', metaDesc: b.metaDesc || '', metaTitleAr: b.metaTitleAr || '', metaDescAr: b.metaDescAr || '', tags: b.tags || [] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/brands/${editing.id}` : '/api/brands', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && (d.success || d.id)) { toast.success(editing ? 'Brand updated' : 'Brand created'); close(); load(); }
      else toast.error(d.error || 'Failed to save');
    } catch { toast.error('Network error. Please try again.'); }
    setSaving(false);
  };
  const del = async (b: Brand) => {
    if (!confirm(`Delete "${b.name}"? Products keep the brand name as text.`)) return;
    try { const r = await fetch(`/api/brands/${b.id}`, { method: 'DELETE' }); if (!r.ok) return toast.error('Could not delete this brand'); setBrands(x => x.filter(i => i.id !== b.id)); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };
  const Toggle = ({ label, field }: { label: string; field: 'isActive' | 'showOnHome' }) => (
    <label className="flex items-center gap-3 cursor-pointer">
      <div onClick={() => setForm(f => ({ ...f, [field]: !f[field] }))} className={`relative w-11 h-6 rounded-full transition-colors ${form[field] ? 'bg-brand-600' : 'bg-gray-300'}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[field] ? 'translate-x-5' : ''}`} />
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div><h1 className="text-2xl font-bold text-gray-900 font-display">Brands</h1><p className="text-gray-500 text-sm">{brands.length} brands. Brands used on products are added here automatically.</p></div>
        <div className="flex gap-2">
          <Link href="/admin/import" className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"><Upload className="w-4 h-4" />Import from Excel</Link>
          <button onClick={() => { setCreating(true); setEditing(null); setForm(EMPTY); }} className="btn-primary py-2 px-4 text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Add Brand</button>
        </div>
      </div>

      {(creating || editing) && (
        <div className="card p-6 mb-6 border-2 border-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800 text-lg">{editing ? `Edit: ${editing.name}` : 'New Brand'}</h3>
            <button onClick={close} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: editing ? f.slug : (f.slug || generateSlug(e.target.value)) }))} className="input-field" placeholder="e.g. Siemens" /></div>
            <div className="flex"><TranslateButton context="a brand sold in a hardware store (keep the brand name recognisable)" fields={[
              { en: form.name, ar: form.nameAr, set: v => setForm(f => ({ ...f, nameAr: v })) },
              { en: form.description, ar: form.descriptionAr, set: v => setForm(f => ({ ...f, descriptionAr: v })) }]} /></div>
            <div><label className="label">Arabic Name <span dir="rtl" className="text-gray-400 font-normal">(الاسم بالعربية)</span></label>
              <input value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} dir="rtl" lang="ar" className="input-field" /></div>
            <div><label className="label">Slug {editing && <span className="text-gray-400 font-normal text-xs">(fixed after creation so links keep working)</span>}</label>
              <input value={form.slug} disabled={!!editing} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="input-field font-mono text-sm disabled:bg-gray-50" placeholder="siemens" /></div>
            <div className="sm:col-span-2"><ImageUploadField label="Brand logo (shows on the homepage and the brand page)" value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} folder="brands" name={form.name} maxSide={600} /></div>
            <div className="sm:col-span-2"><label className="label">Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field resize-none" placeholder="A few factual lines about the brand" /></div>
            <div className="sm:col-span-2"><label className="label">Arabic Description <span dir="rtl" className="text-gray-400 font-normal">(الوصف بالعربية)</span></label>
              <textarea rows={3} dir="rtl" lang="ar" value={form.descriptionAr} onChange={e => setForm(f => ({ ...f, descriptionAr: e.target.value }))} className="input-field resize-none" /></div>
            <div><label className="label">Website <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="input-field" placeholder="https://" dir="ltr" /></div>
            <div><label className="label">Sort Order <span className="text-gray-400 font-normal text-xs">(lower = first)</span></label>
              <NumberInput type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} className="input-field" /></div>
            <div className="sm:col-span-2 space-y-3">
              <AiFillButton collection="brands" doc={form} onPatch={p => setForm(f => ({ ...f, ...p }))} label="Fill Arabic + SEO with AI" />
              <SeoFields value={form} onChange={p => setForm(f => ({ ...f, ...p }))} />
              <p className="text-xs text-gray-500">Leave Arabic or SEO empty and the background job fills them after you save (see Admin &gt; Jobs).</p>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2 border-t border-gray-100"><Toggle label="Active" field="isActive" /><Toggle label="Show on homepage" field="showOnHome" /></div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={close} className="btn-secondary py-2.5 px-5 text-sm">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary py-2.5 px-6 text-sm disabled:opacity-50 flex items-center gap-2">
              {saving ? 'Saving...' : <><Save className="w-4 h-4" />{editing ? 'Save Changes' : 'Create Brand'}</>}</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden"><div className="overflow-x-auto">
        <table className="table min-w-full">
          <thead><tr><th>Brand</th><th className="hidden md:table-cell">Slug</th><th className="hidden sm:table-cell">Arabic</th><th className="hidden md:table-cell">Home</th><th>Status</th><th className="hidden sm:table-cell">Order</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="skeleton h-4 w-full rounded" /></td>)}</tr>)
              : brands.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">No brands yet. Click "Add Brand", or import a spreadsheet.</td></tr>
              : brands.map(b => (
                <tr key={b.id}>
                  <td className="font-bold text-gray-800"><span className="flex items-center gap-2">{b.image ? <img src={b.image} alt={b.imageAlt || b.name} className="w-8 h-8 rounded object-contain bg-white border" /> : <span className="w-8 h-8 rounded bg-gray-100" />}{b.name}</span></td>
                  <td className="font-mono text-xs text-gray-500 hidden md:table-cell">{b.slug}</td>
                  <td className="hidden sm:table-cell text-gray-600" dir="rtl">{b.nameAr || <span className="text-gray-300">-</span>}</td>
                  <td className="hidden md:table-cell"><span className={`badge text-xs font-bold ${b.showOnHome !== false ? 'badge-green' : 'badge-gray'}`}>{b.showOnHome !== false ? 'Yes' : 'No'}</span></td>
                  <td><span className={`badge text-xs font-bold ${b.isActive !== false ? 'badge-green' : 'badge-gray'}`}>{b.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="hidden sm:table-cell text-gray-600 text-sm">{b.sortOrder}</td>
                  <td><div className="flex gap-2">
                    <button onClick={() => startEdit(b)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(b)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                </tr>))}
          </tbody>
        </table></div></div>
    </div>
  );
}
