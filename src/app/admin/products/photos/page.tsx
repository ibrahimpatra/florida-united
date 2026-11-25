'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ImagePlus, Loader2, CheckCircle, XCircle, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cachedJson } from '@/lib/client-cache';
import { uploadImage } from '@/lib/client-upload';
import { matchFileToSku } from '@/lib/photo-match';

interface Prod { id: string; sku: string; name: string; images: string[] }
interface Item { key: string; file: File; url: string; sku?: string; order: number; prod?: Prod }
type Done = Record<string, 'ok' | string>;   // product id -> 'ok' or an error

export default function BulkPhotosPage() {
  const [prods, setProds] = useState<Prod[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [done, setDone] = useState<Done>({});
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { cachedJson<Prod[]>('/api/admin/products/skus', { ttlMs: 120_000 }).then(d => setProds(Array.isArray(d) ? d : [])).catch(() => toast.error('Could not load products')); }, []);
  const skuMap = useMemo(() => new Map(prods.filter(p => p.sku).map(p => [p.sku.trim().toLowerCase(), p.sku])), [prods]);
  const bySku = useMemo(() => new Map(prods.map(p => [p.sku, p])), [prods]);

  const add = (files: FileList | File[]) => {
    const list = [...files].filter(f => /^image\/(jpeg|png|webp|gif)$/i.test(f.type));
    if (!list.length) return toast.error('Choose JPG, PNG or WebP pictures');
    setDone({});
    setItems(cur => {
      const seen = new Set(cur.map(i => i.key));
      const next = list.filter(f => !seen.has(`${f.name}:${f.size}`)).map(f => {
        const m = matchFileToSku(f.name, skuMap);
        return { key: `${f.name}:${f.size}`, file: f, url: URL.createObjectURL(f), sku: m?.sku, order: m?.order ?? 1, prod: m ? bySku.get(m.sku) : undefined } as Item;
      });
      return [...cur, ...next];
    });
  };
  // once the product list arrives, match files that were dropped before it loaded
  useEffect(() => { setItems(cur => cur.map(i => { if (i.prod) return i; const m = matchFileToSku(i.file.name, skuMap); return m ? { ...i, sku: m.sku, order: m.order, prod: bySku.get(m.sku) } : i; })); }, [skuMap, bySku]);

  const remove = (key: string) => setItems(cur => { const g = cur.find(i => i.key === key); if (g) URL.revokeObjectURL(g.url); return cur.filter(i => i.key !== key); });
  const clear = () => { items.forEach(i => URL.revokeObjectURL(i.url)); setItems([]); setDone({}); };

  const matched = items.filter(i => i.prod);
  const unmatched = items.filter(i => !i.prod);
  const groups = useMemo(() => { const g = new Map<string, Item[]>(); matched.forEach(i => g.set(i.prod!.id, [...(g.get(i.prod!.id) || []), i])); g.forEach(v => v.sort((a, b) => a.order - b.order || a.file.name.localeCompare(b.file.name))); return g; }, [matched]);

  const start = async () => {
    if (!groups.size || busy) return;
    setBusy(true); setDone({}); setProgress({ done: 0, total: matched.length });
    const queue = [...groups.entries()]; let finished = 0; const out: Done = {};
    const worker = async () => {
      for (;;) {
        const next = queue.shift(); if (!next) return;
        const [id, files] = next; const prod = files[0].prod!;
        try {
          const urls: string[] = [];
          for (const f of files) { urls.push(await uploadImage(f.file, { folder: 'products', name: prod.sku, maxSide: 1600 })); finished++; setProgress({ done: finished, total: matched.length }); }
          const images = mode === 'replace' ? urls : [...prod.images, ...urls];
          const r = await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images }) });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save the product');
          out[id] = 'ok';
        } catch (e: any) { finished += files.length; setProgress({ done: Math.min(finished, matched.length), total: matched.length }); out[id] = e?.message || 'Failed'; }
        setDone({ ...out });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy(false);
    const ok = Object.values(out).filter(v => v === 'ok').length;
    toast.success(`${ok} product${ok === 1 ? '' : 's'} updated${ok < groups.size ? `, ${groups.size - ok} failed` : ''}`);
    cachedJson('/api/admin/products/skus', { ttlMs: 0, force: true }).then(d => setProds(Array.isArray(d) ? d : [])).catch(() => {});
  };

  return (
    <div className="p-3 lg:p-5 max-w-5xl">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"><ArrowLeft className="w-4 h-4 rtl:rotate-180" />Products</Link>
      <h1 className="text-lg lg:text-xl font-bold text-gray-900 font-display">Bulk photo upload</h1>
      <p className="text-gray-500 text-sm mb-3">Name each picture after the product SKU: <span className="font-mono text-gray-700">LED-50W.jpg</span> is the first picture, <span className="font-mono text-gray-700">LED-50W-2.jpg</span> the second, and so on. Pictures are shrunk, converted to WebP and stored on your own storage.</p>

      <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        className={`card border-2 border-dashed cursor-pointer text-center py-8 px-4 transition-colors ${drag ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
        <ImagePlus className="w-8 h-8 mx-auto text-gray-300 mb-1.5" />
        <p className="font-semibold text-gray-700 text-sm">Drop pictures here, or tap to choose</p>
        <p className="text-xs text-gray-400">JPG, PNG or WebP. You can pick hundreds at once.</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={e => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
      </div>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 my-3">
            <p className="text-sm"><b className="text-green-700">{matched.length}</b> matched to <b>{groups.size}</b> product{groups.size === 1 ? '' : 's'}{unmatched.length > 0 && <>, <b className="text-red-600">{unmatched.length}</b> without a match</>}</p>
            <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white text-xs ms-auto" role="group" aria-label="What to do with existing pictures">
              <button onClick={() => setMode('add')} className={`px-3 py-1.5 ${mode === 'add' ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-500'}`}>Add after existing</button>
              <button onClick={() => setMode('replace')} className={`px-3 py-1.5 border-s border-gray-200 ${mode === 'replace' ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-500'}`}>Replace existing</button>
            </div>
            <button onClick={clear} disabled={busy} className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-40">Clear</button>
            <button onClick={start} disabled={busy || !groups.size} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{busy ? `Uploading ${progress.done}/${progress.total}` : `Upload ${matched.length} picture${matched.length === 1 ? '' : 's'}`}
            </button>
          </div>
          {mode === 'replace' && <p className="text-xs text-amber-700 mb-2">Replace removes each product&apos;s current pictures from the product (the old files stay in storage).</p>}

          {unmatched.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-2.5 mb-3">
              <p className="text-sm font-semibold text-red-700 mb-1.5">No product has a SKU that matches these files. They will be skipped.</p>
              <div className="flex flex-wrap gap-1.5">{unmatched.map(i => <span key={i.key} className="inline-flex items-center gap-1 bg-white border border-red-100 rounded-lg ps-2 pe-1 py-0.5 text-xs font-mono text-red-700">{i.file.name}<button onClick={() => remove(i.key)} aria-label="Remove" className="p-0.5 hover:bg-red-50 rounded"><X className="w-3 h-3" /></button></span>)}</div>
            </div>
          )}

          <div className="space-y-2">
            {[...groups.entries()].map(([id, files]) => {
              const p = files[0].prod!; const st = done[id];
              return (
                <div key={id} className="card p-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-semibold text-sm text-gray-800 truncate">{p.name}</p><span className="text-xs font-mono text-gray-400">{p.sku}</span>
                    <span className="text-xs text-gray-400 ms-auto whitespace-nowrap">{p.images.length} now</span>
                    {st === 'ok' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {st && st !== 'ok' && <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="w-4 h-4" />{st}</span>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {files.map(i => (
                      <div key={i.key} className="relative w-16">
                        <img src={i.url} alt={i.file.name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                        <span className="absolute top-0.5 start-0.5 bg-black/60 text-white text-[10px] rounded px-1">{i.order}</span>
                        {!busy && <button onClick={() => remove(i.key)} aria-label="Remove" className="absolute -top-1 -end-1 bg-white border border-gray-200 rounded-full p-0.5 shadow-soft"><X className="w-3 h-3 text-gray-500" /></button>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
