'use client';
import { useRef, useState } from 'react';
import { Palette, Upload, Download, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { colourScale, isHex, DEFAULT_BRAND_COLOR, DEFAULT_ACCENT_COLOR, THEME_KEYS } from '@/lib/brand';
import { TranslateButton } from '@/components/admin/TranslateButton';

/** Presets a client can start from. Brand = main colour (buttons, header, links). Accent = highlight colour (always used with dark text). */
const PRESETS: { name: string; brand: string; accent: string }[] = [
  { name: 'Slate & amber (default)', brand: '#234b63', accent: '#f5b800' },
  { name: 'Forest',  brand: '#1f5c46', accent: '#e8b84a' },
  { name: 'Terracotta', brand: '#8c3f2b', accent: '#f0c987' },
  { name: 'Navy',    brand: '#1d3a6b', accent: '#f4a62a' },
  { name: 'Plum',    brand: '#5b2f66', accent: '#f2c14e' },
  { name: 'Graphite', brand: '#2f3a42', accent: '#7ed0c4' },
];

type Vals = { storeName: string; storeNameAr: string; tagline: string; taglineAr: string; logoUrl: string; faviconUrl: string; brandColor: string; accentColor: string };

function ColourField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  const ok = isHex(value);
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={ok ? value : '#000000'} onChange={e => onChange(e.target.value)} className="h-10 w-12 rounded-lg border border-gray-200 bg-white p-1 cursor-pointer" />
        <input value={value} onChange={e => onChange(e.target.value.trim())} maxLength={7} className={`input-field font-mono w-32 ${ok ? '' : 'border-red-300'}`} placeholder="#234b63" />
      </div>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

function ImageField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', f); fd.append('folder', 'brand');
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d.error || 'Upload failed');
      onChange(d.url);
    } catch (e: any) { toast.error(e.message || 'Upload failed'); }
    setBusy(false);
  };
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-gray-400">none</span>}
        </div>
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-secondary py-2 px-3 text-sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{value ? 'Replace' : 'Upload'}
        </button>
        {value && <button type="button" onClick={() => onChange('')} className="text-xs text-gray-500 hover:text-red-600">Remove</button>}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

/** Module level on purpose (components defined inside another component remount on every keystroke and steal focus). */
export function BrandThemeSection({ values, onChange }: { values: Vals; onChange: (patch: Partial<Vals>) => void }) {
  const brand = isHex(values.brandColor) ? values.brandColor : DEFAULT_BRAND_COLOR;
  const accent = isHex(values.accentColor) ? values.accentColor : DEFAULT_ACCENT_COLOR;
  const bs = colourScale(brand, 600), as = colourScale(accent, 500);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportTheme = () => {
    const out: Record<string, string> = { _format: 'storefront-theme-v1' };
    for (const k of THEME_KEYS) out[k] = (values as any)[k] || '';
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `theme-${(values.storeName || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importTheme = async (f?: File) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j._format !== 'storefront-theme-v1') throw new Error('This is not a theme file exported from this admin.');
      const patch: Partial<Vals> = {};
      for (const k of THEME_KEYS) if (typeof j[k] === 'string') (patch as any)[k] = j[k];
      if (patch.brandColor && !isHex(patch.brandColor)) delete patch.brandColor;
      if (patch.accentColor && !isHex(patch.accentColor)) delete patch.accentColor;
      onChange(patch);
      toast.success('Theme loaded. Press Save All to apply it.');
    } catch (e: any) { toast.error(e.message || 'Could not read that file.'); }
  };

  return (
    <div className="card p-6 mb-5">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-base"><Palette className="w-5 h-5 text-brand-600" />Brand & theme</h3>
        <div className="flex gap-2">
          <button type="button" onClick={exportTheme} className="btn-secondary py-1.5 px-3 text-xs"><Download className="w-3.5 h-3.5" />Export theme</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary py-1.5 px-3 text-xs"><Upload className="w-3.5 h-3.5" />Import theme</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { importTheme(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Company name</label><input className="input-field" value={values.storeName} onChange={e => onChange({ storeName: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Browser tab, header, footer, emails, invoices, WhatsApp and the assistant all use this.</p></div>
          <div><label className="label">Company name (Arabic)</label><input dir="rtl" className="input-field" value={values.storeNameAr} onChange={e => onChange({ storeNameAr: e.target.value })} /></div>
          <div><label className="label">Tagline</label><input className="input-field" value={values.tagline} onChange={e => onChange({ tagline: e.target.value })} /></div>
          <div><label className="label">Tagline (Arabic)</label><input dir="rtl" className="input-field" value={values.taglineAr} onChange={e => onChange({ taglineAr: e.target.value })} /></div>
        </div>
        <TranslateButton context="company name and tagline" fields={[
          { en: values.storeName, ar: values.storeNameAr, set: v => onChange({ storeNameAr: v }) },
          { en: values.tagline, ar: values.taglineAr, set: v => onChange({ taglineAr: v }) },
        ]} />

        <div className="grid sm:grid-cols-2 gap-4">
          <ImageField label="Logo" value={values.logoUrl} onChange={v => onChange({ logoUrl: v })} hint="Square or wide PNG/WebP with a transparent background. Replaces the initials in the header." />
          <ImageField label="Browser tab icon (favicon)" value={values.faviconUrl} onChange={v => onChange({ faviconUrl: v })} hint="Square PNG, at least 64 x 64 px." />
        </div>

        <div>
          <p className="label mb-2">Start from a preset</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.name} type="button" onClick={() => onChange({ brandColor: p.brand, accentColor: p.accent })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400 text-xs text-gray-700 bg-white">
                <span className="flex"><span className="w-4 h-4 rounded-l-full" style={{ background: p.brand }} /><span className="w-4 h-4 rounded-r-full" style={{ background: p.accent }} /></span>{p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <ColourField label="Main colour" value={values.brandColor} onChange={v => onChange({ brandColor: v })} hint="Header, buttons, links. Pick a mid-dark colour so white text stays readable." />
          <ColourField label="Highlight colour" value={values.accentColor} onChange={v => onChange({ accentColor: v })} hint="Badges and highlights. Pick a light colour: it always carries dark text." />
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3 text-white" style={{ background: bs[700] }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: bs[600] }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {values.logoUrl ? <img src={values.logoUrl} alt="" className="max-w-full max-h-full object-contain p-0.5" /> : (values.storeName || 'S')[0]}
            </span>
            <span className="font-bold text-sm">{values.storeName || 'Your store'}</span>
          </div>
          <div className="p-4 bg-white flex flex-wrap items-center gap-3">
            <button type="button" className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: bs[600] }}>Add to cart</button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ color: bs[700], borderColor: bs[200], background: bs[50] }}>View details</button>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold" style={{ background: as[500], color: '#1c1917' }}>-20%</span>
            <a className="text-sm font-medium underline" style={{ color: bs[600] }}>Link colour</a>
          </div>
        </div>

        <button type="button" onClick={() => onChange({ brandColor: DEFAULT_BRAND_COLOR, accentColor: DEFAULT_ACCENT_COLOR })} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <RotateCcw className="w-3 h-3" />Reset colours to default
        </button>
      </div>
    </div>
  );
}
