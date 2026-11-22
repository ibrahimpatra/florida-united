'use client';
import { Minus, Plus, Trash2 } from 'lucide-react';

/** - 1 + control. At 1, the minus becomes a bin (removes the line). Plus stops at the stock level. */
export function QtyStepper({ qty, max, onChange, size = 'md', stop }: { qty: number; max: number; onChange: (q: number) => void; size?: 'sm' | 'md'; stop?: boolean }) {
  const b = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const guard = (e: React.MouseEvent) => { if (stop) { e.preventDefault(); e.stopPropagation(); } };
  return (
    <div className="inline-flex items-center gap-1.5" onClick={guard}>
      <button type="button" aria-label="Decrease quantity" onClick={e => { guard(e); onChange(qty - 1); }}
        className={`${b} rounded-lg border border-gray-200 hover:border-brand-400 hover:text-brand-700 flex items-center justify-center bg-white`}>
        {qty <= 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
      </button>
      <span className="min-w-[1.75rem] text-center text-sm font-bold tabular-nums">{qty}</span>
      <button type="button" aria-label="Increase quantity" disabled={qty >= max} onClick={e => { guard(e); onChange(qty + 1); }}
        className={`${b} rounded-lg border border-gray-200 hover:border-brand-400 hover:text-brand-700 flex items-center justify-center bg-white disabled:opacity-40`}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
