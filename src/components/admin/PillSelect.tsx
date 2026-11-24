'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Loader2, ChevronDown } from 'lucide-react';

export interface PillOption { id: string; label: string; sub?: string }

/**
 * One-to-one picker, Odoo style: the choice shows as a single pill; click the x to change it.
 * While empty, type to search the list. If nothing matches, "Create <text>" adds it right here (onCreate) and picks it.
 */
export function PillSelect({ value, options, onChange, onCreate, placeholder, disabled, hint }: {
  value: string | null; options: PillOption[]; onChange: (id: string | null) => void;
  onCreate?: (name: string) => Promise<PillOption | null>; placeholder?: string; disabled?: boolean; hint?: string;
}) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const chosen = options.find(o => o.id === value);
  const needle = q.trim().toLowerCase();
  const list = useMemo(() => (needle ? options.filter(o => `${o.label} ${o.sub || ''}`.toLowerCase().includes(needle)) : options).slice(0, 50), [options, needle]);
  const exact = !!needle && options.some(o => o.label.toLowerCase() === needle);
  const canCreate = !!onCreate && !!needle && !exact;
  useEffect(() => setHi(0), [needle]);

  const pick = (id: string) => { onChange(id); setQ(''); setOpen(false); };
  const create = async () => {
    if (!onCreate || busy) return; setBusy(true);
    try { const o = await onCreate(q.trim()); if (o) pick(o.id); } finally { setBusy(false); }
  };
  if (value && !chosen && !options.length) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /></span>;
  if (value) return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-800 ps-3.5 pe-1.5 py-1.5 text-sm font-semibold ${disabled ? 'opacity-60' : ''}`}>
      {chosen?.label || value}
      <button type="button" disabled={disabled} onClick={() => onChange(null)} aria-label="Change" className="w-5 h-5 rounded-full bg-brand-100 hover:bg-brand-200 flex items-center justify-center"><X className="w-3 h-3" /></button>
    </span>
  );
  return (
    <div ref={box} className="relative">
      <div className="relative">
        <input value={q} disabled={disabled} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, list.length - (canCreate ? 0 : 1))); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (hi < list.length && list[hi]) pick(list[hi].id); else if (canCreate) create(); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder} className="input-field pe-9" autoComplete="off" />
        <ChevronDown className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 end-3 pointer-events-none" />
      </div>
      {hint && !open && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {open && !disabled && (list.length > 0 || canCreate) && (
        <ul className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1">
          {list.map((o, i) => (
            <li key={o.id}><button type="button" onMouseEnter={() => setHi(i)} onClick={() => pick(o.id)} className={`w-full text-start px-3 py-2 text-sm ${i === hi ? 'bg-brand-50' : ''}`}>{o.label}{o.sub && <span className="text-xs text-gray-400 ms-2">{o.sub}</span>}</button></li>
          ))}
          {canCreate && (
            <li><button type="button" onClick={create} onMouseEnter={() => setHi(list.length)} className={`w-full text-start px-3 py-2 text-sm font-semibold text-brand-700 flex items-center gap-2 ${hi === list.length ? 'bg-brand-50' : ''}`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Create &quot;{q.trim()}&quot;
            </button></li>
          )}
        </ul>
      )}
    </div>
  );
}
