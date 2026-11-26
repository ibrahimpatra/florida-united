/**
 * App-wide server logger. Everything prints to the terminal where `npm run dev` / `npm start` runs.
 *
 *   LOG_LEVEL=debug|info|warn|error|silent   (default: warn = only problems, in dev and on Vercel)
 *   Set LOG_LEVEL=info (every request) or LOG_LEVEL=debug (requests + redacted bodies) when you need more.
 *
 * Secrets are never printed: passwords, tokens, keys, card data and image data are masked.
 */
import { reportIssue } from './issues';
import { reqStore, type ReqStore } from './request-context';
type Level = 'debug' | 'info' | 'warn' | 'error';
const RANK: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const COLOR: Record<Level, string> = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

const threshold = () => RANK[String(process.env.LOG_LEVEL || '').toLowerCase()] ?? RANK.warn;

const SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|private|api[-_]?key|card|cvc|cvv|dataurl|signature|hash/i;

/** Masks secret fields, shortens long strings, limits depth. Safe on any value. */
export function redact(v: any, depth = 0): any {
  if (v == null) return v;
  if (typeof v === 'string') return v.length > 200 ? `${v.slice(0, 200)}…(${v.length} chars)` : v;
  if (typeof v !== 'object') return v;
  if (v instanceof Error) return { name: v.name, message: v.message };
  if (typeof (v as any).toDate === 'function') { try { return (v as any).toDate().toISOString(); } catch { return '[date]'; } }
  if (depth > 4) return '[…]';
  if (Array.isArray(v)) return v.slice(0, 20).map(x => redact(x, depth + 1)).concat(v.length > 20 ? [`…+${v.length - 20} more`] : []);
  const out: any = {};
  for (const [k, val] of Object.entries(v)) out[k] = SECRET_KEY.test(k) ? '***' : redact(val, depth + 1);
  return out;
}

const ts = () => new Date().toISOString().slice(11, 23);

function emit(level: Level, scope: string, msg: string, data?: any) {
  // Every error-level log is a technical problem: save it to Admin > Issues too (grouped, throttled, finished after the response).
  if (level === 'error' && scope !== 'api' && scope !== 'firebase' && process.env.ISSUES_OFF !== '1') {   // 'firebase' is skipped: saving an issue needs the database, so it would loop
    let extra = ''; try { extra = data?.error ? ` - ${String(data.error?.message || data.error).slice(0, 200)}` : ''; } catch {}
    void reportIssue(scope, msg + extra, { method: 'LOG' });
  }
  if (RANK[level] < threshold()) return;
  const useColor = process.env.NODE_ENV !== 'production' && !process.env.NO_COLOR;
  const head = `${ts()} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`;
  let tail = '';
  if (data !== undefined) {
    try { tail = ' ' + JSON.stringify(redact(data)); } catch { tail = ' [unprintable]'; }
  }
  const line = useColor ? `${COLOR[level]}${head}${RESET}${tail}` : head + tail;
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const log = {
  debug: (scope: string, msg: string, data?: any) => emit('debug', scope, msg, data),
  info: (scope: string, msg: string, data?: any) => emit('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: any) => emit('warn', scope, msg, data),
  error: (scope: string, msg: string, data?: any) => emit('error', scope, msg, data),
  /** Short scoped logger: const l = log.scope('orders'); l.info('placed', {...}) */
  scope(scope: string) {
    return {
      debug: (m: string, d?: any) => emit('debug', scope, m, d),
      info: (m: string, d?: any) => emit('info', scope, m, d),
      warn: (m: string, d?: any) => emit('warn', scope, m, d),
      error: (m: string, d?: any) => emit('error', scope, m, d),
    };
  },
};

let seq = 0;

/** For admins only: the technical reason(s) collected during this request, or the response's own error text. */
async function adminDetailFor(req: Request | undefined): Promise<{ admin: boolean; email: string }> {
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('./auth')]);
    const session: any = await getServerSession(authOptions);
    return { admin: String(session?.user?.role || '').toLowerCase() === 'admin', email: session?.user?.email || '' };
  } catch { return { admin: false, email: '' }; }
}
const jsonResponse = (body: any, res: Response) => { const h = new Headers(res.headers); h.delete('content-length'); h.set('Content-Type', 'application/json'); return new Response(JSON.stringify(body), { status: res.status, headers: h }); };
/**
 * Wraps an API route handler: logs the request (method, path, query, redacted JSON body),
 * the response status and duration, error bodies, and turns uncaught exceptions into a logged 500.
 */
/** Saving anything here changes small shared settings that servers keep in memory (see cfgMemo in memo.ts). */
const CFG_PATH = /^\/api\/(admin|banners|popups|promo-tiles|settings|flash-deals|uoms|shipping\/(zones|config|rates)|loyalty\/settings|payments\/settings)/;

export function withLog<H extends (...args: any[]) => any>(method: string, path: string, handler: H): H {
  const wrapped = async (...args: any[]) => {
    const req = args[0] as Request | undefined;
    const id = (++seq).toString(36).padStart(3, '0');
    const t0 = Date.now();
    let q = '';
    try { q = req ? new URL(req.url).search : ''; } catch {}
    let body: any;
    if (RANK.debug >= threshold() && req && method !== 'GET' && (req.headers.get('content-type') || '').includes('application/json')) {
      try { body = await req.clone().json(); } catch {}
    }
    emit('info', 'api', `→ #${id} ${method} ${path}${q}`, body !== undefined ? { body } : undefined);
    const store: ReqStore = { notes: [] };
    try {
      let res: Response = await reqStore.run(store, () => handler(...args));
      try { (await import('./read-meter')).recordRoute(`${method} ${path}`, store.reads || 0); } catch { /* optional */ }
      const ms = Date.now() - t0;
      const status = (res as any)?.status ?? 200;
      if (method !== 'GET' && status < 400 && CFG_PATH.test(path)) { try { (await import('./memo')).dropCfg(); } catch { /* optional */ } }   // a saved admin change shows on this server at once
      if (status >= 400) {
        let text = '';
        try { text = (await res.clone().text()).slice(0, 300); } catch {}
        emit(status >= 500 ? 'error' : 'warn', 'api', `← #${id} ${method} ${path} ${status} ${ms}ms`, text ? { response: text } : undefined);
        // Admins get the technical reason inside the JSON error; every 5xx is also saved to Admin > Issues.
        if ((res.headers.get('content-type') || '').includes('application/json')) {
          let j: any = null; try { j = await res.clone().json(); } catch {}
          if (j && typeof j === 'object' && !Array.isArray(j) && ('error' in j || status >= 500)) {
            const who = await adminDetailFor(req);
            const reason = store.notes.filter(n => !n.includes('← #') && !n.includes('→ #')).slice(-3).join(' | ') || (typeof j.error === 'string' ? j.error : '');
            if (status >= 500) void reportIssue(path, reason || `HTTP ${status}`, { method, status, user: who.email });
            // Admin-only technical detail: only for real server errors, and only when it says something the public message does not.
            if (who.admin && status >= 500 && !j.adminDetail && reason && reason.trim() !== String(j.error || '').trim()) res = jsonResponse({ ...j, adminDetail: reason.slice(0, 500) }, res);
          }
        }
      } else emit('info', 'api', `← #${id} ${method} ${path} ${status} ${ms}ms`);
      return res;
    } catch (e: any) {
      // Next.js control-flow errors (static/dynamic detection, redirect(), notFound()) must reach Next untouched.
      const d = String(e?.digest || '');
      if (d === 'DYNAMIC_SERVER_USAGE' || d.startsWith('NEXT_') || e?.code === 'DYNAMIC_SERVER_USAGE' || /Dynamic server usage|Bail out/i.test(String(e?.message))) throw e;
      emit('error', 'api', `✖ #${id} ${method} ${path} threw after ${Date.now() - t0}ms: ${e?.message || e}`, { stack: String(e?.stack || '').split('\n').slice(0, 6) });
      const who = await adminDetailFor(req);
      void reportIssue(path, e, { method, status: 500, user: who.email });
      return new Response(JSON.stringify({ error: 'Something went wrong on our side. Please try again.', ...(who.admin ? { adminDetail: String(e?.message || e).slice(0, 500) } : {}) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  };
  return wrapped as unknown as H;
}
