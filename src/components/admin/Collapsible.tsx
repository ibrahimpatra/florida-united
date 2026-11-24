'use client';
import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** A card section that starts closed. Used for the optional parts of long admin forms. */
export function Collapsible({ title, hint, defaultOpen = false, children }: { title: string; hint?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-start">
        <span><span className="font-bold text-gray-800 block">{title}</span>{hint && <span className="text-xs text-gray-500 font-normal">{hint}</span>}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 sm:px-5 pb-5 -mt-1">{children}</div>}
    </div>
  );
}
