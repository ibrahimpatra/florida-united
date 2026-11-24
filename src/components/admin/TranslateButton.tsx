'use client';
import { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * "Translate to Arabic" for admin forms. Give it the English values and the matching setters:
 *   <TranslateButton fields={[{ en: form.name, set: v => setForm(f => ({...f, nameAr: v})) }, ...]} context="product" />
 * It sends the text in small batches and fills the Arabic boxes. By default it only fills boxes that are still empty,
 * so it never overwrites Arabic you wrote yourself; tick "overwrite" by passing overwrite and the current Arabic.
 */
export function TranslateButton({ fields, context, label = 'Translate to Arabic', overwrite = false }: {
  fields: { en?: string; ar?: string; set: (arabic: string) => void }[]; context?: string; label?: string; overwrite?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const run = async () => {
    const todo = fields.map((f, i) => ({ f, i })).filter(({ f }) => (f.en || '').trim() && (overwrite || !(f.ar || '').trim()));
    if (!todo.length) { toast((fields.some(f => (f.en || '').trim()) ? 'Arabic is already filled in.' : 'Write the English text first.'), { icon: 'i' }); return; }
    setBusy(true);
    // Many fields in one request made the model stall or cut its answer. Small batches (about 6 fields / 1500 characters), two at a time,
    // each retried once, and every finished batch fills its boxes straight away, so a failure never loses the rest.
    const batches: typeof todo[] = []; let cur: typeof todo = []; let chars = 0;
    for (const t of todo) {
      const len = (t.f.en || '').length;
      if (cur.length && (cur.length >= 6 || chars + len > 1500)) { batches.push(cur); cur = []; chars = 0; }
      cur.push(t); chars += len;
    }
    if (cur.length) batches.push(cur);
    let done = 0, filled = 0, lastError = '';
    const doBatch = async (batch: typeof todo) => {
      let left = batch;
      for (let attempt = 0; attempt < 3 && left.length; attempt++) {
        try {
          const r = await fetch('/api/admin/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: Object.fromEntries(left.map(({ f, i }) => [`f${i}`, f.en])), context }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) { lastError = d.error || `Error ${r.status}`; if (r.status === 503 || r.status === 401 || r.status === 400) return; await new Promise(res => setTimeout(res, 800)); continue; }
          const rest: typeof todo = [];
          for (const x of left) { const t = d.translations?.[`f${x.i}`]; if (t) { x.f.set(t); filled++; } else rest.push(x); }
          left = rest;
        } catch { lastError = 'Could not reach the translator.'; await new Promise(res => setTimeout(res, 800)); }
      }
    };
    try {
      const queue = [...batches];
      await Promise.all([0, 1].map(async () => {
        for (let b = queue.shift(); b; b = queue.shift()) { await doBatch(b); done++; setProgress(`${Math.min(done, batches.length)}/${batches.length}`); }
      }));
    } finally { setBusy(false); setProgress(''); }
    if (filled === todo.length) toast.success(`${filled} field${filled === 1 ? '' : 's'} translated. Please check the Arabic before saving.`);
    else if (filled) toast(`${filled} of ${todo.length} fields translated. Press the button again for the rest.${lastError ? ' (' + lastError + ')' : ''}`, { icon: '!' });
    else toast.error(lastError || 'Translation failed.');
  };
  return (
    <button type="button" onClick={run} disabled={busy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-300 bg-white text-brand-700 text-xs font-semibold hover:bg-brand-50 disabled:opacity-60">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}{busy && progress ? `${label} ${progress}` : label}
    </button>
  );
}
