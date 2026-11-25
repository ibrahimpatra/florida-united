'use client';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';

const n = (v: number) => v.toLocaleString('en-US');
const usd = (v: number) => `$${v < 1 ? v.toFixed(3) : v.toFixed(2)}`;

export default function AiUsagePage() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [sel, setSel] = useState(0);
  useEffect(() => { fetch('/api/admin/ai-usage', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) setErr(j.error || 'Could not load'); else setD(j); }).catch(() => setErr('Could not load')); }, []);
  if (err) return <p className="p-8 text-red-600">{err}</p>;
  if (!d) return <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>;
  const days: any[] = d.days;
  const today = days.find(x => x.day === new Date().toISOString().slice(0, 10)) || { calls: 0, errors: 0, fallbacks: 0, bulkCalls: 0, tokensIn: 0, tokensOut: 0, usd: 0, models: [], providers: [], tasks: [], avgMs: 0 };
  const cur = days[sel] || today;
  const max = Math.max(1, ...days.map(x => x.calls));
  const month = days.reduce((a, x) => a + x.usd, 0);
  const Card = ({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) => (
    <div className={`card p-4 ${warn ? 'border-amber-300 bg-amber-50' : ''}`}><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-black text-gray-900 mt-1">{value}</p>{sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}</div>
  );
  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2"><Sparkles className="w-6 h-6 text-brand-600" />AI usage</h1>
      <p className="text-sm text-gray-500 mb-5">Counted by this app on every AI call (no prompts or answers are stored). Costs are estimates from list prices; your Google and OpenAI bills are the truth.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Card label="Calls today" value={n(today.calls)} sub={`${n(today.tokensIn + today.tokensOut)} tokens`} />
        <Card label="Failed today" value={n(today.errors)} sub={today.fallbacks ? `${today.fallbacks} used the backup` : 'no backup needed'} warn={today.errors > 0} />
        <Card label="Background cap" value={`${n(today.bulkCalls)} / ${n(d.cap)}`} sub="bulk jobs today" warn={today.bulkCalls >= d.cap} />
        <Card label="Estimated cost, 30 days" value={usd(month)} sub={`today ${usd(today.usd)}`} />
      </div>

      {d.openai?.ok ? (
        <div className="card p-4 mb-5"><p className="text-sm font-bold text-gray-800">OpenAI says (last 30 days): {usd(d.openai.totalUsd)}</p><p className="text-xs text-gray-500">From OpenAI's own billing, as a cross-check of our counters.</p></div>
      ) : (
        <div className="card p-4 mb-5 text-sm text-gray-600">
          {d.openai?.error === 'not-configured'
            ? <>OpenAI's own numbers are off. To cross-check, add an OpenAI <b>admin</b> key as <code>OPENAI_ADMIN_KEY</code> on Vercel (optional). Google has no such call, so Google usage is only what we count here.</>
            : <span className="flex items-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" />{d.openai?.error}</span>}
        </div>
      )}

      <div className="card p-4 mb-5">
        <h2 className="font-bold text-gray-800 text-sm mb-3">Calls per day (tap a day)</h2>
        {days.length === 0 ? <p className="text-sm text-gray-500">No AI calls recorded yet.</p> : (
          <div className="flex items-end gap-1 h-28">
            {[...days].reverse().map(x => { const i = days.indexOf(x); return (
              <button key={x.day} onClick={() => setSel(i)} title={`${x.day}: ${x.calls} calls`} className={`flex-1 min-w-[6px] rounded-t ${i === sel ? 'bg-brand-600' : 'bg-brand-200 hover:bg-brand-300'}`} style={{ height: `${Math.max(4, (x.calls / max) * 100)}%` }} />
            ); })}
          </div>
        )}
      </div>

      {days.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4">
            <h2 className="font-bold text-gray-800 text-sm mb-2">{cur.day}: by provider</h2>
            <table className="w-full text-sm"><thead><tr className="text-xs text-gray-500 text-start"><th className="text-start font-medium">Provider</th><th className="text-end font-medium">Calls</th><th className="text-end font-medium">Failed</th><th className="text-end font-medium">Tokens</th></tr></thead>
              <tbody>{cur.providers.map((p: any) => <tr key={p.provider} className="border-t border-gray-100"><td className="py-1.5 capitalize">{p.provider}</td><td className="text-end">{n(p.calls)}</td><td className="text-end">{n(p.errors)}</td><td className="text-end">{n(p.tokensIn + p.tokensOut)}</td></tr>)}</tbody></table>
            <p className="text-xs text-gray-500 mt-2">Average answer time {cur.avgMs} ms.</p>
          </div>
          <div className="card p-4">
            <h2 className="font-bold text-gray-800 text-sm mb-2">{cur.day}: by model</h2>
            <table className="w-full text-sm"><thead><tr className="text-xs text-gray-500"><th className="text-start font-medium">Model</th><th className="text-end font-medium">Calls</th><th className="text-end font-medium">Est. cost</th></tr></thead>
              <tbody>{cur.models.map((m: any) => <tr key={m.model} className="border-t border-gray-100"><td className="py-1.5 break-all">{m.model}</td><td className="text-end">{n(m.calls)}</td><td className="text-end">{usd(m.usd)}</td></tr>)}</tbody></table>
          </div>
          <div className="card p-4">
            <h2 className="font-bold text-gray-800 text-sm mb-2">{cur.day}: what it was used for</h2>
            {cur.tasks.length ? <ul className="text-sm divide-y divide-gray-100">{cur.tasks.map((t: any) => <li key={t.task} className="py-1.5 flex justify-between"><span className="capitalize">{t.task}</span><b>{n(t.calls)}</b></li>)}</ul> : <p className="text-sm text-gray-500">No task names recorded.</p>}
          </div>
          {cur.lastError && <div className="card p-4 border-red-200"><h2 className="font-bold text-red-700 text-sm mb-1">Last failure</h2><p className="text-sm text-gray-700 break-words">{cur.lastError}</p><p className="text-xs text-gray-400 mt-1">{cur.lastErrorAt}</p></div>}
        </div>
      )}
    </div>
  );
}
