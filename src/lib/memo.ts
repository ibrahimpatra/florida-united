/**
 * Tiny per-server memory for storefront reads that are the same for every visitor (active bundles, running deals, ...).
 * Each key is read from the database at most once per `ttlMs`, and concurrent requests share one read.
 * Writers call dropMemo(prefix) so changes made on the same server show at once; other servers catch up within the TTL.
 */
const store = new Map<string, { at: number; v: any }>();
const flight = new Map<string, Promise<any>>();

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const f = flight.get(key); if (f) return f as Promise<T>;
  const p = fn().then(v => { store.set(key, { at: Date.now(), v }); return v; }).finally(() => flight.delete(key));
  flight.set(key, p);
  return p;
}
export function dropMemo(prefix: string) { for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k); }
