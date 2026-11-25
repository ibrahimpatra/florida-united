'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cachedJson } from '@/lib/client-cache';
import { Search, X, Package, FolderTree, Check, Loader2 } from 'lucide-react';

/**
 * Odoo-style search selector for admin forms. Type to find, arrow keys + Enter (or click) to pick,
 * chips show what is chosen. Use it wherever a form needs to point at a product or a category:
 *   <EntityPicker kind="product" multiple value={ids} onChange={setIds} />
 *   <EntityPicker kind="category" value={[id]} onChange={a => setId(a[0] || '')} />
 * Category choices show their full path ("Electrical > Cables") so sub-categories are easy to tell apart.
 */
type Kind = 'product' | 'category';
export interface PickItem { id: string; label: string; sub?: string; image?: string; parentId?: string }

const cache: Record<Kind, Map<string, PickItem>> = { product: new Map(), category: new Map() };
let catsPromise: Promise<PickItem[]> | null = null;

function loadCategories(): Promise<PickItem[]> {
  catsPromise ??= cachedJson<any[]>('/api/categories?admin=1').then((list: any[]) => {
    const byId = new Map(list.map(c => [c.id, c]));
    const path = (c: any): string => (c.parentId && byId.get(c.parentId) ? `${path(byId.get(c.parentId))} > ${c.name}` : c.name);
    const items = (Array.isArray(list) ? list : []).map(c => ({ id: c.id, label: path(c), sub: c.nameAr || undefined, parentId: c.parentId || undefined }));
    items.sort((a, b) => a.label.localeCompare(b.label));
    items.forEach(i => cache.category.set(i.id, i));
    return items;
  }).catch(() => { catsPromise = null; return []; });
  return catsPromise;
}
const prodItem = (p: any): PickItem => ({ id: p.id, label: p.isBundle ? `${p.name} (bundle)` : p.name, sub: [p.isBundle ? 'Bundle' : p.sku, p.nameAr].filter(Boolean).join('  ·  '), image: p.image });

/** All descendants of a category id, from the loaded category list. */
export async function categoryWithDescendants(id: string): Promise<string[]> {
  const all = await loadCategories();
  const out = [id]; let grew = true;
  while (grew) { grew = false; for (const c of all) if (c.parentId && out.includes(c.parentId) && !out.includes(c.id)) { out.push(c.id); grew = true; } }
  return out;
}

export function EntityPicker({ kind, value, onChange, multiple = false, placeholder, disabled, withBundles = false }: {
  withBundles?: boolean; kind: Kind; value: string[]; onChange: (ids: string[]) => void; multiple?: boolean; placeholder?: string; disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PickItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [hi, setHi] = useState(0);
  const [, bump] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // names for ids we have not seen yet (editing an existing deal)
  useEffect(() => {
    const missing = value.filter(id => !cache[kind].has(id));
    if (!missing.length) return;
    (kind === 'category' ? loadCategories().then(() => undefined)
      : fetch(`/api/products/search?ids=${encodeURIComponent(missing.join(','))}`).then(r => r.json()).then((l: any[]) => { (Array.isArray(l) ? l : []).forEach(p => cache.product.set(p.id, prodItem(p))); }))
      .catch(() => {}).finally(() => bump(n => n + 1));
  }, [value, kind]);

  // search as you type (products: server, debounced; categories: in memory)
  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    if (kind === 'category') {
      setBusy(true);
      loadCategories().then(all => { if (my !== seq.current) return; const t = q.trim().toLowerCase(); setResults(all.filter(c => !t || c.label.toLowerCase().includes(t) || (c.sub || '').includes(q.trim())).slice(0, 40)); setBusy(false); setHi(0); });
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      fetch(`/api/products/search?q=${encodeURIComponent(q.trim())}&limit=12${withBundles ? '&bundles=1' : ''}`).then(r => r.json()).then((l: any[]) => {
        if (my !== seq.current) return;
        const items = (Array.isArray(l) ? l : []).map(prodItem); items.forEach(i => cache.product.set(i.id, i));
        setResults(items); setHi(0);
      }).catch(() => setResults([])).finally(() => { if (my === seq.current) setBusy(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, kind, withBundles]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away); return () => document.removeEventListener('mousedown', away);
  }, []);

  const pick = (it: PickItem) => {
    cache[kind].set(it.id, it);
    if (multiple) onChange(value.includes(it.id) ? value.filter(x => x !== it.id) : [...value, it.id]);
    else { onChange([it.id]); setOpen(false); }
    setQ('');
  };
  const chosen = useMemo(() => value.map(id => cache[kind].get(id) || { id, label: id.slice(0, 8) + '…' }), [value, kind, results]); // eslint-disable-line react-hooks/exhaustive-deps
  const Icon = kind === 'product' ? Package : FolderTree;

  return (
    <div ref={box} className="relative">
      <div className={`flex flex-wrap items-center gap-1.5 min-h-[42px] px-2 py-1.5 rounded-xl border bg-white ${open ? 'border-brand-500 ring-2 ring-brand-100' : 'border-gray-200'} ${disabled ? 'opacity-60' : ''}`}
        onClick={() => !disabled && setOpen(true)}>
        {chosen.map(c => (
          <span key={c.id} className="inline-flex items-center gap-1 max-w-full bg-brand-50 text-brand-800 border border-brand-100 rounded-lg ps-2 pe-1 py-0.5 text-xs font-medium">
            <Icon className="w-3 h-3 shrink-0" /><span className="truncate">{c.label}</span>
            <button type="button" aria-label="Remove" onClick={e => { e.stopPropagation(); onChange(value.filter(x => x !== c.id)); }} className="p-0.5 rounded hover:bg-brand-100"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input value={q} disabled={disabled} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (results[hi]) pick(results[hi]); }
            else if (e.key === 'Escape') setOpen(false);
            else if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1));
          }}
          placeholder={chosen.length && multiple ? 'Add more…' : (placeholder || (kind === 'product' ? 'Search by name, Arabic name or SKU…' : 'Search categories…'))}
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm py-1 px-1" />
        {busy ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" /> : <Search className="w-4 h-4 text-gray-400 shrink-0" />}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {!results.length && !busy && <p className="px-3 py-3 text-sm text-gray-500">{q ? 'No match. Try another word or the SKU.' : 'Start typing to search.'}</p>}
          {results.map((r, i) => {
            const on = value.includes(r.id);
            return (
              <button key={r.id} type="button" onMouseEnter={() => setHi(i)} onClick={() => pick(r)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-start ${i === hi ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                {kind === 'product' && (r.image ? <img src={r.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-100" /> : <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Package className="w-4 h-4 text-gray-400" /></span>)}
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-gray-900 truncate">{r.label}</span>{r.sub && <span className="block text-xs text-gray-500 truncate">{r.sub}</span>}</span>
                {on && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
