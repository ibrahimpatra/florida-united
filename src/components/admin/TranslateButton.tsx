'use client';
import { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * "Translate to Arabic" for admin forms. Give it the English values and the matching setters:
 *   <TranslateButton fields={[{ en: form.name, set: v => setForm(f => ({...f, nameAr: v})) }, ...]} context="product" />
 * It sends everything in ONE request and fills the Arabic boxes. By default it only fills boxes that are still empty,
 * so it never overwrites Arabic you wrote yourself; tick "overwrite" by passing overwrite and the current Arabic.
 */
export function TranslateButton({ fields, context, label = 'Translate to Arabic', overwrite = false }: {
  fields: { en?: string; ar?: string; set: (arabic: string) => void }[]; context?: string; label?: string; overwrite?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const todo = fields.map((f, i) => ({ f, i })).filter(({ f }) => (f.en || '').trim() && (overwrite || !(f.ar || '').trim()));
    if (!todo.length) { toast((fields.some(f => (f.en || '').trim()) ? 'Arabic is already filled in.' : 'Write the English text first.'), { icon: 'i' }); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: Object.fromEntries(todo.map(({ f, i }) => [`f${i}`, f.en])), context }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || 'Translation failed.'); setBusy(false); return; }
      let n = 0;
      for (const { f, i } of todo) { const t = d.translations?.[`f${i}`]; if (t) { f.set(t); n++; } }
      toast.success(`${n} field${n === 1 ? '' : 's'} translated. Please check the Arabic before saving.`);
    } catch { toast.error('Could not reach the translator.'); }
    setBusy(false);
  };
  return (
    <button type="button" onClick={run} disabled={busy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-300 bg-white text-brand-700 text-xs font-semibold hover:bg-brand-50 disabled:opacity-60">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}{label}
    </button>
  );
}
