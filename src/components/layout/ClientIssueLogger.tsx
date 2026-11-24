'use client';
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';

/**
 * Browser console: prints only problems - uncaught errors, unhandled promise rejections and failed /api calls
 * (HTTP 400+ or no response), each with the method, URL and the server's error text.
 * Open DevTools > Console and filter by "[app]".
 */
const sent = new Set<string>();
/** Sends a browser-side technical problem to Admin > Issues. At most 5 different ones per page load; never throws. */
export function sendClientIssue(area: string, message: string) {
  try {
    const m = String(message || '').slice(0, 300); const key = area + m;
    if (!m || sent.has(key) || sent.size >= 5) return; sent.add(key);
    // ResizeObserver / extension noise is not our bug
    if (/ResizeObserver|Script error|chrome-extension|moz-extension|Non-Error promise rejection/i.test(m)) return;
    const body = JSON.stringify({ area, message: m, page: location.pathname });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/client-issue', new Blob([body], { type: 'application/json' }));
    else fetch('/api/client-issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* reporting must never break the page */ }
}

export function ClientIssueLogger() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => { console.error('[app] uncaught error:', e.message, e.filename ? `${e.filename}:${e.lineno}` : ''); sendClientIssue('error', `${e.message} ${e.filename ? `(${e.filename.split('/').pop()}:${e.lineno})` : ''}`); }
    const onRej = (e: PromiseRejectionEvent) => { const r = (e.reason && (e.reason.message || e.reason)) || e.reason; console.error('[app] unhandled promise rejection:', r); sendClientIssue('promise', String(r)); }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRej);

    const w = window as any;
    if (!w.__fkFetchPatched) {
      w.__fkFetchPatched = true;
      const orig = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'GET')).toUpperCase();
        const isApi = url.startsWith('/api/') || url.includes(`${location.origin}/api/`);
        const t0 = performance.now();
        try {
          const res = await orig(input as any, init);
          if (isApi && res.status >= 400) {
            let text = '';
            try { text = (await res.clone().text()).slice(0, 300); } catch {}
            console.warn(`[app] ${method} ${url} -> ${res.status} (${Math.round(performance.now() - t0)}ms)`, text);
            // The server only adds `adminDetail` for signed-in admins, so shoppers never see this.
            try {
              const j = await res.clone().json();
              if (j?.adminDetail && !url.includes('/api/popups/') && !url.includes('/api/admin/issues')) {
                const msg = `[admin only] ${method} ${url.replace(location.origin, '').split('?')[0]} ${res.status}: ${j.adminDetail}`;
                if (w.__fkLastAdminToast !== msg) { w.__fkLastAdminToast = msg; setTimeout(() => { w.__fkLastAdminToast = ''; }, 5000); toast.error(msg, { duration: 9000, style: { fontSize: '12px', maxWidth: '480px', wordBreak: 'break-word' } }); }
              }
            } catch { /* not JSON */ }
          }
          return res;
        } catch (err: any) {
          if (isApi) { console.error(`[app] ${method} ${url} failed - no response (network or server down):`, err?.message || err); if (!url.includes('/api/client-issue') && navigator.onLine) sendClientIssue('network', `${method} ${url.replace(location.origin, '').split('?')[0]} got no response`); }
          throw err;
        }
      };
    }
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRej); };
  }, []);
  return null;
}
