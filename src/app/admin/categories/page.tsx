'use client';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { TranslateButton } from '@/components/admin/TranslateButton';
import { NumberInput } from '@/components/ui/NumberInput';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Home, Navigation, RefreshCw, CornerDownRight } from 'lucide-react';
import { cachedJson, dropCached } from '@/lib/client-cache';
import { toast } from 'react-hot-toast';
import { generateSlug } from '@/lib/utils';
import type { Category } from '@/types';
import { Collapsible } from '@/components/admin/Collapsible';
import { PillSelect } from '@/components/admin/PillSelect';
import { SeoFields, AiFillButton } from '@/components/admin/SeoFields';

const EMPTY_FORM = {
  name: '', nameAr: '', slug: '', description: '', descriptionAr: '', parentId: '',
  isActive: true, showOnHome: true, showOnNav: true,
  sortOrder: 0, metaTitle: '', metaDesc: '', metaTitleAr: '', metaDescAr: '', tags: [] as string[],
  image: '', icon: '', productCount: 0,
};

export default function AdminCategoriesPage() {
  const [cats, setCats]       = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);

  const [lastMain, setLastMain] = useState<string>('');    // the main category just created or edited: a sub-category added next is linked to it automatically
  const [kind, setKind] = useState<'main' | 'sub'>('main');
  const [needParent, setNeedParent] = useState(false);

  // `force` = ask the server again (Refresh button, and right after every save). Otherwise the saved copy in this browser is used.
  const load = (force = false, fresh = false) =>
    cachedJson<Category[]>(`/api/categories?admin=1${fresh ? '&fresh=1' : ''}`, { force })
      .then(d => { setCats(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { toast.error('Failed to load categories'); setLoading(false); });

  useEffect(() => { load(); }, []);

  const pickKind = (k: 'main' | 'sub') => {
    setKind(k); setNeedParent(false);
    if (k === 'main') setForm(f => ({ ...f, parentId: '' }));
    else setForm(f => ({ ...f, parentId: f.parentId || (cats.some(c => c.id === lastMain && !c.parentId) ? lastMain : '') }));
  };
  const startNew = (parentId = '') => { setCreating(true); setEditing(null); setForm({ ...EMPTY_FORM, parentId }); setKind(parentId ? 'sub' : 'main'); setNeedParent(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const resetForm = () => setForm(EMPTY_FORM);

  const startEdit = (c: Category) => {
    setEditing(c);
    setCreating(false);
    setKind(c.parentId ? 'sub' : 'main'); setNeedParent(false);
    setForm({
      name: c.name, nameAr: c.nameAr || '', slug: c.slug, description: c.description || '', descriptionAr: c.descriptionAr || '',
      parentId: c.parentId || '', isActive: c.isActive,
      showOnHome: c.showOnHome ?? true, showOnNav: c.showOnNav ?? true,
      sortOrder: c.sortOrder, metaTitle: c.metaTitle || '', metaDesc: c.metaDesc || '', metaTitleAr: (c as any).metaTitleAr || '', metaDescAr: (c as any).metaDescAr || '', tags: (c as any).tags || [],
      image: c.image || '', icon: c.icon || '', productCount: c.productCount || 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (kind === 'sub' && !form.parentId) { setNeedParent(true); toast.error('Choose the main category first.'); return; }
    setSaving(true);
    try {
      const url    = editing ? `/api/categories/${editing.id}` : '/api/categories';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, parentId: kind === 'main' ? '' : form.parentId, sortOrder: Number(form.sortOrder), productCount: Number(form.productCount) }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.id)) {
        toast.success(editing ? 'Category updated!' : 'Category created!');
        if (kind === 'main') setLastMain(editing ? editing.id : data.id);
        else if (form.parentId) setLastMain(form.parentId);
        setEditing(null); setCreating(false); resetForm();
        dropCached('/api/categories');                 // every list in this browser forgets its old copy
        load(true);
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch (e) {
      toast.error('Network error — please try again');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => null); toast.error(d?.error || 'Could not delete this category'); return; }
      setCats(cs => cs.filter(c => c.id !== id)); dropCached('/api/categories');
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const roots    = cats.filter(c => !c.parentId);
  const children = (pid: string) => cats.filter(c => c.parentId === pid);

  const Toggle = ({ label, icon: Icon, field }: { label: string; icon: any; field: 'showOnHome' | 'showOnNav' | 'isActive' }) => (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => setForm(f => ({ ...f, [field]: !f[field] }))}
        className={`relative w-11 h-6 rounded-full transition-colors ${form[field] ? 'bg-brand-600' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[field] ? 'translate-x-5' : ''}`}/>
      </div>
      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <Icon className="w-4 h-4 text-gray-400"/>{label}
      </span>
    </label>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Categories</h1>
          <p className="text-gray-500 text-sm">{cats.length} categories total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { dropCached('/api/categories'); load(true, true); toast.success('Reloaded'); }} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2" title="Reload from the server"><RefreshCw className="w-4 h-4"/><span className="hidden sm:inline">Refresh</span></button>
          <button onClick={() => startNew()} className="btn-primary py-2 px-4 text-sm flex items-center gap-2"><Plus className="w-4 h-4"/>Add Category</button>
        </div>
      </div>

      {/* ── Form Panel ─────────────────────────────────────── */}
      {(creating || editing) && (
        <div className="card p-6 mb-6 border-2 border-brand-200">
          {/* Save and Cancel stay on top while you scroll the form */}
          <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-5 px-6 py-3 bg-white/95 backdrop-blur border-b border-gray-100 rounded-t-2xl flex items-center gap-2">
            <h3 className="flex-1 min-w-0 font-bold text-gray-800 truncate">{editing ? `Edit: ${editing.name}` : 'New category'}</h3>
            <button type="button" onClick={() => { setEditing(null); setCreating(false); resetForm(); }} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary py-2 px-5 text-sm disabled:opacity-50 flex items-center gap-2">
              {saving ? 'Saving…' : <><Save className="w-4 h-4"/>{editing ? 'Save' : 'Create'}</>}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* What is being added: decided first, so a sub-category is never created without its main category */}
            <div className="sm:col-span-2">
              <label className="label">What are you adding?</label>
              <div className="inline-flex p-1 bg-gray-100 rounded-full">
                {([['main', 'Main category'], ['sub', 'Sub-category']] as const).map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => pickKind(k)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${kind === k ? 'bg-white shadow-soft text-brand-800' : 'text-gray-500'}`}>{lbl}</button>
                ))}
              </div>
              {kind === 'sub' && (
                <div className="mt-3 max-w-md">
                  <label className="label">Main category *</label>
                  <PillSelect value={form.parentId || null} onChange={id => { setNeedParent(false); setForm(f => ({ ...f, parentId: id || '' })); }} placeholder="Choose the main category first"
                    options={roots.filter(r => r.id !== editing?.id).map(c => ({ id: c.id, label: c.name, sub: c.nameAr }))} />
                  {needParent && <p className="text-xs text-red-600 mt-1">A sub-category must belong to a main category.</p>}
                  {!needParent && form.parentId && !editing && form.parentId === lastMain && <p className="text-xs text-gray-500 mt-1">Linked to the category you just worked on. Change it if needed.</p>}
                </div>
              )}
            </div>
            {/* Name + Slug */}
            <div>
              <label className="label">Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || generateSlug(e.target.value) }))}
                className="input-field"
                placeholder="e.g. Electrical Supplies"
              />
            </div>
            <div className="flex">
              <TranslateButton context="a product category of a hardware store" fields={[
                { en: form.name, ar: form.nameAr, set: v => setForm(f => ({ ...f, nameAr: v })) },
                { en: form.description, ar: form.descriptionAr, set: v => setForm(f => ({ ...f, descriptionAr: v })) },
              ]} />
            </div>
            <div>
              <label className="label">Arabic Name <span dir="rtl" className="text-gray-400 font-normal">(الاسم بالعربية)</span></label>
              <input value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                dir="rtl" lang="ar" className="input-field" placeholder="مثال: المستلزمات الكهربائية" />
            </div>
            <div>
              <label className="label">Slug <span className="text-gray-400 font-normal text-xs">(auto-generated)</span></label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="input-field font-mono text-sm"
                placeholder="electrical-supplies"
              />
            </div>

            {/* Sort */}
            <div>
              <label className="label">Sort Order <span className="text-gray-400 font-normal text-xs">(lower = first)</span></label>
              <NumberInput type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} className="input-field"/>
            </div>

            <div className="sm:col-span-2"><Collapsible title="Description, picture and search engines" hint="Optional" defaultOpen={!!editing}>
              <div className="grid sm:grid-cols-2 gap-4">
            {/* Description */}
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" placeholder="Brief description shown in SEO"/>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Arabic Description <span dir="rtl" className="text-gray-400 font-normal">(الوصف بالعربية)</span></label>
              <input value={form.descriptionAr} onChange={e => setForm(f => ({ ...f, descriptionAr: e.target.value }))} dir="rtl" lang="ar" className="input-field" />
            </div>

            {/* Image URL */}
            <div className="sm:col-span-2"><ImageUploadField label="Category picture (shows on the homepage grid; blank = use the icon)" value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} folder="categories" name={form.name} maxSide={800} /></div>

            {/* Icon + Count */}
            <div>
              <label className="label">Icon / Emoji <span className="text-gray-400 font-normal text-xs">(used if no image)</span></label>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="input-field text-xl" placeholder="e.g. wrench (optional)"/>
              {form.icon && <span className="text-2xl mt-1 block">{form.icon}</span>}
            </div>
            <div>
              <label className="label">
                Product Count
                <span className="text-gray-400 font-normal text-xs ml-1">(displayed on homepage, e.g. 8500 → "8,500+ items")</span>
              </label>
              <NumberInput type="number" value={form.productCount} onChange={e => setForm(f => ({ ...f, productCount: Number(e.target.value) }))} className="input-field" placeholder="0"/>
            </div>

            {/* SEO + Arabic */}
            <div className="sm:col-span-2 space-y-3">
              <AiFillButton collection="categories" doc={form} onPatch={p => setForm(f => ({ ...f, ...p }))} label="Fill Arabic + SEO with AI" />
              <SeoFields value={form} onChange={p => setForm(f => ({ ...f, ...p }))} alt={false} />
              <p className="text-xs text-gray-500">Leave Arabic or SEO empty and the background job fills them after you save (see Admin &gt; Jobs).</p>
            </div>

              </div>
            </Collapsible></div>

            {/* Visibility toggles */}
            <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2 border-t border-gray-100">
              <Toggle label="Active" icon={X} field="isActive"/>
              <Toggle label="Show on Homepage Grid" icon={Home} field="showOnHome"/>
              <Toggle label="Show in Nav Bar" icon={Navigation} field="showOnNav"/>
            </div>
          </div>

        </div>
      )}

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table min-w-full">
          <thead>
            <tr>
              <th>Name</th><th className="hidden md:table-cell">Slug</th>
              <th className="hidden sm:table-cell">Parent</th>
              <th className="hidden md:table-cell">Home</th>
              <th className="hidden md:table-cell">Nav</th>
              <th>Status</th><th className="hidden sm:table-cell">Order</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton h-4 w-full rounded"/></td>
                  ))}</tr>
                ))
              : roots.length === 0
              ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">No categories yet — click "Add Category" to create one</td></tr>
              : roots.map(c => (
                <>
                  <tr key={c.id} className="bg-gray-50/50">
                    <td className="font-bold text-gray-800 flex items-center gap-2">
                      {c.icon && <span className="text-lg">{c.icon}</span>}
                      {c.image && <img src={c.image} alt="" className="w-6 h-6 rounded object-cover"/>}
                      {c.name}
                    </td>
                    <td className="font-mono text-xs text-gray-500 hidden md:table-cell">{c.slug}</td>
                    <td className="text-gray-400 text-xs hidden sm:table-cell">Root</td>
                    <td className="hidden md:table-cell"><span className={`badge text-xs font-bold ${(c.showOnHome ?? true) ? 'badge-green' : 'badge-gray'}`}>{(c.showOnHome ?? true) ? 'Yes' : 'No'}</span></td>
                    <td className="hidden md:table-cell"><span className={`badge text-xs font-bold ${(c.showOnNav  ?? true) ? 'badge-green' : 'badge-gray'}`}>{(c.showOnNav  ?? true) ? 'Yes' : 'No'}</span></td>
                    <td><span className={`badge text-xs font-bold ${c.isActive ? 'badge-green' : 'badge-gray'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td className="text-gray-600 text-sm hidden sm:table-cell">{c.sortOrder}</td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => startNew(c.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Add a sub-category here"><CornerDownRight className="w-3.5 h-3.5"/></button>
                        <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={() => handleDelete(c.id, c.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </td>
                  </tr>
                  {children(c.id).map(sub => (
                    <tr key={sub.id}>
                      <td className="pl-8 text-gray-700">- {sub.name}{sub.nameAr ? <span className="text-gray-400" dir="rtl"> / {sub.nameAr}</span> : null}</td>
                      <td className="font-mono text-xs text-gray-500 hidden md:table-cell">{sub.slug}</td>
                      <td className="text-gray-500 text-xs hidden sm:table-cell">{c.name}</td>
                      <td className="hidden md:table-cell"><span className={`badge text-xs font-bold ${(sub.showOnHome ?? true) ? 'badge-green' : 'badge-gray'}`}>{(sub.showOnHome ?? true) ? 'Yes' : 'No'}</span></td>
                      <td className="hidden md:table-cell"><span className={`badge text-xs font-bold ${(sub.showOnNav  ?? true) ? 'badge-green' : 'badge-gray'}`}>{(sub.showOnNav  ?? true) ? 'Yes' : 'No'}</span></td>
                      <td><span className={`badge text-xs font-bold ${sub.isActive ? 'badge-green' : 'badge-gray'}`}>{sub.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td className="text-gray-600 text-sm hidden sm:table-cell">{sub.sortOrder}</td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(sub)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={() => handleDelete(sub.id, sub.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ))
            }
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
