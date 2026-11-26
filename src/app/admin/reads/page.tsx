'use client';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, Gauge, RefreshCw, RotateCcw } from 'lucide-react';

const n = (v: number) => v.toLocaleString('en-US');

export default function ReadMeterPage() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { const r = await fetch('/api/admin/reads', { cache: 'no-store' }); const j = await r.json(); if (!r.ok) setErr(j.error || 'Could not load'); else { setD(j); setErr(''); } } catch { setErr('Could not load'); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const reset = async () => { if (!confirm('Start counting from zero on this server?')) return; await fetch('/api/admin/reads', { method: 'DELETE' }); load(); };

  if (err) return <p className="p-8 text-red-600">{err}</p>;
  if (!d) return <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>;
  const max = Math.max(1, ...d.routes.map((r: any) => r.reads), d.other);
  const mins = Math.max(1, Math.round((Date.now() - d.since) / 60000));
  const Bar = ({ v }: { v: number }) => <div className="h-1.5 rounded-full bg-gray-100 mt-1"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.max(2, (v / max) * 100)}%` }} /></div>;
  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><Gauge className="w-5 h-5 text-brand-600" />Read meter</h1>
        <div className="ms-auto flex gap-1.5">
          <button onClick={load} disabled={busy} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-xl text-sm bg-white hover:bg-gray-50"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button>
          <button onClick={reset} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-xl text-sm bg-white hover:bg-gray-50"><RotateCcw className="w-4 h-4" />Reset</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">Database reads counted on <b>this server</b> over the last {mins} min: <b>{n(d.total)}</b> in total. Vercel can run several servers, so Firebase&apos;s Usage tab is the grand total; use this to see <i>which pages</i> cost the most. A route that reads 40 or more in one call is also written to the Vercel logs as <span className="font-mono">[reads]</span>.</p>
      <div className="card divide-y divide-gray-50">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-2 text-xs font-bold text-gray-500"><span>Route</span><span className="text-end">Calls</span><span className="text-end">Avg</span><span className="text-end">Reads</span></div>
        {d.other > 0 && (<div className="px-3 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-sm"><div><span className="text-gray-700">Page renders and background work</span><Bar v={d.other} /></div><span /><span /><span className="font-bold text-end">{n(d.other)}</span></div>)}
        {d.routes.length === 0 && d.other === 0 && <p className="p-6 text-center text-sm text-gray-400">Nothing counted yet. Use the site, then refresh.</p>}
        {d.routes.map((r: any) => (
          <div key={r.route} className="px-3 py-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-sm items-start">
            <div className="min-w-0"><p className="font-mono text-xs text-gray-700 truncate">{r.route}</p><Bar v={r.reads} /></div>
            <span className="text-end text-gray-500">{n(r.calls)}</span>
            <span className={`text-end ${r.avg >= 40 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{r.avg}</span>
            <span className="text-end font-bold">{n(r.reads)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
