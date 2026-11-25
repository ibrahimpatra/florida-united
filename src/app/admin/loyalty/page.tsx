'use client';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { NumberInput } from '@/components/ui/NumberInput';

export default function AdminLoyaltyPage() {
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [adj, setAdj] = useState({ who: '', points: '', note: '' });

  useEffect(() => { fetch('/api/admin/loyalty', { cache: 'no-store' }).then(r => r.json()).then(setS).catch(() => toast.error('Could not load')); }, []);
  if (!s) return <div className="p-8 text-gray-400">Loading...</div>;
  const set = (k: string, v: any) => setS((p: any) => ({ ...p, [k]: v }));
  const setTier = (i: number, k: string, v: any) => set('tiers', s.tiers.map((t: any, j: number) => (j === i ? { ...t, [k]: v } : t)));

  const save = async () => {
    setSaving(true);
    try { const r = await fetch('/api/admin/loyalty', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }); const d = await r.json(); if (!r.ok) return toast.error(d.error || 'Failed'); setS(d.settings); toast.success('Saved'); }
    finally { setSaving(false); }
  };
  const adjust = async () => {
    const r = await fetch('/api/admin/loyalty', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: adj.who, points: Number(adj.points), note: adj.note }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) return toast.error(d.error || 'Failed');
    toast.success('Points updated'); setAdj({ who: '', points: '', note: '' });
  };
  const worth100 = Math.round(100 * s.pointValueKwd * 1000) / 1000;

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Loyalty points</h1>
        <p className="text-gray-500 text-sm">Customers earn points when an order is delivered and can spend them at checkout. Cancelled orders give used points back; refunded returns take back the points earned.</p>
      </div>
      <div className="card p-5 space-y-4">
        <label className="flex items-center gap-3 font-semibold text-gray-900"><input type="checkbox" className="w-5 h-5 accent-brand-600" checked={!!s.enabled} onChange={e => set('enabled', e.target.checked)} />Loyalty programme is on</label>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Points earned per 1 KWD spent</label><NumberInput value={s.earnPerKwd} onChange={(v: any) => set('earnPerKwd', Number(v))} className="input-field" /></div>
          <div><label className="label">Value of one point (KWD)</label><NumberInput value={s.pointValueKwd} onChange={(v: any) => set('pointValueKwd', Number(v))} className="input-field" /><p className="text-xs text-gray-500 mt-1">100 points = {worth100} KWD</p></div>
          <div><label className="label">Smallest redemption (points)</label><NumberInput value={s.minRedeem} onChange={(v: any) => set('minRedeem', Number(v))} className="input-field" /></div>
          <div><label className="label">Points can pay at most (% of goods)</label><NumberInput value={s.maxRedeemPct} onChange={(v: any) => set('maxRedeemPct', Number(v))} className="input-field" /></div>
        </div>
        <div>
          <p className="font-semibold text-gray-900 mb-2">Tiers (bonus points by lifetime spending)</p>
          {s.tiers.map((t: any, i: number) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 mb-2 items-end">
              <div><label className="label text-xs">Name</label><input className="input-field" value={t.name} onChange={e => setTier(i, 'name', e.target.value)} /></div>
              <div><label className="label text-xs">Arabic</label><input dir="rtl" className="input-field" value={t.nameAr || ''} onChange={e => setTier(i, 'nameAr', e.target.value)} /></div>
              <div><label className="label text-xs">From spent (KWD)</label><NumberInput value={t.minSpent} onChange={(v: any) => setTier(i, 'minSpent', Number(v))} className="input-field" /></div>
              <div><label className="label text-xs">Bonus %</label><NumberInput value={t.bonusPct} onChange={(v: any) => setTier(i, 'bonusPct', Number(v))} className="input-field" /></div>
              <button onClick={() => set('tiers', s.tiers.filter((_: any, j: number) => j !== i))} className="p-2 text-gray-400 hover:text-red-600" aria-label="Remove tier"><Trash2 className="w-4 h-4" /></button>
            </div>))}
          <button onClick={() => set('tiers', [...s.tiers, { name: '', nameAr: '', minSpent: 0, bonusPct: 0 }])} className="text-sm text-brand-700 font-semibold inline-flex items-center gap-1"><Plus className="w-4 h-4" />Add tier</button>
        </div>
        <div className="flex justify-end"><button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save'}</button></div>
      </div>

      <div className="card p-5 space-y-3">
        <p className="font-semibold text-gray-900">Add or remove points for one customer</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <input className="input-field" placeholder="Customer email" value={adj.who} onChange={e => setAdj({ ...adj, who: e.target.value })} />
          <input className="input-field" placeholder="+100 or -50" value={adj.points} onChange={e => setAdj({ ...adj, points: e.target.value })} />
          <input className="input-field" placeholder="Reason (shown to the customer)" value={adj.note} onChange={e => setAdj({ ...adj, note: e.target.value })} />
        </div>
        <button onClick={adjust} disabled={!adj.who || !adj.points} className="btn-secondary text-sm disabled:opacity-50">Apply</button>
      </div>
    </div>
  );
}
