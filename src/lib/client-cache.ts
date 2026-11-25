/**
 * Browser-side memory for lists that rarely change (categories, brands, ...).
 *  - the same list asked for by several components on one page is fetched once
 *  - it is also kept in sessionStorage, so a browser refresh or moving between pages does not download it again
 *  - `force` (the Refresh buttons, and right after the admin saves something) always asks the server and replaces the saved copy
 * The server answers from its own in-memory list, so even a forced fetch costs very few database reads.
 */
const mem = new Map<string, { at: number; data: any }>();
const flight = new Map<string, Promise<any>>();
const KEY = (u: string) => `fk-c:${u}`;

function readSession(u: string): { at: number; data: any } | null {
  try { const s = sessionStorage.getItem(KEY(u)); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function cachedJson<T = any>(url: string, opts: { ttlMs?: number; force?: boolean } = {}): Promise<T> {
  const ttl = opts.ttlMs ?? 5 * 60_000;
  if (!opts.force) {
    const m = mem.get(url) || (typeof window !== 'undefined' ? readSession(url) : null);
    if (m && Date.now() - m.at < ttl) { mem.set(url, m); return Promise.resolve(m.data as T); }
    const f = flight.get(url); if (f) return f;
  }
  const p = fetch(url, opts.force ? { cache: 'no-store' } : undefined).then(async r => {
    if (!r.ok) throw new Error(`${r.status}`);
    const data = await r.json(); const rec = { at: Date.now(), data };
    mem.set(url, rec); try { sessionStorage.setItem(KEY(url), JSON.stringify(rec)); } catch { /* storage full or blocked: memory copy still works */ }
    return data as T;
  }).finally(() => { flight.delete(url); });
  flight.set(url, p);
  return p;
}

/** Forget saved lists whose address starts with `prefix` (call after the admin creates, edits or deletes something). */
export function dropCached(prefix: string) {
  for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k);
  try { for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k && k.startsWith(KEY(prefix))) sessionStorage.removeItem(k); } } catch { /* ignore */ }
}
