'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Play, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Job { id: string; type: string; status: 'queued' | 'running' | 'done' | 'failed'; productId: string; productName: string; attempts: number; error?: string; result?: any; provider?: string; updatedAt: string }
const COLOR: Record<string, string> = { queued: 'badge-blue', running: 'badge-yellow', done: 'badge-green', failed: 'badge-red' };

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try { const r = await fetch('/api/admin/jobs', { cache: 'no-store' }); const d = await r.json(); if (r.ok) { setJobs(d.jobs || []); setWaiting(Number(d.queued) || 0); } else toast.error(d.error || 'Could not load jobs'); }
    catch { toast.error('Could not load jobs'); }
    setLoading(false);
  }, []);
  const post = useCallback(async (body: any, quiet = false) => {
    if (busyRef.current) return; busyRef.current = true; setBusy(true);
    try {
      const r = await fetch('/api/admin/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) toast.error(d.error || 'Failed');
      else if (!quiet) toast.success(d.queued !== undefined ? `${d.queued} product(s) queued` : d.ran !== undefined ? `${d.ran} job(s) processed` : 'Done');
    } catch { if (!quiet) toast.error('Request failed'); }
    busyRef.current = false; setBusy(false); load();
  }, [load]);

  useEffect(() => { load(); }, [load]);
  // While this page is open, queued jobs are worked on automatically (Vercel Hobby has no always-on worker).
  useEffect(() => {
    // Only while jobs are waiting, only while this tab is on screen, and no faster than every 30 s: every refresh is a database read.
    if (!waiting) return;
    const t = setInterval(() => { if (!document.hidden) post({ action: 'run' }, true); }, 30000);
    return () => clearInterval(t);
  }, [waiting, post]);

  const counts = jobs.reduce((a: any, j) => { a[j.status] = (a[j.status] || 0) + 1; return a; }, {});

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Background jobs</h1>
          <p className="text-gray-500 text-sm">When a product is saved without description, Arabic text, meta title, meta description or tags, the AI fills only the empty ones here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => post({ action: 'queue-missing' })} disabled={busy} className="btn-secondary text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" />Queue all products missing SEO</button>
          <button onClick={() => post({ action: 'run' })} disabled={busy} className="btn-primary text-sm flex items-center gap-2"><Play className="w-4 h-4" />{busy ? 'Working...' : 'Run queued jobs'}</button>
          <button onClick={load} className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {(['queued', 'running', 'done', 'failed'] as const).map(s => <span key={s} className={`badge ${COLOR[s]}`}>{s}: {counts[s] || 0}</span>)}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 text-xs"><th className="p-3">Product</th><th className="p-3">Status</th><th className="p-3">Result</th><th className="p-3">Updated</th><th className="p-3" /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading...</td></tr>
              : !jobs.length ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">No jobs yet. They appear when you save a product with empty SEO fields.</td></tr>
              : jobs.map(j => (
                <tr key={j.id} className="border-t border-gray-100 align-top">
                  <td className="p-3 font-semibold text-gray-900">{j.productName || j.productId}<div className="text-xs font-normal text-gray-400">SEO text</div></td>
                  <td className="p-3"><span className={`badge ${COLOR[j.status]}`}>{j.status}</span>{j.attempts > 0 && <span className="ml-2 text-xs text-gray-400">try {j.attempts}</span>}</td>
                  <td className="p-3 text-gray-600 max-w-xs">
                    {j.result?.filled?.length ? <>Filled: {j.result.filled.join(', ')}{j.provider && <span className="text-xs text-gray-400"> via {j.provider}</span>}</> : null}
                    {j.error ? <div className="text-xs text-red-600 break-words">{j.error}</div> : null}
                  </td>
                  <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{new Date(j.updatedAt).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    {(j.status === 'failed' || j.status === 'done') && <button onClick={() => post({ action: 'retry', id: j.id })} disabled={busy} className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" />Run again</button>}
                  </td>
                </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
