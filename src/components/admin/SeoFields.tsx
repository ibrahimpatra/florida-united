'use client';
import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

type Doc = Record<string, any>;

/** "Fill blanks with AI": writes empty Arabic and SEO fields of the form being edited (nothing is saved until you press Save). */
export function AiFillButton({ collection, doc, onPatch, label = 'Fill blanks with AI' }: { collection: string; doc: Doc; onPatch: (p: Doc) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/fill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection, doc }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast.error(d.error || 'AI is unavailable right now.');
      const n = Object.keys(d.patch || {}).length;
      if (!n) return toast(d.note || 'Nothing to fill.', { icon: 'i' });
      onPatch(d.patch); toast.success(`${n} field${n === 1 ? '' : 's'} filled. Please read them before saving.`);
    } catch { toast.error('Network error. Try again.'); }
    finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={run} disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-200 bg-brand-50 text-brand-800 text-sm font-semibold hover:bg-brand-100 disabled:opacity-50">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{label}
    </button>
  );
}

/** Search-engine fields. `meta` = title, description and keywords (pages that Google can open); `alt` = picture description (English + Arabic). */
export function SeoFields({ value, onChange, meta = true, alt = true }: { value: Doc; onChange: (patch: Doc) => void; meta?: boolean; alt?: boolean }) {
  const tags: string[] = Array.isArray(value.tags) ? value.tags : [];
  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="font-semibold text-gray-900 text-sm">Search engines (SEO)</p>
      {meta && (<>
        <div><label className="label">Meta title <span className="text-gray-400 font-normal">({(value.metaTitle || '').length}/60)</span></label>
          <input className="input-field" value={value.metaTitle || ''} maxLength={70} onChange={e => onChange({ metaTitle: e.target.value })} /></div>
        <div><label className="label">Meta description <span className="text-gray-400 font-normal">({(value.metaDesc || '').length}/160)</span></label>
          <textarea className="input-field resize-none" rows={2} value={value.metaDesc || ''} maxLength={170} onChange={e => onChange({ metaDesc: e.target.value })} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Meta title (Arabic) <span className="text-gray-400 font-normal">({(value.metaTitleAr || '').length}/60)</span></label>
            <input dir="rtl" className="input-field" value={value.metaTitleAr || ''} maxLength={70} onChange={e => onChange({ metaTitleAr: e.target.value })} /></div>
          <div><label className="label">Meta description (Arabic) <span className="text-gray-400 font-normal">({(value.metaDescAr || '').length}/160)</span></label>
            <textarea dir="rtl" className="input-field resize-none" rows={2} value={value.metaDescAr || ''} maxLength={170} onChange={e => onChange({ metaDescAr: e.target.value })} /></div>
        </div>
        <div><label className="label">Keywords (comma separated)</label>
          <input className="input-field" value={tags.join(', ')} onChange={e => onChange({ tags: e.target.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 15) })} /></div>
      </>)}
      {alt && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Picture description (English)</label><input className="input-field" value={value.imageAlt || ''} maxLength={120} onChange={e => onChange({ imageAlt: e.target.value })} placeholder="Describes the picture for Google and screen readers" /></div>
          <div><label className="label">Picture description (Arabic)</label><input dir="rtl" className="input-field" value={value.imageAltAr || ''} maxLength={120} onChange={e => onChange({ imageAltAr: e.target.value })} /></div>
        </div>
      )}
    </div>
  );
}
