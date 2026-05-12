'use client';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateSlug } from '@/lib/utils';
import type { Category } from '@/types';

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name:'', slug:'', description:'', parentId:'', isActive:true, sortOrder:0, metaTitle:'', metaDesc:'' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch('/api/categories').then(r=>r.json()).then(d=>{ setCats(d); setLoading(false); }); }, []);

  const resetForm = () => setForm({ name:'', slug:'', description:'', parentId:'', isActive:true, sortOrder:0, metaTitle:'', metaDesc:'' });

  const startEdit = (c: Category) => { setEditing(c); setCreating(false); setForm({ name:c.name, slug:c.slug, description:c.description||'', parentId:c.parentId||'', isActive:c.isActive, sortOrder:c.sortOrder, metaTitle:c.metaTitle||'', metaDesc:c.metaDesc||'' }); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/categories/${editing.id}` : '/api/categories';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success || data.id) {
        toast.success(editing ? 'Category updated' : 'Category created');
        const res2 = await fetch('/api/categories');
        setCats(await res2.json());
        setEditing(null); setCreating(false); resetForm();
      } else toast.error(data.error || 'Failed');
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/categories/${id}`, { method:'DELETE' });
    setCats(cs => cs.filter(c=>c.id!==id));
    toast.success('Deleted');
  };

  const roots = cats.filter(c=>!c.parentId);
  const children = (parentId: string) => cats.filter(c=>c.parentId===parentId);

  const FormPanel = () => (
    <div className="card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">{editing?'Edit Category':'New Category'}</h3>
        <button onClick={()=>{ setEditing(null); setCreating(false); resetForm(); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Name *</label>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value,slug:generateSlug(e.target.value)}))} className="input-field" placeholder="Category Name"/>
        </div>
        <div>
          <label className="label">Slug</label>
          <input value={form.slug} onChange={e=>setForm(f=>({...f,slug:e.target.value}))} className="input-field font-mono text-sm"/>
        </div>
        <div>
          <label className="label">Parent Category</label>
          <select value={form.parentId} onChange={e=>setForm(f=>({...f,parentId:e.target.value}))} className="input-field">
            <option value="">None (Root)</option>
            {roots.filter(r=>r.id!==editing?.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Sort Order</label>
          <input type="number" value={form.sortOrder} onChange={e=>setForm(f=>({...f,sortOrder:Number(e.target.value)}))} className="input-field"/>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="input-field" placeholder="Brief description"/>
        </div>
        <div>
          <label className="label">Meta Title</label>
          <input value={form.metaTitle} onChange={e=>setForm(f=>({...f,metaTitle:e.target.value}))} className="input-field"/>
        </div>
        <div>
          <label className="label">Meta Description</label>
          <input value={form.metaDesc} onChange={e=>setForm(f=>({...f,metaDesc:e.target.value}))} className="input-field"/>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="catActive" checked={form.isActive} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))} className="w-4 h-4 accent-brand-600"/>
          <label htmlFor="catActive" className="text-sm font-medium text-gray-700">Active</label>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={()=>{ setEditing(null); setCreating(false); resetForm(); }} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
        <button onClick={handleSave} disabled={saving||!form.name} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
          {saving?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>{editing?'Save Changes':'Create'}</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-gray-900 font-display">Categories</h1><p className="text-gray-500 text-sm">{cats.length} categories</p></div>
        <button onClick={()=>{ setCreating(true); setEditing(null); resetForm(); }} className="btn-primary py-2 px-4 text-sm"><Plus className="w-4 h-4"/>Add Category</button>
      </div>

      {(creating || editing) && <FormPanel/>}

      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Name</th><th>Slug</th><th>Parent</th><th>Status</th><th>Order</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? Array.from({length:5}).map((_,i)=><tr key={i}>{Array.from({length:6}).map((_,j)=><td key={j}><div className="skeleton h-4 w-full rounded"/></td>)}</tr>)
            : roots.length===0 ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">No categories yet</td></tr>
            : roots.map(c => (
              <>
                <tr key={c.id} className="bg-gray-50/50">
                  <td className="font-bold text-gray-800">{c.name}</td>
                  <td className="font-mono text-xs text-gray-500">{c.slug}</td>
                  <td className="text-gray-500 text-xs">Root</td>
                  <td><span className={`badge text-xs font-bold ${c.isActive?'badge-green':'badge-gray'}`}>{c.isActive?'Active':'Inactive'}</span></td>
                  <td className="text-gray-600 text-sm">{c.sortOrder}</td>
                  <td><div className="flex gap-2"><button onClick={()=>startEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={()=>handleDelete(c.id,c.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div></td>
                </tr>
                {children(c.id).map(sub => (
                  <tr key={sub.id}>
                    <td className="pl-8 text-gray-700">↳ {sub.name}</td>
                    <td className="font-mono text-xs text-gray-500">{sub.slug}</td>
                    <td className="text-gray-500 text-xs">{c.name}</td>
                    <td><span className={`badge text-xs font-bold ${sub.isActive?'badge-green':'badge-gray'}`}>{sub.isActive?'Active':'Inactive'}</span></td>
                    <td className="text-gray-600 text-sm">{sub.sortOrder}</td>
                    <td><div className="flex gap-2"><button onClick={()=>startEdit(sub)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={()=>handleDelete(sub.id,sub.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div></td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
