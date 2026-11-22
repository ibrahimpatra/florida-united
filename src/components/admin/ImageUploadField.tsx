'use client';
import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Upload, X, Loader2 } from 'lucide-react';
import { uploadImage } from '@/lib/client-upload';

/** Upload-or-paste picture field with preview. Used for banners, categories, bundles, deals and promo tiles. */
export function ImageUploadField({ label, value, onChange, folder, name, maxSide, hint, wide }: {
  label: string; value: string; onChange: (url: string) => void; folder: 'banners' | 'categories' | 'bundles' | 'uploads' | 'products' | 'brand' | 'brands';
  name?: string; maxSide?: number; hint?: string; wide?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadImage(f, { folder, name, maxSide })); toast.success('Picture uploaded'); }
    catch (e: any) { toast.error(e?.message || 'Upload failed'); }
    setBusy(false);
    if (ref.current) ref.current.value = '';
  };
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-start gap-3">
        <div className={`${wide ? 'w-40 h-20' : 'w-20 h-20'} rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0 relative`}>
          {value ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={value} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange('')} aria-label="Remove picture" className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 shadow"><X className="w-3.5 h-3.5 text-red-600" /></button></>
            : <span className="text-[11px] text-gray-400">No picture</span>}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {busy ? 'Uploading…' : 'Upload picture'}
          </button>
          <input value={value} onChange={e => onChange(e.target.value)} className="input-field text-sm" placeholder="…or paste a picture link" />
          {hint && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
    </div>
  );
}
