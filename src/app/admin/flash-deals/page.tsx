'use client';
import { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Edit2, Trash2, Save, X, Clock, Tag, ToggleRight, ToggleLeft, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDateTime, formatPrice } from '@/lib/utils';
import type { FlashDeal } from '@/lib/shipping';

const COLORS = [
  { label: 'Red-Orange', value: '#ef4444', bg: 'bg-red-500' },
  { label: 'Blue', value: '#1a56db', bg: 'bg-blue-600' },
  { label: 'Green', value: '#16a34a', bg: 'bg-green-600' },
  { label: 'Purple', value: '#7c3aed', bg: 'bg-purple-600' },
  { label: 'Orange', value: '#f97316', bg: 'bg-orange-500' },
  { label: 'Dark', value: '#1f2937', bg: 'bg-gray-900' },
  { label: 'Teal', value: '#0d9488', bg: 'bg-teal-600' },
  { label: 'Pink', value: '#db2777', bg: 'bg-pink-600' },
];

const toLocalDatetime = (iso: string) => iso ? iso.slice(0, 16) : '';
const fromLocalDatetime = (local: string) => local ? new Date(local).toISOString() : '';

const emptyDeal = (): Partial<FlashDeal> => ({
  title: '',
  subtitle: '',
  badgeText: 'FLASH DEAL',
  type: 'percentage',
  discountValue: 10,
  scope: 'all',
  categoryIds: [],
  productIds: [],
  startAt: new Date().toISOString(),
  endAt: new Date(Date.now() + 86400000).toISOString(),
  bannerColor: '#ef4444',
  showCountdown: true,
  showOnHomepage: true,
  showOnProductPage: true,
  minCartAmount: undefined,
  maxUsesTotal: undefined,
  isActive: true,
  isPinned: false,
  usedCount: 0,
});

function CountdownTimer({ endAt }: { endAt: string }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) { setTime('EXPIRED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endAt]);
  return <span className="font-mono text-xs">{time}</span>;
}

export default function AdminFlashDealsPage() {
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDeal, setEditingDeal] = useState<Partial<FlashDeal> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/flash-deals?admin=true').then(r => r.json());
      setDeals(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const saveDeal = async () => {
    if (!editingDeal?.title) { toast.error('Title is required'); return; }
    if (!editingDeal?.discountValue) { toast.error('Discount value is required'); return; }
    setSaving(true);
    try {
      const isNew = !editingDeal.id;
      const url = isNew ? '/api/flash-deals' : `/api/flash-deals/${editingDeal.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingDeal) });
      const data = await res.json();
      if (data.success || data.id) {
        toast.success(isNew ? 'Flash deal created! 🔥' : 'Deal updated!');
        setEditingDeal(null);
        fetchDeals();
      } else toast.error(data.error || 'Failed');
    } catch { toast.error('Error saving deal'); }
    setSaving(false);
  };

  const deleteDeal = async (id: string, title: string) => {
    if (!confirm(`Delete flash deal "${title}"?`)) return;
    await fetch(`/api/flash-deals/${id}`, { method: 'DELETE' });
    setDeals(d => d.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const toggleActive = async (deal: FlashDeal) => {
    await fetch(`/api/flash-deals/${deal.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !deal.isActive }) });
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, isActive: !d.isActive } : d));
    toast.success(deal.isActive ? 'Deal deactivated' : 'Deal activated 🔥');
  };

  const now = new Date().toISOString();
  const activeDeals = deals.filter(d => d.isActive && d.startAt <= now && d.endAt >= now);
  const upcomingDeals = deals.filter(d => d.startAt > now);
  const expiredDeals = deals.filter(d => d.endAt < now);

  const DealCard = ({ deal }: { deal: FlashDeal }) => {
    const isActive = deal.isActive && deal.startAt <= now && deal.endAt >= now;
    const isUpcoming = deal.startAt > now;
    const isExpired = deal.endAt < now;
    return (
      <div className="card overflow-hidden">
        {/* Coloured header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: deal.bannerColor + '15', borderLeft: `4px solid ${deal.bannerColor}` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0" style={{ background: deal.bannerColor }}>
            {deal.type === 'percentage' ? '%' : deal.type === 'fixed' ? '$' : deal.type === 'bogo' ? '2' : '📦'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">{deal.title}</span>
              <span className="badge text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: deal.bannerColor }}>{deal.badgeText}</span>
              {deal.isPinned && <span className="badge badge-yellow text-xs">📌 Pinned</span>}
              {isActive && <span className="badge badge-green text-xs">🔥 Live</span>}
              {isUpcoming && <span className="badge badge-blue text-xs">⏳ Upcoming</span>}
              {isExpired && <span className="badge badge-gray text-xs">Expired</span>}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {deal.type === 'percentage' ? `${deal.discountValue}% off` : deal.type === 'fixed' ? `$${deal.discountValue} off` : deal.type.toUpperCase()} ·&nbsp;
              {deal.scope === 'all' ? 'All products' : deal.scope === 'category' ? `${deal.categoryIds?.length} categories` : `${deal.productIds?.length} products`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => toggleActive(deal)} title={deal.isActive ? 'Deactivate' : 'Activate'}>
              {deal.isActive ? <ToggleRight className="w-5 h-5 text-green-500"/> : <ToggleLeft className="w-5 h-5 text-gray-400"/>}
            </button>
            <button onClick={() => setEditingDeal({ ...deal })} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
            <button onClick={() => deleteDeal(deal.id, deal.title)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-gray-100">
          <div><p className="text-gray-400">Start</p><p className="font-semibold text-gray-700">{formatDateTime(deal.startAt)}</p></div>
          <div><p className="text-gray-400">End</p><p className="font-semibold text-gray-700">{formatDateTime(deal.endAt)}</p></div>
          <div><p className="text-gray-400">{isActive ? 'Ends in' : isUpcoming ? 'Starts in' : 'Ended'}</p><p className="font-bold text-gray-900">{isExpired ? '—' : <CountdownTimer endAt={isActive ? deal.endAt : deal.startAt}/>}</p></div>
          <div><p className="text-gray-400">Used</p><p className="font-semibold text-gray-700">{deal.usedCount}{deal.maxUsesTotal ? ` / ${deal.maxUsesTotal}` : ' uses'}</p></div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-3"><Zap className="w-7 h-7 text-yellow-500"/>Flash Deals</h1>
          <p className="text-gray-500 text-sm mt-0.5">{activeDeals.length} live · {upcomingDeals.length} upcoming · {expiredDeals.length} expired</p>
        </div>
        <button onClick={() => setEditingDeal(emptyDeal())} className="btn-primary py-2 px-4 text-sm"><Plus className="w-4 h-4"/>New Flash Deal</button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full rounded-2xl"/>)}</div>
      ) : deals.length === 0 ? (
        <div className="card p-16 text-center">
          <Zap className="w-12 h-12 text-yellow-300 mx-auto mb-4"/>
          <p className="text-gray-500 font-semibold mb-1">No flash deals yet</p>
          <p className="text-gray-400 text-sm mb-6">Create time-limited deals to boost sales</p>
          <button onClick={() => setEditingDeal(emptyDeal())} className="btn-primary py-2 px-6 text-sm"><Plus className="w-4 h-4"/>Create First Deal</button>
        </div>
      ) : (
        <div className="space-y-6">
          {activeDeals.length > 0 && (
            <div>
              <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>🔥 Live Now</h2>
              <div className="space-y-3">{activeDeals.map(d => <DealCard key={d.id} deal={d}/>)}</div>
            </div>
          )}
          {upcomingDeals.length > 0 && (
            <div>
              <h2 className="font-bold text-gray-800 mb-3">⏳ Upcoming</h2>
              <div className="space-y-3">{upcomingDeals.map(d => <DealCard key={d.id} deal={d}/>)}</div>
            </div>
          )}
          {expiredDeals.length > 0 && (
            <div>
              <h2 className="font-bold text-gray-800 mb-3 text-gray-400">Expired</h2>
              <div className="space-y-3 opacity-60">{expiredDeals.map(d => <DealCard key={d.id} deal={d}/>)}</div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-6">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-500"/>{editingDeal.id ? 'Edit' : 'New'} Flash Deal</h3>
              <button onClick={() => setEditingDeal(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Basic info */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Deal Title *</label>
                  <input value={editingDeal.title || ''} onChange={e => setEditingDeal(d => ({ ...d!, title: e.target.value }))} className="input-field" placeholder="Summer Flash Sale"/>
                </div>
                <div>
                  <label className="label">Badge Text</label>
                  <input value={editingDeal.badgeText || ''} onChange={e => setEditingDeal(d => ({ ...d!, badgeText: e.target.value }))} className="input-field" placeholder="FLASH DEAL"/>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Subtitle</label>
                  <input value={editingDeal.subtitle || ''} onChange={e => setEditingDeal(d => ({ ...d!, subtitle: e.target.value }))} className="input-field" placeholder="Limited time only — don't miss out!"/>
                </div>
              </div>

              {/* Discount */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Discount Type</label>
                  <select value={editingDeal.type} onChange={e => setEditingDeal(d => ({ ...d!, type: e.target.value as any }))} className="input-field">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                    <option value="bogo">Buy One Get One</option>
                    <option value="bundle">Bundle Deal</option>
                  </select>
                </div>
                <div>
                  <label className="label">Discount Value {editingDeal.type === 'percentage' ? '(%)' : '($)'}</label>
                  <input type="number" step={editingDeal.type === 'percentage' ? '1' : '0.01'} value={editingDeal.discountValue || ''} onChange={e => setEditingDeal(d => ({ ...d!, discountValue: Number(e.target.value) }))} className="input-field"/>
                </div>
                <div>
                  <label className="label">Min Cart Amount ($)</label>
                  <input type="number" step="0.01" value={editingDeal.minCartAmount || ''} onChange={e => setEditingDeal(d => ({ ...d!, minCartAmount: e.target.value ? Number(e.target.value) : undefined }))} className="input-field" placeholder="No minimum"/>
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="label">Apply To</label>
                <div className="flex gap-2">
                  {[['all','All Products'],['category','Categories'],['products','Specific Products']].map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setEditingDeal(d => ({ ...d!, scope: v as any }))}
                      className={`flex-1 py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${editingDeal.scope === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                {editingDeal.scope === 'products' && (
                  <div className="mt-2">
                    <label className="label">Product IDs (comma separated)</label>
                    <input value={(editingDeal.productIds || []).join(', ')} onChange={e => setEditingDeal(d => ({ ...d!, productIds: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }))} className="input-field text-sm font-mono" placeholder="productId1, productId2"/>
                  </div>
                )}
                {editingDeal.scope === 'category' && (
                  <div className="mt-2">
                    <label className="label">Category IDs (comma separated)</label>
                    <input value={(editingDeal.categoryIds || []).join(', ')} onChange={e => setEditingDeal(d => ({ ...d!, categoryIds: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }))} className="input-field text-sm font-mono" placeholder="catId1, catId2"/>
                  </div>
                )}
              </div>

              {/* Time */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date & Time</label>
                  <input type="datetime-local" value={toLocalDatetime(editingDeal.startAt || '')} onChange={e => setEditingDeal(d => ({ ...d!, startAt: fromLocalDatetime(e.target.value) }))} className="input-field"/>
                </div>
                <div>
                  <label className="label">End Date & Time</label>
                  <input type="datetime-local" value={toLocalDatetime(editingDeal.endAt || '')} onChange={e => setEditingDeal(d => ({ ...d!, endAt: fromLocalDatetime(e.target.value) }))} className="input-field"/>
                </div>
              </div>

              {/* Usage limit */}
              <div>
                <label className="label">Max Total Uses (optional)</label>
                <input type="number" value={editingDeal.maxUsesTotal || ''} onChange={e => setEditingDeal(d => ({ ...d!, maxUsesTotal: e.target.value ? Number(e.target.value) : undefined }))} className="input-field" placeholder="Unlimited"/>
              </div>

              {/* Banner Color */}
              <div>
                <label className="label">Banner Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c.value} type="button" onClick={() => setEditingDeal(d => ({ ...d!, bannerColor: c.value }))}
                      className={`w-9 h-9 rounded-xl ${c.bg} transition-all ${editingDeal.bannerColor === c.value ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'hover:scale-105'}`}
                      title={c.label}/>
                  ))}
                  <div className="flex items-center gap-2">
                    <input type="color" value={editingDeal.bannerColor || '#ef4444'} onChange={e => setEditingDeal(d => ({ ...d!, bannerColor: e.target.value }))} className="w-9 h-9 rounded-xl border-2 border-gray-200 cursor-pointer"/>
                    <span className="text-xs text-gray-400">Custom</span>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { key: 'isActive', label: 'Deal Active' },
                  { key: 'isPinned', label: '📌 Pin to Top' },
                  { key: 'showCountdown', label: '⏱ Show Countdown Timer' },
                  { key: 'showOnHomepage', label: '🏠 Show on Homepage' },
                  { key: 'showOnProductPage', label: '📦 Show on Product Pages' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!(editingDeal as any)[key]} onChange={e => setEditingDeal(d => ({ ...d!, [key]: e.target.checked }))} className="w-4 h-4 accent-brand-600 rounded"/>
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              {/* Preview */}
              {editingDeal.title && (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <div className="px-4 py-3 text-white text-center" style={{ background: editingDeal.bannerColor }}>
                    <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full mr-2">{editingDeal.badgeText}</span>
                    <span className="font-bold">{editingDeal.title}</span>
                    {editingDeal.subtitle && <span className="text-white/80 text-sm ml-2">— {editingDeal.subtitle}</span>}
                    <div className="text-2xl font-black mt-1">{editingDeal.type === 'percentage' ? `${editingDeal.discountValue}% OFF` : editingDeal.type === 'fixed' ? `$${editingDeal.discountValue} OFF` : editingDeal.type?.toUpperCase()}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditingDeal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
              <button onClick={saveDeal} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><Save className="w-4 h-4"/>{editingDeal.id ? 'Save Changes' : 'Create Deal 🔥'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
