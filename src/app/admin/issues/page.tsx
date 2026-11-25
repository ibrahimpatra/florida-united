'use client';
import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

type Issue = { id: string; route: string; method: string; status: number; message: string; user: string; count: number; firstAt: string; lastAt: string };
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export default function AdminIssuesPage() {
  const [rows, setRows] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/admin/issues', { cache: 'no-store' }); const d = await r.json(); if (!r.ok) throw new Error(d?.error || 'Failed to load'); setRows(d); }
    catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const clear = async (id?: string) => {
    if (!id && !confirm('Clear all issues?')) return;
    const r = await fetch(`/api/admin/issues${id ? `?id=${encodeURIComponent(id)}` : ''}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('Could not clear.'); return; }
    load();
  };
  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Issues</h1>
          <p className="text-gray-500 text-sm">Server problems from anywhere in the app, including login and register failures that nobody could see. The same problem repeated shows once with a count.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary py-2 px-3 text-sm"><RefreshCw className="w-4 h-4" />Refresh</button>
          {rows.length > 0 && <button onClick={() => clear()} className="btn-secondary py-2 px-3 text-sm"><Trash2 className="w-4 h-4" />Clear all</button>}
        </div>
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : rows.length === 0 ? (
        <div className="card p-10 text-center text-gray-500"><CheckCircle2 className="w-10 h-10 mx-auto text-green-500" /><p className="mt-3 font-medium text-gray-700">No problems recorded</p></div>
      ) : (
        <div className="space-y-3">
          {rows.map(i => (
            <div key={i.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="badge badge-red font-mono">{i.status}</span>
                <span className="font-mono font-semibold text-gray-800">{i.method} {i.route}</span>
                <span className="text-gray-500">{i.count > 1 ? `${i.count} times, ` : ''}last {ago(i.lastAt)}{i.user ? ` · ${i.user}` : ''}</span>
                <button onClick={() => clear(i.id)} aria-label="Dismiss" className="ms-auto p-1.5 rounded-lg hover:bg-gray-100"><Trash2 className="w-3.5 h-3.5 text-gray-500" /></button>
              </div>
              <p className="mt-2 text-sm text-gray-800 break-words">{i.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
