/**
 * pricing.ts — PURE functions (no Firestore, no env). Single source of truth for
 * shipping + coupon + totals. Used by:
 *   - /api/shipping/calculate  (what the customer sees)
 *   - placeOrder()             (what the customer is actually charged)
 * so the two can never disagree.
 */
import { KUWAIT_GOVERNORATES } from '../types';
import type { ShippingOption } from './shipping';

export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

// ── Governorate normalisation ────────────────────────────────
// Zones/forms/addresses have used several spellings over time
// ("Capital", "Al Asimah (Capital)", "Capital (العاصمة)"). Everything is mapped
// to the canonical KUWAIT_GOVERNORATES value so matching is exact, not fuzzy.
const ALIASES: Array<[string, RegExp]> = [
  ['Al Asimah (Capital)', /(asimah|capital|عاصمة|العاصمة)/i],
  ['Hawalli',             /(hawall?i|hawalli|حولي)/i],
  ['Farwaniya',           /(farwan|فروان)/i],
  ['Ahmadi',              /(ahmad|أحمد|احمد)/i],
  ['Jahra',               /(jahra|jahraa|جهراء)/i],
  ['Mubarak Al-Kabeer',   /(mubarak|مبارك)/i],
];

export function canonicalGovernorate(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const exact = (KUWAIT_GOVERNORATES as readonly string[]).find(g => g.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  for (const [canon, re] of ALIASES) if (re.test(s)) return canon;
  return null;
}

// ── Types ────────────────────────────────────────────────────
export interface PricedLine {
  productId: string;
  name: string;
  nameAr?: string;
  sku: string;
  variantId?: string;
  variantName?: string;
  variantNameAr?: string;
  /** Base units consumed per ordered unit (1 for the base unit). Stock moves by quantity * unitFactor. */
  unitFactor?: number;
  /** Effective unit price (after any flash deal). For buy-one-get-one this stays the list price and `total` carries the saving. */
  price: number;
  quantity: number;
  total: number;
  /** Set only when a flash deal changed this line. */
  listPrice?: number;
  dealId?: string;
  dealTitle?: string;
  dealTitleAr?: string;
  dealSaving?: number;
  image?: string;
  freeShipping: boolean;
  isReturnable: boolean;
  categoryId?: string;
  categoryName?: string;
  /** Present only for bundle lines: components whose stock must be reserved. */
  bundleItems?: Array<{ productId: string; quantity: number }>;
}

export interface ZoneRateLike {
  id: string; name: string; nameAr?: string; basePrice: number; estimatedDays: string; isActive: boolean;
  freeAboveAmount?: number; carrier?: string; badge?: string;
}
export interface ZoneLike {
  id: string; name: string; nameAr?: string; isActive: boolean; governorates?: string[]; rates?: ZoneRateLike[];
}

export interface ShippingComputation {
  options: ShippingOption[];
  defaultOption?: ShippingOption;
  freeShippingThreshold?: number;
  amountToFreeShipping?: number;
  chargeableSubtotal: number;
  allItemsFreeShipping: boolean;
  localPickupAvailable: boolean;
  localPickupAddress?: string;
  codAvailable: boolean;
  codFee: number;
  zoneMatched?: string;
}

export interface ShippingSettings {
  /** Global free-shipping threshold in KWD (0 = always free). undefined = never. */
  freeShippingThreshold?: number;
  defaultShippingCost: number;
  localPickupEnabled?: boolean;
  localPickupAddress?: string;
  returnWindowDays?: number;
  codEnabled?: boolean;
  codFee?: number;
}

const freeOption = (zoneId = 'free', zoneName = 'Free'): ShippingOption => ({
  rateId: 'free', zoneId, zoneName, name: 'Free Shipping', nameAr: 'شحن مجاني', estimatedDays: '1-2',
  price: 0, isFree: true, badge: 'FREE', method: 'free',
});

/**
 * RULES
 *  1. Lines flagged freeShipping are excluded from the "chargeable" amount.
 *  2. If EVERY line is freeShipping  → delivery is free.
 *  3. Mixed cart (p1 paid-shipping + p2 free-shipping) → delivery is still charged,
 *     and the free-over-threshold test uses only the CHARGEABLE subtotal, so a
 *     free-shipping item can never waive the delivery fee of another item.
 *  4. Rates come from the zone matching the customer's governorate (exact match
 *     on canonical governorate). No zone → default flat fee.
 */
export function computeShipping(args: {
  governorate: string | null | undefined;
  lines: PricedLine[];
  zones: ZoneLike[];
  settings: ShippingSettings;
}): ShippingComputation {
  const { lines, zones, settings } = args;
  const gov = canonicalGovernorate(args.governorate);
  const chargeable = lines.filter(l => !l.freeShipping);
  const chargeableSubtotal = round3(chargeable.reduce((s, l) => s + l.total, 0));
  const allItemsFreeShipping = lines.length > 0 && chargeable.length === 0;

  const base = {
    chargeableSubtotal, allItemsFreeShipping,
    localPickupAvailable: !!settings.localPickupEnabled,
    localPickupAddress: settings.localPickupAddress,
    codAvailable: settings.codEnabled !== false,
    codFee: settings.codFee ?? 0,
    freeShippingThreshold: settings.freeShippingThreshold,
  };

  if (allItemsFreeShipping) {
    const o = freeOption();
    return { ...base, options: [o], defaultOption: o };
  }

  const zone = gov
    ? zones.find(z => z.isActive && (z.governorates || []).some(g => canonicalGovernorate(g) === gov))
    : undefined;

  const activeRates = (zone?.rates || []).filter(r => r.isActive);
  let options: ShippingOption[];

  if (activeRates.length) {
    options = activeRates.map(r => {
      const limit = r.freeAboveAmount && r.freeAboveAmount > 0 ? r.freeAboveAmount : settings.freeShippingThreshold;
      const isFree = r.basePrice === 0 || (limit !== undefined && chargeableSubtotal >= limit);
      return {
        rateId: r.id, zoneId: zone!.id, zoneName: zone!.name, zoneNameAr: zone!.nameAr, name: r.name, nameAr: r.nameAr,
        carrier: r.carrier, estimatedDays: r.estimatedDays,
        price: isFree ? 0 : round3(r.basePrice), originalPrice: isFree ? round3(r.basePrice) : undefined,
        isFree, badge: isFree ? 'FREE' : r.badge, method: isFree ? 'free' : 'flat',
      } as ShippingOption;
    });
  } else {
    const limit = settings.freeShippingThreshold;
    const isFree = limit !== undefined && chargeableSubtotal >= limit;
    options = [{
      rateId: 'standard', zoneId: zone?.id || 'default', zoneName: zone?.name || 'Kuwait',
      name: 'Standard Delivery', nameAr: 'توصيل عادي', estimatedDays: '2-4',
      price: isFree ? 0 : round3(settings.defaultShippingCost),
      isFree, badge: isFree ? 'FREE' : undefined, method: isFree ? 'free' : 'flat',
    }];
  }

  options.sort((a, b) => a.price - b.price);
  const defaultOption = options[0];

  let amountToFreeShipping: number | undefined;
  if (!defaultOption.isFree && settings.freeShippingThreshold !== undefined) {
    const need = round3(settings.freeShippingThreshold - chargeableSubtotal);
    if (need > 0) amountToFreeShipping = need;
  }

  return { ...base, options, defaultOption, amountToFreeShipping, zoneMatched: zone?.name };
}

// ── Coupons ──────────────────────────────────────────────────
export type CouponType = 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
export type CouponSegment = 'all' | 'new' | 'returning' | 'vip' | 'inactive';
export interface CouponLike {
  code: string; type: CouponType; value: number; minOrderAmount?: number;
  maxDiscount?: number; usageLimit?: number; perUserLimit?: number | null; usedCount?: number; isActive: boolean; expiresAt?: string;
  /** coupon is not valid before this moment */
  startsAt?: string | null;
  /** only these products / categories count towards the discount (both empty = whole cart) */
  productIds?: string[]; categoryIds?: string[];
  /** only this kind of customer may use it */
  segment?: CouponSegment;
  /** buy_x_get_y: buy `buyQty`, get `getQty` of the cheapest eligible units free */
  buyQty?: number; getQty?: number;
}
export interface CouponLine { productId: string; categoryId?: string; quantity: number; total: number; bundle?: boolean }
export interface CouponCtx { lines?: CouponLine[]; segments?: string[] }

export const VIP_SPENT_KWD = 200;
export const INACTIVE_DAYS = 90;
/** Which customer groups a shopper belongs to. A person can be in several (e.g. returning + vip). Pure. */
export function customerSegments(user: any, now = new Date()): string[] {
  const orders = Number(user?.orderCount) || 0;
  const out: string[] = [];
  out.push(orders === 0 ? 'new' : 'returning');
  if ((Number(user?.totalSpent) || 0) >= VIP_SPENT_KWD) out.push('vip');
  const last = user?.lastOrderAt?.toDate ? user.lastOrderAt.toDate() : user?.lastOrderAt ? new Date(user.lastOrderAt) : null;
  if (orders > 0 && last && !isNaN(last.getTime()) && now.getTime() - last.getTime() > INACTIVE_DAYS * 86400000) out.push('inactive');
  return out;
}
export const SEGMENT_LABEL: Record<string, string> = { new: 'new customers', returning: 'returning customers', vip: 'VIP customers', inactive: 'customers who have not ordered for a while' };

/** `userUses` = how many times THIS customer already used the code (needed only for coupons with a per-customer limit). */
export function computeCoupon(coupon: CouponLike | null | undefined, subtotal: number, now = new Date(), userUses = 0, ctx: CouponCtx = {}):
  { valid: boolean; discount: number; freeShipping?: boolean; error?: string } {
  const no = (error: string) => ({ valid: false, discount: 0, error });
  if (!coupon) return no('Invalid coupon code');
  if (!coupon.isActive) return no('This coupon is no longer active');
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return no('This coupon is not active yet');
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return no('This coupon has expired');
  if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) return no('This coupon has reached its usage limit');
  if (coupon.perUserLimit && userUses >= coupon.perUserLimit)
    return no(coupon.perUserLimit === 1 ? 'You have already used this coupon' : 'You have reached the limit for this coupon');
  if (coupon.segment && coupon.segment !== 'all') {
    if (!ctx.segments) return no('Sign in to use this coupon');
    if (!ctx.segments.includes(coupon.segment)) return no(`This coupon is only for ${SEGMENT_LABEL[coupon.segment] || 'selected customers'}`);
  }
  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount)
    return no(`Minimum order for this coupon is KD ${coupon.minOrderAmount.toFixed(3)}`);

  if (coupon.type === 'free_shipping') return { valid: true, discount: 0, freeShipping: true };

  // lines that the coupon applies to
  const pids = coupon.productIds || [], cids = coupon.categoryIds || [];
  const scoped = pids.length > 0 || cids.length > 0;
  let eligible = ctx.lines;
  if (scoped) {
    if (!ctx.lines) return no('This coupon only applies to selected products');
    eligible = ctx.lines.filter(l => !l.bundle && (pids.includes(l.productId) || (!!l.categoryId && cids.includes(l.categoryId))));
    if (!eligible.length) return no('This coupon does not apply to anything in your cart');
  }
  const base = eligible ? round3(eligible.reduce((a, l) => a + l.total, 0)) : subtotal;

  if (coupon.type === 'buy_x_get_y') {
    const buy = Math.floor(Number(coupon.buyQty) || 0), get = Math.floor(Number(coupon.getQty) || 0);
    if (buy < 1 || get < 1) return no('This coupon is not set up correctly');
    if (!eligible) return no('This coupon needs your cart items');
    const units: number[] = [];
    for (const l of eligible) { if (l.bundle || !(l.quantity > 0)) continue; for (let i = 0; i < l.quantity; i++) units.push(l.total / l.quantity); }
    const free = Math.floor(units.length / (buy + get)) * get;
    if (free < 1) return no(`Add ${buy + get} eligible items to use this offer (buy ${buy}, get ${get} free)`);
    units.sort((x, y) => x - y);
    const d = round3(units.slice(0, free).reduce((a, x) => a + x, 0));
    return { valid: true, discount: Math.min(d, base) };
  }

  let d = coupon.type === 'percentage' ? (base * coupon.value) / 100 : coupon.value;
  if (coupon.type === 'percentage' && coupon.maxDiscount) d = Math.min(d, coupon.maxDiscount);
  d = Math.min(d, base);
  return { valid: true, discount: round3(Math.max(0, d)) };
}

export const computeTotal = (subtotal: number, discount: number, shipping: number) =>
  round3(Math.max(0, subtotal - discount + shipping));

// ── Order number ─────────────────────────────────────────────
// 3 random letters + '-' + 4 random digits, e.g. KXR-7291. Uniqueness is
// enforced by the order transaction (orderNumbers/{number} doc), not by luck.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O (look like 1/0)
export function makeOrderNumber(rand: (max: number) => number): string {
  const l = Array.from({ length: 3 }, () => LETTERS[rand(LETTERS.length)]).join('');
  const d = Array.from({ length: 4 }, () => String(rand(10))).join('');
  return `${l}-${d}`;
}

// ── Fuzzy search (typo tolerance + synonyms) ─────────────────
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  breaker: ['circuit breaker', 'mcb', 'mccb'],
  'circuit breaker': ['breaker', 'mcb'],
  wire: ['cable', 'cord'],
  cable: ['wire', 'cord'],
  switch: ['switches', 'toggle'],
  socket: ['outlet', 'plug', 'receptacle'],
  outlet: ['socket', 'plug'],
  bulb: ['lamp', 'light', 'led'],
  lamp: ['bulb', 'light'],
  conduit: ['pipe', 'tube', 'trunking'],
  pipe: ['conduit', 'tube'],
};

export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** Score a haystack against a query. 0 = no match. Higher = better. */
export function fuzzyScore(haystack: string, query: string): number {
  const h = haystack.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  if (h.includes(q)) return 100 + (h.startsWith(q) ? 20 : 0);
  const words = h.split(/[^a-z0-9؀-ۿ]+/).filter(Boolean);
  const qWords = q.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const qw of qWords) {
    const variants = [qw, ...(SEARCH_SYNONYMS[qw] || [])];
    let best = 0;
    for (const v of variants) {
      if (h.includes(v)) { best = Math.max(best, v === qw ? 60 : 45); continue; }
      const tol = v.length <= 3 ? 0 : v.length <= 6 ? 1 : 2;
      if (tol === 0) continue;
      for (const w of words) {
        if (w.startsWith(v)) { best = Math.max(best, 50); continue; }
        if (editDistance(w, v, tol) <= tol) best = Math.max(best, 30 - editDistance(w, v, tol) * 5);
      }
    }
    if (best === 0) return 0; // every query word must match something
    total += best;
  }
  return total / qWords.length;
}


/**
 * Strict catalogue search used by the shop, the search box and the admin pickers.
 * Looks ONLY at the name and short description (English and Arabic). Every word the person typed has to be found:
 * as a word start, or inside a word of 3+ letters, or as a one-letter typo of a word of 5+ letters. Returns 0 for no match.
 * `extra` lets the admin pickers add the SKU.
 */
/** Makes Arabic and English spellings comparable: lower-case, no diacritics/tatweel, one form of alef / ya / ta-marbuta, Arabic digits -> 0-9. */
export function normSearch(x: unknown): string {
  return String(x ?? '').toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064a').replace(/\u0629/g, '\u0647')
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660));
}

/**
 * "Did you mean": for every word that matches nothing in the shop's vocabulary, offer the closest known word (one or two letters off).
 * Returns the corrected sentence, or null when nothing needs fixing / nothing close enough exists. Works for English and Arabic.
 */
export function suggestQuery(vocab: Iterable<string>, query: string): string | null {
  const words = normSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const known = new Set<string>(); const list: string[] = [];
  for (const w of vocab) { const n = normSearch(w); if (n.length >= 2 && !known.has(n)) { known.add(n); list.push(n); } }
  let changed = false;
  const out = words.map(w => {
    if (w.length < 3 || known.has(w) || list.some(v => v.startsWith(w) || (w.length >= 4 && v.includes(w)))) return w;
    const tol = w.length <= 5 ? 1 : 2;
    let best = ''; let bd = tol + 1;
    for (const v of list) { const dd = editDistance(w, v, tol); if (dd < bd || (dd === bd && best && Math.abs(v.length - w.length) < Math.abs(best.length - w.length))) { bd = dd; best = v; } }
    if (best && bd <= tol) { changed = true; return best; }
    return w;
  });
  return changed ? out.join(' ') : null;
}

export function matchScore(fields: { name?: string; nameAr?: string; short?: string; shortAr?: string; extra?: string }, query: string): number {
  const q = normSearch(query).trim();
  if (!q) return 1;
  const norm = (x?: string) => normSearch(x);
  const tokenize = (x: string) => x.split(/[^a-z0-9\u0600-\u06ff.]+/).filter(Boolean);
  const names = [norm(fields.name), norm(fields.nameAr), norm(fields.extra)];
  const shorts = [norm(fields.short), norm(fields.shortAr)];
  const wordScore = (qw: string, texts: string[]): number => {
    const variants = [qw, ...(SEARCH_SYNONYMS[qw] || [])];
    let best = 0;
    for (const t of texts) {
      if (!t) continue;
      const words = tokenize(t);
      for (const v of variants) {
        const syn = v !== qw;
        if (words.some(w => w === v)) best = Math.max(best, syn ? 70 : 100);
        else if (words.some(w => w.startsWith(v))) best = Math.max(best, syn ? 60 : 85);
        else if (v.length >= 3 && (words.some(w => w.includes(v)) || t.includes(v))) best = Math.max(best, syn ? 40 : 55);
        else if (!syn && v.length >= 5 && words.some(w => w.length >= 4 && editDistance(w.slice(0, v.length + 1), v, 1) <= 1)) best = Math.max(best, 35);
      }
    }
    return best;
  };
  let total = 0;
  const qWords = q.split(/\s+/).filter(Boolean);
  for (const qw of qWords) {
    const inName = wordScore(qw, names);
    const inShort = Math.round(wordScore(qw, shorts) * 0.6); // a description hit ranks below a name hit
    const best = Math.max(inName, inShort);
    if (!best) return 0;
    total += best;
  }
  const phrase = names.some(n => n.includes(q)) ? 40 : 0;
  return total / qWords.length + phrase;
}


// ── Flash deals ──────────────────────────────────────────────
/** Subset of a flashDeals document that pricing needs (dates may be ISO strings, Date or Firestore Timestamps). */
export interface DealLike {
  id: string; title?: string; titleAr?: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'bundle';
  discountValue?: number;
  scope: 'all' | 'category' | 'products';
  categoryIds?: string[]; productIds?: string[];
  startAt?: any; endAt?: any; isActive?: boolean; isPinned?: boolean;
  minCartAmount?: number; maxUsesTotal?: number; usedCount?: number;
  /** Most units per order that get the offer price; extra units are charged at the normal price. */
  maxQtyPerOrder?: number;
  /** When true a coupon code cannot be used on the same order. */
  noCoupon?: boolean;
}
const ms = (v: any) => (v?.toDate ? v.toDate().getTime() : v ? new Date(v).getTime() : NaN);

export function dealIsLive(d: DealLike, now = Date.now()): boolean {
  if (d.isActive === false) return false;
  if (d.type === 'bundle') return false; // display-only: bundles are priced as bundles
  const s = ms(d.startAt), e = ms(d.endAt);
  if (Number.isFinite(s) && s > now) return false;
  if (!Number.isFinite(e) || e < now) return false;
  if (d.maxUsesTotal && d.maxUsesTotal > 0 && Number(d.usedCount || 0) >= d.maxUsesTotal) return false;
  return true;
}
export function dealCoversProduct(d: DealLike, productId: string, categoryId?: string): boolean {
  if (d.scope === 'all') return true;
  if (d.scope === 'products') return (d.productIds || []).includes(productId);
  if (d.scope === 'category') return !!categoryId && (d.categoryIds || []).includes(categoryId);
  return false;
}
/** What a deal does to ONE unit-priced line: effective unit price and the total for `quantity`. */
export function priceUnderDeal(d: DealLike, price: number, quantity: number): { price: number; total: number; saving: number } {
  const cap = Number(d.maxQtyPerOrder) > 0 ? Math.floor(Number(d.maxQtyPerOrder)) : 0;
  if (cap && quantity > cap) {
    // only the first `cap` units get the offer; the rest are charged normally (the line price stays the list price, `total` carries the saving)
    const part = priceUnderDeal({ ...d, maxQtyPerOrder: 0 }, price, cap);
    const total = round3(part.total + price * (quantity - cap));
    return { price, total, saving: round3(price * quantity - total) };
  }
  const list = round3(price * quantity);
  let total = list, unit = price;
  if (d.type === 'percentage') { unit = round3(price * (1 - Math.min(100, Math.max(0, Number(d.discountValue) || 0)) / 100)); total = round3(unit * quantity); }
  else if (d.type === 'fixed') { unit = round3(Math.max(0, price - Math.max(0, Number(d.discountValue) || 0))); total = round3(unit * quantity); }
  else if (d.type === 'bogo') { total = round3(price * (quantity - Math.floor(quantity / 2))); }
  return { price: unit, total, saving: round3(list - total) };
}

/**
 * Applies the best live deal to every ordinary line (bundles only when a deal names them). Pure: the same function runs on the
 * server (what is charged) and in the browser (what the cart shows), so they cannot disagree.
 * `blocked` lets the server exclude deals a given customer has used up.
 */
export function applyFlashDeals<T extends PricedLine>(lines: T[], deals: DealLike[], opts: { now?: number; blocked?: Set<string> } = {}): { lines: T[]; usedDealIds: string[]; totalSaving: number } {
  const now = opts.now ?? Date.now();
  const live = deals.filter(d => dealIsLive(d, now) && !opts.blocked?.has(d.id));
  const cartBefore = round3(lines.reduce((a, l) => a + l.price * l.quantity, 0));
  const used = new Set<string>(); let totalSaving = 0;
  const out = lines.map(l => {
    if (l.dealId) return l;
    let best: { d: DealLike; r: ReturnType<typeof priceUnderDeal> } | null = null;
    for (const d of live) {
      if (d.minCartAmount && cartBefore < d.minCartAmount) continue;
      // a bundle gets a deal only when the deal names that bundle ("all products" / category deals never touch bundles)
      if (l.bundleItems && !(d.scope === 'products' && (d.productIds || []).includes(l.productId))) continue;
      if (!dealCoversProduct(d, l.productId, l.categoryId)) continue;
      const r = priceUnderDeal(d, l.price, l.quantity);
      if (r.saving > 0 && (!best || r.saving > best.r.saving || (r.saving === best.r.saving && d.isPinned && !best.d.isPinned))) best = { d, r };
    }
    if (!best) return l;
    used.add(best.d.id); totalSaving = round3(totalSaving + best.r.saving);
    return { ...l, listPrice: l.price, price: best.r.price, total: best.r.total, dealId: best.d.id, dealTitle: best.d.title, dealTitleAr: best.d.titleAr, dealSaving: best.r.saving };
  });
  return { lines: out, usedDealIds: [...used], totalSaving };
}

/** For product cards / detail pages: the best live deal that changes this product's price (display only). */
export function bestDealFor(deals: DealLike[], productId: string, categoryId: string | undefined, price: number, now = Date.now()) {
  let best: { deal: DealLike; price: number; saving: number } | null = null;
  for (const d of deals) {
    if (!dealIsLive(d, now) || d.minCartAmount || !dealCoversProduct(d, productId, categoryId)) continue;
    const r = priceUnderDeal(d, price, 2); // 2 units so buy-one-get-one registers a saving
    const per = d.type === 'bogo' ? r.saving / 2 : r.saving / 2;
    if (per > 0 && (!best || per > best.saving)) best = { deal: d, price: d.type === 'bogo' ? price : r.price, saving: per };
  }
  return best;
}
