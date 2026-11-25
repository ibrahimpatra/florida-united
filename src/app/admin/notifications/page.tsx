'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bell, Send, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface B { id: string; title: string; titleAr?: string; body?: string; href?: string; createdAt: string }
const EMPTY = { title: '', titleAr: '', body: '', bodyAr: '', href: '' };

/** Write a message that appears in every customer's bell (offers, announcements). Order and return alerts are sent automatically. */
export default function AdminNotificationsPage() {
  const [f, setF] = useState(EMPTY);
  const [list, setList] = useState<B[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/notifications?scope=broadcasts', { cache: 'no-store' }); const d = await r.json(); setList(d.items || []); } catch { toast.error('Could not load the list'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!f.title.trim()) { toast.error('Write a title first.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'broadcast', ...f }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not send');
      toast.success('Sent. Customers see it in their bell.'); setF(EMPTY); load();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
  const remove = async (id: string) => {
    if (!confirm('Remove this message from customers\' bells?')) return;
    const r = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
    if (r.ok) { setList(l => l.filter(x => x.id !== id)); toast.success('Removed'); } else toast.error('Could not remove');
  };
  const set = (k: keyof typeof EMPTY) => (e: any) => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><Bell className="w-5 h-5 text-brand-600" />Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">Send an offer or announcement to every customer's bell. Order updates, new orders and return requests are sent automatically.</p>
      </div>
      <div className="card p-5 grid sm:grid-cols-2 gap-4">
        <div><label className="label">Title *</label><input className="input-field" value={f.title} onChange={set('title')} maxLength={120} placeholder="Free delivery this weekend" /></div>
        <div><label className="label">Title (Arabic)</label><input className="input-field" dir="rtl" value={f.titleAr} onChange={set('titleAr')} maxLength={120} /></div>
        <div><label className="label">Message</label><textarea className="input-field" rows={2} value={f.body} onChange={set('body')} maxLength={300} /></div>
        <div><label className="label">Message (Arabic)</label><textarea className="input-field" dir="rtl" rows={2} value={f.bodyAr} onChange={set('bodyAr')} maxLength={300} /></div>
        <div className="sm:col-span-2"><label className="label">Opens this page (optional)</label><input className="input-field" dir="ltr" value={f.href} onChange={set('href')} placeholder="/deals" />
          <p className="text-xs text-gray-400 mt-1">A page on this site, starting with /. Arabic falls back to the English text if left empty.</p></div>
        <div className="sm:col-span-2"><button onClick={send} disabled={busy} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"><Send className="w-4 h-4" />{busy ? 'Sending…' : 'Send to all customers'}</button></div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2"><h2 className="text-sm font-bold text-gray-900">Sent messages</h2><button onClick={load} className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Refresh</button></div>
        <div className="card divide-y divide-gray-100">
          {loading ? <p className="p-5 text-sm text-gray-400">Loading…</p> : list.length === 0 ? <p className="p-5 text-sm text-gray-400">Nothing sent yet.</p> : list.map(b => (
            <div key={b.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-900">{b.title}</p>{b.body && <p className="text-xs text-gray-500">{b.body}</p>}<p className="text-[11px] text-gray-400 mt-1">{new Date(b.createdAt).toLocaleString()}{b.href ? ` · ${b.href}` : ''}</p></div>
              <button onClick={() => remove(b.id)} aria-label="Remove" className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
