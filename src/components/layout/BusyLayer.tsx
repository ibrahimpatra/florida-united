'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface Ctx { start: (label?: string) => () => void; run: <T>(label: string, fn: () => Promise<T>) => Promise<T>; }
const BusyCtx = createContext<Ctx>({ start: () => () => {}, run: async (_l, fn) => fn() });
export const useBusy = () => useContext(BusyCtx);

/**
 * A grey full-screen layer with a spinner for IMPORTANT actions only (placing an order, saving a product, changing an order status, imports).
 * Small actions (add to cart, like) keep their own button state. The layer clears itself when the page changes, and after 90 s as a safety net.
 */
export function BusyProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<{ id: number; label: string }[]>([]);
  const seq = useRef(0);
  const path = usePathname();
  const stop = useCallback((id: number) => setLabels(l => l.filter(x => x.id !== id)), []);
  const start = useCallback((label = '') => {
    const id = ++seq.current; setLabels(l => [...l, { id, label }]);
    const t = setTimeout(() => stop(id), 90_000);
    return () => { clearTimeout(t); stop(id); };
  }, [stop]);
  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>) => { const done = start(label); try { return await fn(); } finally { done(); } }, [start]);
  useEffect(() => { setLabels([]); }, [path]);   // arrived on the next page: lift the layer
  const label = labels[labels.length - 1]?.label;
  return (
    <BusyCtx.Provider value={{ start, run }}>
      {children}
      {labels.length > 0 && (
        <div className="fixed inset-0 z-[200] bg-gray-900/50 backdrop-blur-[1px] flex items-center justify-center" role="status" aria-live="polite" aria-busy="true">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-5 flex flex-col items-center gap-3 min-w-[160px]">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
            {label && <p className="text-sm font-semibold text-gray-700 text-center">{label}</p>}
          </div>
        </div>
      )}
    </BusyCtx.Provider>
  );
}
