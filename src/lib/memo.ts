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

/**
 * Small shared settings that every page needs (store settings, shipping zones, banners, popups, promo tiles, loyalty rules, deals).
 * Read once per `ttlMs` on each server instead of on every page view. The key includes which database object was used, so tests
 * (and a changed connection) never see another database's copy. Any successful admin change clears them all (dropCfg, called by withLog).
 */
const ids = new WeakMap<object, number>(); let nextId = 1;
const dbId = (db: object) => { let i = ids.get(db); if (!i) { i = nextId++; ids.set(db, i); } return i; };
export const cfgMemo = <T>(db: object, key: string, ttlMs: number, fn: () => Promise<T>) => memo(`cfg:${dbId(db)}:${key}`, ttlMs, fn);
export const dropCfg = () => dropMemo('cfg:');
