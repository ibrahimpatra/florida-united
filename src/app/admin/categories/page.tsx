'use client';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Home, Navigation } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateSlug } from '@/lib/utils';
import type { Category } from '@/types';

const EMPTY_FORM = {
  name: '', slug: '', description: '', parentId: '',
  isActive: true, showOnHome: true, showOnNav: true,
  sortOrder: 0, metaTitle: '', metaDesc: '',
  image: '', icon: '', productCount: 0,
};

export default function AdminCategoriesPage() {
  const [cats, setCats]       = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);

  const load = () =>
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => { setCats(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { toast.error('Failed to load categories'); setLoading(false); });

  useEffect(() => { load(); }, []);

  const resetForm = () => setForm(EMPTY_FORM);

  const startEdit = (c: Category) => {
    setEditing(c);
    setCreating(false);
    setForm({
      name: c.name, slug: c.slug, description: c.description || '',
      parentId: c.parentId || '', isActive: c.isActive,
      showOnHome: c.showOnHome ?? true, showOnNav: c.showOnNav ?? true,
      sortOrder: c.sortOrder, metaTitle: c.metaTitle || '', metaDesc: c.metaDesc || '',
      image: c.image || '', icon: c.icon || '', productCount: c.productCount || 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const url    = editing ? `/api/categories/${editing.id}` : '/api/categories';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder), productCount: Number(form.productCount) }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.id)) {
        toast.success(editing ? 'Category updated!' : 'Category created!');
        setEditing(null); setCreating(false); resetForm();
        load();
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
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      setCats(cs => cs.filter(c => c.id !== id));
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
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Categories</h1>
          <p className="text-gray-500 text-sm">{cats.length} categories total</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); resetForm(); }}
          className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4"/>Add Category
        </button>
      </div>

      {/* ── Form Panel ─────────────────────────────────────── */}
      {(creating || editing) && (
        <div className="card p-6 mb-6 border-2 border-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800 text-lg">{editing ? `Edit: ${editing.name}` : 'New Category'}</h3>
            <button onClick={() => { setEditing(null); setCreating(false); resetForm(); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
            <div>
              <label className="label">Slug <span className="text-gray-400 font-normal text-xs">(auto-generated)</span></label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="input-field font-mono text-sm"
                placeholder="electrical-supplies"
              />
            </div>

            {/* Parent + Sort */}
            <div>
              <label className="label">Parent Category</label>
              <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} className="input-field">
                <option value="">None (Root Category)</option>
                {roots.filter(r => r.id !== editing?.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sort Order <span className="text-gray-400 font-normal text-xs">(lower = first)</span></label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} className="input-field"/>
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" placeholder="Brief description shown in SEO"/>
            </div>

            {/* Image URL */}
            <div className="sm:col-span-2">
              <label className="label">
                Image URL
                <span className="text-gray-400 font-normal text-xs ml-1">(shows on homepage grid — leave blank to use emoji icon)</span>
              </label>
              <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} className="input-field" placeholder="https://..."/>
              {form.image && (
                <img src={form.image} alt="preview" className="mt-2 h-16 w-16 object-cover rounded-xl border border-gray-200 shadow-sm"/>
              )}
            </div>

            {/* Icon + Count */}
            <div>
              <label className="label">Icon / Emoji <span className="text-gray-400 font-normal text-xs">(used if no image)</span></label>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="input-field text-xl" placeholder="⚡"/>
              {form.icon && <span className="text-2xl mt-1 block">{form.icon}</span>}
            </div>
            <div>
              <label className="label">
                Product Count
                <span className="text-gray-400 font-normal text-xs ml-1">(displayed on homepage, e.g. 8500 → "8,500+ items")</span>
              </label>
              <input type="number" value={form.productCount} onChange={e => setForm(f => ({ ...f, productCount: Number(e.target.value) }))} className="input-field" placeholder="0"/>
            </div>

            {/* Meta */}
            <div>
              <label className="label">Meta Title <span className="text-gray-400 font-normal text-xs">(SEO)</span></label>
              <input value={form.metaTitle} onChange={e => setForm(f => ({ ...f, metaTitle: e.target.value }))} className="input-field"/>
            </div>
            <div>
              <label className="label">Meta Description <span className="text-gray-400 font-normal text-xs">(SEO)</span></label>
              <input value={form.metaDesc} onChange={e => setForm(f => ({ ...f, metaDesc: e.target.value }))} className="input-field"/>
            </div>

            {/* Visibility toggles */}
            <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2 border-t border-gray-100">
              <Toggle label="Active" icon={X} field="isActive"/>
              <Toggle label="Show on Homepage Grid" icon={Home} field="showOnHome"/>
              <Toggle label="Show in Nav Bar" icon={Navigation} field="showOnNav"/>
            </div>
          </div>

          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => { setEditing(null); setCreating(false); resetForm(); }} className="btn-secondary py-2.5 px-5 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="btn-primary py-2.5 px-6 text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Saving...</>
                : <><Save className="w-4 h-4"/>{editing ? 'Save Changes' : 'Create Category'}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Slug</th><th>Parent</th>
              <th>Homepage</th><th>Nav</th><th>Status</th><th>Order</th><th>Actions</th>
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
                    <td className="font-mono text-xs text-gray-500">{c.slug}</td>
                    <td className="text-gray-400 text-xs">Root</td>
                    <td><span className={`badge text-xs font-bold ${(c.showOnHome ?? true) ? 'badge-green' : 'badge-gray'}`}>{(c.showOnHome ?? true) ? 'Yes' : 'No'}</span></td>
                    <td><span className={`badge text-xs font-bold ${(c.showOnNav  ?? true) ? 'badge-green' : 'badge-gray'}`}>{(c.showOnNav  ?? true) ? 'Yes' : 'No'}</span></td>
                    <td><span className={`badge text-xs font-bold ${c.isActive ? 'badge-green' : 'badge-gray'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td className="text-gray-600 text-sm">{c.sortOrder}</td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={() => handleDelete(c.id, c.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </td>
                  </tr>
                  {children(c.id).map(sub => (
                    <tr key={sub.id}>
                      <td className="pl-8 text-gray-700">↳ {sub.name}</td>
                      <td className="font-mono text-xs text-gray-500">{sub.slug}</td>
                      <td className="text-gray-500 text-xs">{c.name}</td>
                      <td><span className={`badge text-xs font-bold ${(sub.showOnHome ?? true) ? 'badge-green' : 'badge-gray'}`}>{(sub.showOnHome ?? true) ? 'Yes' : 'No'}</span></td>
                      <td><span className={`badge text-xs font-bold ${(sub.showOnNav  ?? true) ? 'badge-green' : 'badge-gray'}`}>{(sub.showOnNav  ?? true) ? 'Yes' : 'No'}</span></td>
                      <td><span className={`badge text-xs font-bold ${sub.isActive ? 'badge-green' : 'badge-gray'}`}>{sub.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td className="text-gray-600 text-sm">{sub.sortOrder}</td>
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
  );
}
