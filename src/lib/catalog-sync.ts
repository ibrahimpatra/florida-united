/**
 * Keeps product pages and lists fresh WITHOUT reading the database on every visit.
 *  - Pages are cached for a long time (ISR) and refreshed only when something changes: a product goes out of stock, comes back, or an admin edits it.
 *  - The product list is held in server memory; a tiny marker document (config/catalog) tells other server instances to drop it. Each instance looks at that
 *    marker at most every 20 seconds (1 read), instead of re-reading every product.
 */
import { getAdminDb } from './firebase-admin';
import { keepAlive } from './bg';

const sleep = (ms: number) => new Promise<void>(r => { const t: any = setTimeout(r, ms); t?.unref?.(); });

export interface CatalogEntry { ids?: string[]; cats?: boolean; full?: boolean }
const MAX_IDS = 150;      // more changed products than this: just say "everything" (cheaper than a huge marker)

/**
 * The marker keeps a short history of WHAT changed (product ids / categories), not only "something changed".
 * A server that is behind reads just those products (1 read each) instead of the whole catalogue.
 * A server that is too far behind (history trimmed) or sees a "full" entry reloads everything once.
 */
async function bump(e: CatalogEntry) {
  try {
    const db = getAdminDb(); const ref = db.collection('config').doc('catalog');
    await db.runTransaction(async (tx: any) => {
      const d: any = (await tx.get(ref)).data() || {};
      const prev = Number(d.v) || 0;
      const v = Math.max(Date.now(), prev + 1);
      let log: any[] = Array.isArray(d.log) ? d.log : [];
      let base = Number(d.base);
      if (!Number.isFinite(base)) base = prev;                     // older marker without history: anything before it needs a full reload
      const ids = Array.from(new Set(e.ids || []));
      log = [...log, { v, ids: e.full || ids.length > MAX_IDS ? [] : ids, cats: !!e.cats, full: !!e.full || ids.length > MAX_IDS }];
      while (log.length > 40) { base = Number(log[0].v) || base; log = log.slice(1); }
      tx.set(ref, { v, base, log });
    });
  } catch { /* instances still refresh on their own after 10 minutes */ }
}

/** Call after stock or a product changed. Pass ids for the products that changed (their pages are refreshed); no ids = all product pages. Never throws. */
export function catalogChanged(ids: string[] = [], opts: { delayMs?: number; cats?: boolean; full?: boolean } = {}) {
  return keepAlive((async () => {
    await sleep(opts.delayMs ?? 1500);                // let the database write that triggered this finish first
    const entry: CatalogEntry = { ids, cats: opts.cats, full: opts.full || (!ids.length && !opts.cats) };
    const fe = await import('./firestore-admin'); fe.invalidateProductCache(true, entry);
    await bump(entry);
    let cache: typeof import('next/cache') | null = null;
    try { cache = await import('next/cache'); } catch { return; }
    try {
      // bundle pages take their stock from the parts, so they are refreshed whenever any product's stock flips
      for (const base of ['/shop/bundles/[slug]', '/ar/shop/bundles/[slug]']) cache.revalidatePath(base, 'page');
      if (!ids.length) { for (const base of ['/shop/products/[slug]', '/ar/shop/products/[slug]']) cache.revalidatePath(base, 'page'); return; }
      const db = getAdminDb();
      const snaps = await db.getAll(...ids.slice(0, 50).map(id => db.collection('products').doc(id)));
      for (const s of snaps) {
        const slug = s.exists ? String((s.data() as any)?.slug || '') : '';
        if (slug) { cache.revalidatePath(`/shop/products/${slug}`); cache.revalidatePath(`/ar/shop/products/${slug}`); }
      }
    } catch { /* outside Next (tests) or revalidation unavailable: the hourly refresh still applies */ }
  })());
}
