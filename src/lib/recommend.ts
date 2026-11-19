/**
 * Automatic "you may also need" engine. Nothing is picked by hand: every score comes from data the store already has.
 *   1. bought together: products that appear in the same real orders as the product(s) being looked at
 *   2. same category / sub-category and same brand
 *   3. words the names share (a "13A plug" and a "13A socket" belong together even in different categories)
 *   4. price range (nobody wants a 40 KWD drill suggested next to a 0.5 KWD screw)
 *   5. popularity and rating as a gentle tie-breaker
 * The scoring is a pure function (testable); only loadPairCounts() touches the database.
 */
import { getAdminDb } from './firebase-admin';

const STOP = new Set(['the', 'and', 'for', 'with', 'pcs', 'pc', 'set', 'pack', 'new', 'size', 'type', 'kuwait', 'white', 'black', 'blue', 'red', 'big', 'small']);
export const tokens = (s: string): Set<string> => new Set(String(s || '').toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)));

export type Pairs = Map<string, Map<string, number>>; // productId -> (other productId -> times bought together)

export interface Rec { product: any; reason: 'frequently_bought_together' | 'compatible' | 'same_category' | 'similar_specs'; score: number }

export function scoreRecommendations(seeds: any[], candidates: any[], pairs: Pairs, limit = 8): Rec[] {
  if (!seeds.length) return [];
  const seedIds = new Set(seeds.map(s => s.id));
  const seedTok = seeds.map(s => tokens(`${s.name} ${(s.tags || []).join(' ')}`));
  const out: Rec[] = [];
  for (const c of candidates) {
    if (seedIds.has(c.id) || c.isActive === false || !(Number(c.stock) > 0)) continue;
    const cTok = tokens(`${c.name} ${(c.tags || []).join(' ')}`);
    let together = 0, sameCat = 0, sameBrand = 0, shared = 0, price = 0;
    seeds.forEach((s, i) => {
      together += pairs.get(s.id)?.get(c.id) || 0;
      if (s.categoryId && s.categoryId === c.categoryId) sameCat = 1;
      if (s.brand && c.brand && String(s.brand).toLowerCase() === String(c.brand).toLowerCase()) sameBrand = 1;
      const common = [...cTok].filter(w => seedTok[i].has(w)).length;
      shared = Math.max(shared, common / Math.max(2, Math.min(cTok.size, seedTok[i].size)));
      const ratio = (Number(c.price) || 0.001) / (Number(s.price) || 0.001);
      price = Math.max(price, ratio >= 0.4 && ratio <= 2.5 ? 1 : ratio >= 0.15 && ratio <= 6 ? 0.4 : 0);
    });
    const score = Math.min(together, 5) * 12 + sameCat * 6 + sameBrand * 2 + shared * 8 + price * 2
      + Math.log10(1 + (Number(c.totalSold) || 0)) * 1.2 + (Number(c.avgRating) || 0) * 0.3;
    // a product that shares nothing with the seeds is noise: only bought-together or some relation qualifies
    if (!together && !sameCat && shared < 0.34) continue;
    const reason: Rec['reason'] = together ? 'frequently_bought_together' : (shared >= 0.34 && !sameCat) ? 'compatible' : sameBrand || shared >= 0.34 ? 'similar_specs' : 'same_category';
    out.push({ product: c, reason, score: Math.round(score * 100) / 100 });
  }
  out.sort((a, b) => b.score - a.score);
  // variety: at most 4 from one category before the rest
  const perCat = new Map<string, number>(); const picked: Rec[] = [], later: Rec[] = [];
  for (const r of out) {
    const k = r.product.categoryId || '-'; const n = perCat.get(k) || 0;
    if (n < 4) { picked.push(r); perCat.set(k, n + 1); } else later.push(r);
  }
  return [...picked, ...later].slice(0, limit);
}

/** Pairs from recent real orders. Cached for 15 minutes so shoppers do not cause a Firestore read each time. */
let pairCache: { at: number; pairs: Pairs } | null = null;
export function __resetRecommendCache() { pairCache = null; }
export async function loadPairCounts(): Promise<Pairs> {
  if (pairCache && Date.now() - pairCache.at < 15 * 60_000) return pairCache.pairs;
  const pairs: Pairs = new Map();
  try {
    const snap = await getAdminDb().collection('orders').orderBy('createdAt', 'desc').limit(250).get();
    for (const d of snap.docs) {
      const o: any = d.data();
      if (o.status === 'cancelled') continue;
      const ids = [...new Set(((o.items || []) as any[]).map(i => String(i.productId)).filter(id => id && !id.startsWith('bundle:')))].slice(0, 20);
      for (const a of ids) for (const b of ids) if (a !== b) {
        const m = pairs.get(a) || new Map<string, number>(); m.set(b, (m.get(b) || 0) + 1); pairs.set(a, m);
      }
    }
  } catch { /* no history yet: the other signals still work */ }
  pairCache = { at: Date.now(), pairs };
  return pairs;
}
