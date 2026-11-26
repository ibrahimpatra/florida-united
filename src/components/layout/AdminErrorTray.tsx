'use client';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, X, Copy, Save, AlertTriangle } from 'lucide-react';
import { sendClientIssue } from './ClientIssueLogger';

/**
 * Admin-only error tray (fed by ClientIssueLogger when the server sends `adminDetail`).
 * - One line per error; the eye opens it, the cross removes it. Nothing disappears by itself.
 * - Same method + route + message = one line with a x N badge (full text is shown once, on open).
 * - Each line says what the admin was doing: the action from method + route, the page and the last button pressed.
 * - "Save to logs" writes one row to Admin > Issues with that context; "Close" removes it without saving.
 *   (Server errors are also saved there automatically, so Save only adds the "what I was doing" context.)
 */
export interface TrayItem { key: string; method: string; route: string; status: number; message: string; op: string; page: string; button: string; count: number; at: number; saved?: boolean }
const MAX_LINES = 3;
let items: TrayItem[] = []; const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
let lastButton = '';

const VERB: Record<string, string> = { POST: 'Creating / running', PUT: 'Saving', PATCH: 'Updating', DELETE: 'Deleting', GET: 'Loading' };
export function describeOperation(method: string, route: string) {
  const parts = route.replace(/^\/api\/(admin\/)?/, '').split('/').filter(Boolean).map(p => (/^[0-9a-f-]{12,}$/i.test(p) ? '(item)' : p.replace(/[-_]/g, ' ')));
  return `${VERB[method] || method}: ${parts.join(' › ') || route}`;
}
export function pushAdminError(e: { method: string; route: string; status: number; message: string }) {
  const key = `${e.method} ${e.route} ${e.message}`;
  const hit = items.find(i => i.key === key);
  if (hit) { items = items.map(i => (i === hit ? { ...i, count: i.count + 1, at: Date.now() } : i)); }
  else items = [{ key, ...e, op: describeOperation(e.method, e.route), page: location.pathname, button: lastButton, count: 1, at: Date.now() }, ...items];
  emit();
}
const details = (i: TrayItem) => `${i.op}\nRequest: ${i.method} ${i.route} -> ${i.status}\nPage: ${i.page}${i.button ? `\nLast button: "${i.button}"` : ''}\nTimes: ${i.count}\n\n${i.message}`;

export function AdminErrorTray() {
  const [, force] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    const f = () => force(n => n + 1); subs.add(f);
    const onClick = (ev: MouseEvent) => {
      const b = (ev.target as HTMLElement | null)?.closest?.('button,a,[role=button]') as HTMLElement | null;
      if (b && !b.closest('[data-error-tray]')) lastButton = (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    };
    document.addEventListener('click', onClick, true);
    return () => { subs.delete(f); document.removeEventListener('click', onClick, true); };
  }, []);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, MAX_LINES); const hidden = items.length - shown.length;
  const remove = (key: string) => { items = items.filter(i => i.key !== key); if (open === key) setOpen(null); emit(); };
  const save = (i: TrayItem) => { sendClientIssue('admin-tray', `${i.op} | ${i.method} ${i.route} ${i.status} | button "${i.button || '-'}" | x${i.count} | ${i.message}`); items = items.map(x => (x.key === i.key ? { ...x, saved: true } : x)); emit(); };
  return (
    <div data-error-tray className="fixed z-[70] inset-x-2 bottom-20 md:bottom-4 md:inset-x-auto md:end-4 md:w-[420px] space-y-1.5">
      {shown.map(i => {
        const isOpen = open === i.key;
        return (
          <div key={i.key} className="bg-white border border-red-200 shadow-lg rounded-xl overflow-hidden text-xs">
            <div className="flex items-center gap-2 px-3 h-10">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="truncate flex-1 font-semibold text-gray-800">{i.op}</span>
              {i.count > 1 && <span className="shrink-0 min-w-[22px] text-center rounded-full bg-red-600 text-white font-bold px-1.5 py-0.5">×{i.count}</span>}
              <button aria-label={isOpen ? 'Hide details' : 'Show details'} onClick={() => setOpen(isOpen ? null : i.key)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-gray-100">{isOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              <button aria-label="Dismiss" onClick={() => remove(i.key)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            {isOpen && (
              <div className="border-t border-red-100 p-3 space-y-2 max-h-[50vh] overflow-auto">
                <p className="text-gray-500">{i.method} {i.route} · {i.status} · on {i.page}{i.button && <> · after pressing “{i.button}”</>}</p>
                <p className="whitespace-pre-wrap break-words text-gray-900 bg-red-50 rounded-lg p-2">{i.message}</p>
                <div className="flex gap-2 flex-wrap">
                  <button disabled={i.saved} onClick={() => save(i)} className="btn-primary !h-9 !px-3 text-xs flex items-center gap-1 disabled:opacity-60"><Save className="w-3.5 h-3.5" />{i.saved ? 'Saved to logs' : 'Save to logs'}</button>
                  <button onClick={() => remove(i.key)} className="btn-secondary !h-9 !px-3 text-xs">Close</button>
                  <button onClick={() => { try { navigator.clipboard.writeText(details(i)); } catch {} }} className="btn-secondary !h-9 !px-3 text-xs flex items-center gap-1"><Copy className="w-3.5 h-3.5" />Copy details</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {(hidden > 0 || all) && <button onClick={() => setAll(a => !a)} className="w-full text-center text-xs font-semibold bg-white/95 border border-red-200 rounded-lg py-1.5 shadow">{all ? 'Show fewer' : `+${hidden} more`}</button>}
    </div>
  );
}
