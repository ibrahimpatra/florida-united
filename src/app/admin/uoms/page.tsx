'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Package, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { UOM, UOMCategory } from '@/lib/shipping';
import { DEFAULT_UOMS } from '@/lib/shippingService';

const CATEGORY_ICONS: Record<UOMCategory, string> = {
  count: '🔢', pack: '📦', length: '📏', weight: '⚖️',
  volume: '🧪', area: '⬛', electrical: '⚡',
};
const CATEGORY_LABELS: Record<UOMCategory, string> = {
  count: 'Count', pack: 'Pack / Bundle', length: 'Length',
  weight: 'Weight', volume: 'Volume', area: 'Area', electrical: 'Electrical',
};
const CATEGORIES: UOMCategory[] = ['count', 'pack', 'length', 'weight', 'volume', 'area', 'electrical'];

const emptyUOM = (): Partial<UOM> => ({
  name: '', abbreviation: '', category: 'count', isBase: false, conversionFactor: 1, isActive: true,
});

export default function AdminUOMPage() {
  const [uoms, setUOMs] = useState<UOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUOM, setEditingUOM] = useState<Partial<UOM> | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [filterCat, setFilterCat] = useState<UOMCategory | 'all'>('all');

  const fetchUOMs = async () => {
    setLoading(true);
    const data = await fetch('/api/uoms').then(r => r.json());
    setUOMs(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchUOMs(); }, []);

  const saveUOM = async () => {
    if (!editingUOM?.name || !editingUOM?.abbreviation) { toast.error('Name and abbreviation required'); return; }
    setSaving(true);
    try {
      const isNew = !editingUOM.id;
      const url = isNew ? '/api/uoms' : `/api/uoms/${editingUOM.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingUOM) });
      const data = await res.json();
      if (data.success || data.id) { toast.success(isNew ? 'UOM created!' : 'UOM updated!'); setEditingUOM(null); fetchUOMs(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  const deleteUOM = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/uoms/${id}`, { method: 'DELETE' });
    setUOMs(us => us.filter(u => u.id !== id));
    toast.success('Deleted');
  };

  const seedDefaults = async () => {
    if (!confirm(`This will add ${DEFAULT_UOMS.length} standard UOMs. Continue?`)) return;
    setSeeding(true);
    let added = 0;
    for (const uom of DEFAULT_UOMS) {
      try {
        const res = await fetch('/api/uoms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uom) });
        if ((await res.json()).id) added++;
      } catch {}
    }
    toast.success(`Added ${added} UOMs!`);
    fetchUOMs();
    setSeeding(false);
  };

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = uoms.filter(u => u.category === cat);
    return acc;
  }, {} as Record<UOMCategory, UOM[]>);

  const filtered = filterCat === 'all' ? uoms : uoms.filter(u => u.category === filterCat);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-3"><Package className="w-7 h-7 text-brand-600"/>Units of Measure (UOM)</h1>
          <p className="text-gray-500 text-sm mt-0.5">{uoms.length} UOMs · Used for product quantity, pricing, and ordering</p>
        </div>
        <div className="flex gap-2">
          {uoms.length === 0 && (
            <button onClick={seedDefaults} disabled={seeding} className="btn-secondary py-2 px-4 text-sm">
              {seeding ? <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"/> : <><RefreshCw className="w-4 h-4"/>Seed Defaults ({DEFAULT_UOMS.length})</>}
            </button>
          )}
          <button onClick={() => setEditingUOM(emptyUOM())} className="btn-primary py-2 px-4 text-sm"><Plus className="w-4 h-4"/>Add UOM</button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button onClick={() => setFilterCat('all')} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterCat === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All ({uoms.length})</button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${filterCat === cat ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]} ({grouped[cat]?.length || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-64 w-full rounded-2xl"/>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
          <p className="text-gray-500 font-semibold mb-1">No UOMs configured</p>
          <p className="text-gray-400 text-sm mb-6">Click "Seed Defaults" to add 35+ standard units</p>
          <button onClick={seedDefaults} disabled={seeding} className="btn-primary py-2 px-6 text-sm"><RefreshCw className="w-4 h-4"/>Seed Defaults</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Abbr.</th><th>Category</th><th>Base?</th><th>Conversion</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(uom => (
                <tr key={uom.id}>
                  <td className="font-semibold text-gray-800">{uom.name}</td>
                  <td><code className="bg-gray-100 text-brand-700 font-bold px-2 py-0.5 rounded text-sm">{uom.abbreviation}</code></td>
                  <td><span className="flex items-center gap-1.5 text-sm text-gray-700">{CATEGORY_ICONS[uom.category]}{CATEGORY_LABELS[uom.category]}</span></td>
                  <td>{uom.isBase ? <span className="badge badge-green text-xs font-bold">Base Unit</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="text-sm text-gray-600">{uom.isBase ? '1 (base)' : `× ${uom.conversionFactor}`}</td>
                  <td><span className={`badge text-xs font-bold ${uom.isActive ? 'badge-green' : 'badge-gray'}`}>{uom.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditingUOM({ ...uom })} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={() => deleteUOM(uom.id, uom.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {editingUOM && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg">{editingUOM.id ? 'Edit' : 'New'} Unit of Measure</h3>
              <button onClick={() => setEditingUOM(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input value={editingUOM.name || ''} onChange={e => setEditingUOM(u => ({ ...u!, name: e.target.value }))} className="input-field" placeholder="Meter"/></div>
                <div><label className="label">Abbreviation *</label><input value={editingUOM.abbreviation || ''} onChange={e => setEditingUOM(u => ({ ...u!, abbreviation: e.target.value }))} className="input-field" placeholder="m"/></div>
              </div>
              <div>
                <label className="label">Category</label>
                <select value={editingUOM.category} onChange={e => setEditingUOM(u => ({ ...u!, category: e.target.value as UOMCategory }))} className="input-field">
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isBase" checked={editingUOM.isBase || false} onChange={e => setEditingUOM(u => ({ ...u!, isBase: e.target.checked }))} className="w-4 h-4 accent-brand-600"/>
                <label htmlFor="isBase" className="text-sm font-semibold text-gray-700">Is Base Unit (for conversions)</label>
              </div>
              {!editingUOM.isBase && (
                <div>
                  <label className="label">Conversion Factor (× to get to base)</label>
                  <input type="number" step="0.000001" value={editingUOM.conversionFactor || ''} onChange={e => setEditingUOM(u => ({ ...u!, conversionFactor: Number(e.target.value) }))} className="input-field" placeholder="e.g. 3.28084 for meter→feet"/>
                  <p className="text-xs text-gray-400 mt-1">e.g. 1 meter = 3.28084 feet → enter 3.28084</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="uomActive" checked={editingUOM.isActive !== false} onChange={e => setEditingUOM(u => ({ ...u!, isActive: e.target.checked }))} className="w-4 h-4 accent-brand-600"/>
                <label htmlFor="uomActive" className="text-sm font-semibold text-gray-700">Active</label>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditingUOM(null)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
              <button onClick={saveUOM} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><Save className="w-4 h-4"/>Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
