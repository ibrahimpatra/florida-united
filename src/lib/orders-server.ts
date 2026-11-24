/**
 * orders-server.ts — SERVER ONLY. Authoritative order creation & cancellation.
 *
 * Guarantees
 *  - Prices, stock, free-shipping flags, shipping and coupon are all re-read from
 *    Firestore. Nothing monetary is trusted from the browser.
 *  - Stock is checked + decremented inside ONE transaction (no overselling).
 *  - Duplicate submits are impossible: orderLocks/{user_key} is created in the same
 *    transaction, so concurrent requests with one idempotency key yield one order.
 *  - Order numbers (ABC-1234) are unique: orderNumbers/{number} is claimed in the
 *    transaction; on collision a new number is drawn.
 *  - Cancel restores stock + rollups exactly once (already-cancelled is a no-op).
 */
import { catalogChanged } from './catalog-sync';
import { loadLoyaltySettings } from './loyalty';
import { redeemPlan } from './loyalty-core';
import { randomInt } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { SITE_CONFIG } from './siteConfig';
import { expireStripeSession } from './stripe';
import { onlineProvider } from './payments';
import {
  applyFlashDeals, PricedLine, ZoneLike, ShippingSettings, canonicalGovernorate, computeShipping,
  computeCoupon, customerSegments, computeTotal, makeOrderNumber, round3,
} from './pricing';

export class OrderError extends Error {
  constructor(public status: number, message: string, public code = 'ORDER_ERROR') { super(message); }
}
class NumberCollision extends Error {}

const BUNDLE_PREFIX = 'bundle:';
const kuwaitDay = (d = new Date()) => new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 10);

// ── Settings ─────────────────────────────────────────────────
export async function loadShippingSettings(db: Firestore = getAdminDb()): Promise<{ zones: ZoneLike[]; settings: ShippingSettings }> {
  const [zoneSnap, shipSnap, storeSnap] = await Promise.all([
    db.collection('shippingZones').get(),
    db.doc('config/shippingConfig').get(),
    db.doc('config/storeSettings').get(),
  ]);
  const zones = zoneSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ZoneLike[];
  const ship: any = shipSnap.exists ? shipSnap.data() : {};
  const store: any = storeSnap.exists ? storeSnap.data() : {};
  // Admin > Settings (config/storeSettings) is the primary source; the shipping page's
  // config/shippingConfig is honoured next; code defaults are the last resort.
  const num = (...vals: any[]) => { for (const v of vals) { const n = Number(v); if (v !== undefined && v !== null && v !== '' && Number.isFinite(n) && n >= 0) return n; } return undefined; };
  const threshold = num(store.freeShippingThreshold, ship.defaultFreeShippingThreshold);
  return {
    zones,
    settings: {
      freeShippingThreshold: threshold !== undefined ? (threshold > 0 ? threshold : undefined) : SITE_CONFIG.freeShippingThreshold,
      defaultShippingCost: num(store.defaultShippingCost) ?? SITE_CONFIG.defaultShippingCost,
      localPickupEnabled: !!ship.localPickupEnabled,
      localPickupAddress: ship.localPickupAddress,
      codEnabled: ship.codEnabled !== false && store.codEnabled !== false,
      codFee: num(ship.codFee, store.codFee) ?? 0,
      returnWindowDays: num(store.defaultReturnDays),
    },
  };
}

// ── Cart → priced lines (prices/flags come from the DB) ──────
export interface RawItem { productId: string; quantity: number; variantId?: string; variantName?: string }

/** Live deals + the ones this customer has already used up (their per-customer limit). */
async function loadDeals(db: Firestore, userId?: string) {
  const all = (await db.collection('flashDeals').get()).docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const blocked = new Set<string>();
  if (userId) {
    const limited = all.filter(d => Number(d.maxUsesPerUser) > 0);
    if (limited.length) {
      const snaps = await db.getAll(...limited.map(d => db.collection('flashDealUsage').doc(`${d.id}_${userId}`)));
      snaps.forEach((s, i) => { if (s.exists && Number((s.data() as any).count || 0) >= Number(limited[i].maxUsesPerUser)) blocked.add(limited[i].id); });
    }
  }
  return { deals: all, blocked };
}

export async function resolveLines(db: Firestore, raw: RawItem[], opts: { userId?: string } = {}): Promise<PricedLine[]> {
  return (await resolveLinesWithDeals(db, raw, opts)).lines;
}

const COUPON_WITH_DEAL = 'This coupon cannot be used together with an offer that is in your cart.';

export async function resolveLinesWithDeals(db: Firestore, raw: RawItem[], opts: { userId?: string } = {}): Promise<{ lines: PricedLine[]; usedDealIds: string[]; totalSaving: number; noCoupon?: boolean }> {
  const base = await resolveBaseLines(db, raw);
  let deals: any[] = [], blocked = new Set<string>();
  try { ({ deals, blocked } = await loadDeals(db, opts.userId)); } catch (e) { console.error('[deals] load failed, pricing without deals', e); }
  const r = applyFlashDeals(base, deals, { blocked });
  return { ...r, noCoupon: deals.some(d => r.usedDealIds.includes(d.id) && d.noCoupon === true) };
}

async function resolveBaseLines(db: Firestore, raw: RawItem[]): Promise<PricedLine[]> {
  if (!Array.isArray(raw) || raw.length === 0) throw new OrderError(400, 'Your cart is empty.', 'EMPTY_CART');
  if (raw.length > 60) throw new OrderError(400, 'Too many items in one order.');

  const wanted = raw.map(r => {
    const q = Number(r.quantity);
    if (!r.productId || !Number.isInteger(q) || q < 1 || q > 999) throw new OrderError(400, 'Invalid item quantity in cart.');
    return { productId: String(r.productId), quantity: q, variantId: r.variantId, variantName: r.variantName };
  });

  const bundleIds = [...new Set(wanted.filter(w => w.productId.startsWith(BUNDLE_PREFIX)).map(w => w.productId.slice(BUNDLE_PREFIX.length)))];
  const bundleSnaps = bundleIds.length ? await db.getAll(...bundleIds.map(id => db.collection('bundles').doc(id))) : [];
  const bundles = new Map(bundleSnaps.filter(s => s.exists).map(s => [s.id, s.data() as any]));

  const productIds = new Set<string>();
  for (const w of wanted) {
    if (w.productId.startsWith(BUNDLE_PREFIX)) {
      const b = bundles.get(w.productId.slice(BUNDLE_PREFIX.length));
      if (!b || b.isActive === false) throw new OrderError(409, 'A bundle in your cart is no longer available.', 'UNAVAILABLE');
      (b.items || []).forEach((i: any) => productIds.add(i.productId));
    } else productIds.add(w.productId);
  }
  const pSnaps = productIds.size ? await db.getAll(...[...productIds].map(id => db.collection('products').doc(id))) : [];
  const products = new Map(pSnaps.filter(s => s.exists).map(s => [s.id, s.data() as any]));

  const lines: PricedLine[] = [];
  for (const w of wanted) {
    if (w.productId.startsWith(BUNDLE_PREFIX)) {
      const id = w.productId.slice(BUNDLE_PREFIX.length);
      const b = bundles.get(id)!;
      const comps = (b.items || []).map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity) || 1 }));
      let allFree = comps.length > 0;
      for (const c of comps) {
        const p = products.get(c.productId);
        if (!p || p.isActive === false) throw new OrderError(409, `An item in bundle "${b.name}" is no longer available.`, 'UNAVAILABLE');
        if (Number(p.stock || 0) < c.quantity * w.quantity)
          throw new OrderError(409, `Bundle "${b.name}": only ${Number(p.stock || 0)} of "${p.name}" left in stock.`, 'OUT_OF_STOCK');
        if (!p.freeShipping) allFree = false;
      }
      const price = round3(Number(b.bundlePrice));
      lines.push({
        productId: w.productId, name: b.name, nameAr: b.nameAr || undefined, sku: `BUNDLE-${id.slice(0, 6).toUpperCase()}`, price,
        quantity: w.quantity, total: round3(price * w.quantity), image: b.image || products.get(comps[0]?.productId)?.images?.[0],
        freeShipping: allFree, isReturnable: true, categoryId: 'bundles', categoryName: 'Bundles', bundleItems: comps,
      });
      continue;
    }
    const p = products.get(w.productId);
    if (!p || p.isActive === false) throw new OrderError(409, `"${p?.name || 'An item'}" in your cart is no longer available.`, 'UNAVAILABLE');
    // Selling unit: the cart's variantId carries the unit id. Price + stock factor come from the product, never the browser.
    const unit = w.variantId ? (Array.isArray(p.units) ? p.units : []).find((u: any) => u.id === w.variantId) : undefined;
    if (w.variantId && !unit) throw new OrderError(409, `The selected unit of "${p.name}" is no longer available.`, 'UNAVAILABLE');
    const factor = unit ? Math.max(1, Number(unit.factor) || 1) : 1;
    const stock = Number(p.stock || 0);
    const availUnits = Math.floor(stock / factor);
    if (availUnits < w.quantity)
      throw new OrderError(409, availUnits <= 0 ? `"${p.name}" is out of stock.` : `Only ${availUnits} of "${p.name}"${unit ? ` (${unit.name})` : ''} left in stock.`, 'OUT_OF_STOCK');
    const price = round3(Number(unit ? unit.price : p.price));
    lines.push({
      productId: w.productId, name: p.name, nameAr: p.nameAr || undefined, sku: p.sku || '',
      ...(unit ? { variantId: unit.id, variantName: unit.name, variantNameAr: unit.nameAr || undefined, unitFactor: factor } : {}),
      price, quantity: w.quantity, total: round3(price * w.quantity), image: p.images?.[0],
      freeShipping: !!p.freeShipping, isReturnable: p.isReturnable !== false,
      categoryId: p.categoryId || undefined, categoryName: p.categoryName || undefined,
    });
  }
  return lines;
}

/** The cart facts a coupon's rules need (scope, buy-X-get-Y, customer group). */
export function couponCtx(lines: PricedLine[], segments?: string[]) {
  return { segments, lines: lines.map(l => ({ productId: l.productId, categoryId: l.categoryId, quantity: l.quantity, total: l.total, bundle: !!l.bundleItems })) };
}

/** Used by /api/shipping/calculate so the checkout display == what gets charged. */
export async function quoteShipping(rawItems: RawItem[], governorate: string | undefined, userId?: string, couponCode?: string) {
  const db = getAdminDb();
  const { lines, totalSaving, noCoupon } = await resolveLinesWithDeals(db, rawItems, { userId });
  const { zones, settings } = await loadShippingSettings(db);
  const subtotal = round3(lines.reduce((s, l) => s + l.total, 0));
  // Same rule placeOrder applies, so the checkout summary shows exactly what will be charged.
  let discount = 0; let couponError: string | undefined; let freeShip = false;
  const code = String(couponCode || '').trim().toUpperCase();
  if (code) {
    const cs = await db.collection('coupons').where('code', '==', code).limit(1).get();
    const cd: any = cs.empty ? null : cs.docs[0].data();
    const uses = cd?.perUserLimit && userId ? Number(((await db.collection('couponUsage').doc(`${cs.docs[0].id}_${userId}`).get()).data() as any)?.count || 0) : 0;
    const segs = cd?.segment && cd.segment !== 'all' && userId ? customerSegments((await db.collection('users').doc(userId).get()).data()) : undefined;
    const r = computeCoupon(cd, subtotal, new Date(), uses, couponCtx(lines, segs));
    if (noCoupon) couponError = COUPON_WITH_DEAL;
    else if (r.valid) { discount = r.discount; freeShip = !!r.freeShipping; } else couponError = r.error || 'Invalid coupon.';
  }
  const ship = computeShipping({ governorate, lines, zones, settings });
  if (freeShip) {   // free-shipping coupon: every delivery option costs nothing
    ship.options = ship.options.map(o => ({ ...o, price: 0, isFree: true, badge: 'FREE', method: 'free' as any }));
    ship.defaultOption = ship.options[0] || ship.defaultOption;
    ship.amountToFreeShipping = undefined;
  }
  return { subtotal, lines, dealSaving: totalSaving, discount, ...(freeShip ? { couponFreeShipping: true } : {}), ...(couponError ? { couponError } : {}), ...ship };
}

// ── Address validation ───────────────────────────────────────
function cleanAddress(a: any) {
  const governorate = canonicalGovernorate(a?.governorate);
  if (!governorate) throw new OrderError(400, 'Please select a valid governorate.', 'BAD_ADDRESS');
  const str = (v: any, max = 120) => String(v ?? '').trim().slice(0, max);
  const firstName = str(a.firstName, 60), lastName = str(a.lastName, 60);
  const digits = str(a.phone, 20).replace(/\D/g, '').replace(/^965/, '');
  if (!firstName) throw new OrderError(400, 'First name is required.', 'BAD_ADDRESS');
  if (!/^[569]\d{7}$/.test(digits)) throw new OrderError(400, 'Enter a valid Kuwait mobile number (8 digits starting with 5, 6 or 9).', 'BAD_ADDRESS');
  const block = str(a.block, 20), street = str(a.street, 60), building = str(a.building, 40), city = str(a.city, 80);
  if (!block || !street || !building) throw new OrderError(400, 'Block, street and building are required.', 'BAD_ADDRESS');
  if (!city) throw new OrderError(400, 'Area / city is required.', 'BAD_ADDRESS');
  return {
    firstName, lastName, phone: `+965${digits}`, city, governorate, country: 'Kuwait',
    block, street, building, floor: str(a.floor, 20), apartment: str(a.apartment, 40),
    address1: `Block ${block}, Street ${street}, Building ${building}`,
    label: str(a.label, 30) || 'Delivery Address',
  };
}

// ── Place order ──────────────────────────────────────────────
export interface PlaceOrderInput {
  userId: string; userEmail: string; userName: string; userPhone?: string;
  idempotencyKey?: string; contactEmail?: string; items: RawItem[]; shippingAddress: any;
  shippingRateId?: string; couponCode?: string; notes?: string; paymentMethod: 'cod' | 'card';
  redeemPoints?: number;
}

export async function placeOrder(input: PlaceOrderInput) {
  const db = getAdminDb();
  const address = cleanAddress(input.shippingAddress);
  const method = input.paymentMethod === 'card' ? 'card' : 'cod';
  const provider = method === 'card' ? await onlineProvider(db) : null;
  if (method === 'card' && !provider) throw new OrderError(400, 'Online payment is not available right now. Please choose cash on delivery.', 'CARD_OFF');

  const lockId = input.idempotencyKey
    ? `${input.userId}_${String(input.idempotencyKey).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100)}` : null;
  const lockRef = lockId ? db.collection('orderLocks').doc(lockId) : null;

  // Fast path: this exact submit already produced an order → return it.
  if (lockRef) {
    const l = await lockRef.get();
    if (l.exists) return { ...(l.data() as any), duplicate: true };
  }

  const { lines, usedDealIds, totalSaving: dealDiscount } = await resolveLinesWithDeals(db, input.items, { userId: input.userId });
  const { zones, settings } = await loadShippingSettings(db);
  const subtotal = round3(lines.reduce((s, l) => s + l.total, 0));

  const ship = computeShipping({ governorate: address.governorate, lines, zones, settings });
  const chosen = ship.options.find(o => o.rateId === input.shippingRateId) || ship.defaultOption;
  if (!chosen) throw new OrderError(400, 'No delivery option is available for your area.', 'NO_SHIPPING');
  const codFee = method === 'cod' ? ship.codFee : 0;
  if (method === 'cod' && !ship.codAvailable) throw new OrderError(400, 'Cash on delivery is not available right now.', 'COD_OFF');
  const shipBase = round3(chosen.price + codFee);

  // Coupon doc reference (validated again inside the transaction with fresh data)
  let couponRef: FirebaseFirestore.DocumentReference | null = null;
  const code = String(input.couponCode || '').trim().toUpperCase();
  if (code) {
    const cs = await db.collection('coupons').where('code', '==', code).limit(1).get();
    if (cs.empty) throw new OrderError(400, 'Invalid coupon code.', 'BAD_COUPON');
    couponRef = cs.docs[0].ref;
  }

  // Aggregate stock to reserve
  const need = new Map<string, number>();
  for (const l of lines) {
    if (l.bundleItems) l.bundleItems.forEach(c => need.set(c.productId, (need.get(c.productId) || 0) + c.quantity * l.quantity));
    else need.set(l.productId, (need.get(l.productId) || 0) + l.quantity * (l.unitFactor || 1));
  }

  const loyalty = Number(input.redeemPoints) > 0 ? await loadLoyaltySettings(db) : null;
  const contactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.contactEmail || '').trim()) ? String(input.contactEmail).trim().toLowerCase().slice(0, 120) : '';
  const day = kuwaitDay();
  for (let attempt = 0; attempt < 8; attempt++) {
    const orderNumber = makeOrderNumber(n => randomInt(n));
    try {
      let wentOut: string[] = [];
      const placed: any = await db.runTransaction(async tx => {
        wentOut = [];
        // ---------- READS ----------
        const lockSnap = lockRef ? await tx.get(lockRef) : null;
        if (lockSnap?.exists) return { ...(lockSnap.data() as any), duplicate: true };

        const numRef = db.collection('orderNumbers').doc(orderNumber);
        if ((await tx.get(numRef)).exists) throw new NumberCollision();

        const refs = [...need.keys()].map(id => db.collection('products').doc(id));
        const snaps = refs.length ? await tx.getAll(...refs) : [];
        for (const s of snaps) {
          const d: any = s.data();
          if (!s.exists || d.isActive === false) throw new OrderError(409, `"${d?.name || 'An item'}" is no longer available.`, 'UNAVAILABLE');
          const want = need.get(s.id)!;
          const stock = Number(d.stock || 0);
          if (stock < want) throw new OrderError(409, stock <= 0 ? `"${d.name}" just went out of stock.` : `Only ${stock} of "${d.name}" left in stock.`, 'OUT_OF_STOCK');
        }

        // Deal limits are re-checked on fresh data: the last use of a limited deal can only go to one customer.
        const dealRefs = usedDealIds.map(id => db.collection('flashDeals').doc(id));
        const dealSnaps = dealRefs.length ? await tx.getAll(...dealRefs) : [];
        const usageRefs = usedDealIds.map(id => db.collection('flashDealUsage').doc(`${id}_${input.userId}`));
        const usageSnaps = usageRefs.length ? await tx.getAll(...usageRefs) : [];
        dealSnaps.forEach((ds, i) => {
          const d: any = ds.data();
          if (!ds.exists || d.isActive === false) throw new OrderError(409, 'An offer in your cart just ended. Please review your cart and try again.', 'DEAL_ENDED');
          if (Number(d.maxUsesTotal) > 0 && Number(d.usedCount || 0) >= Number(d.maxUsesTotal)) throw new OrderError(409, 'An offer in your cart just sold out. Please review your cart and try again.', 'DEAL_ENDED');
          if (Number(d.maxUsesPerUser) > 0 && Number((usageSnaps[i].data() as any)?.count || 0) >= Number(d.maxUsesPerUser)) throw new OrderError(409, 'You have already used an offer in your cart. Please review your cart and try again.', 'DEAL_ENDED');
        });

        let shippingCost = shipBase;
        let discount = 0;
        if (couponRef) {
          const cs = await tx.get(couponRef);
          const cu = await tx.get(db.collection('couponUsage').doc(`${couponRef.id}_${input.userId}`));
          if (dealSnaps.some(ds => (ds.data() as any)?.noCoupon === true)) throw new OrderError(400, COUPON_WITH_DEAL, 'BAD_COUPON');
          const cdata: any = cs.exists ? cs.data() : null;
          const segs = cdata?.segment && cdata.segment !== 'all' ? customerSegments((await tx.get(db.collection('users').doc(input.userId))).data()) : undefined;
          const res = computeCoupon(cdata, subtotal, new Date(), Number((cu.data() as any)?.count || 0), couponCtx(lines, segs));
          if (!res.valid) throw new OrderError(400, res.error || 'Invalid coupon.', 'BAD_COUPON');
          discount = res.discount;
          if (res.freeShipping) shippingCost = round3(shipBase - chosen.price);   // delivery is free; a cash-on-delivery fee still applies
        }
        // Loyalty points: balance read inside the transaction, so two checkouts can never spend the same points.
        let loyaltyPoints = 0, loyaltyDiscount = 0;
        const userRef = db.collection('users').doc(input.userId);
        if (loyalty?.enabled) {
          const bal = Math.max(0, Math.floor(Number(((await tx.get(userRef)).data() as any)?.loyaltyPoints) || 0));
          const plan = redeemPlan(loyalty, Number(input.redeemPoints), bal, round3(subtotal - discount));
          loyaltyPoints = plan.points; loyaltyDiscount = plan.discount;
        }
        const total = computeTotal(subtotal, discount + loyaltyDiscount, shippingCost);

        // ---------- WRITES ----------
        const orderRef = db.collection('orders').doc();
        const nowIso = new Date().toISOString();
        const items = lines.map(l => ({
          productId: l.productId, productName: l.name, ...(l.nameAr ? { productNameAr: l.nameAr } : {}), productSku: l.sku,
          ...(l.variantId ? { variantId: l.variantId } : {}), ...(l.variantName ? { variantName: l.variantName } : {}),
          ...(l.variantNameAr ? { variantNameAr: l.variantNameAr } : {}), ...(l.unitFactor ? { unitFactor: l.unitFactor } : {}),
          price: l.price, quantity: l.quantity, total: l.total, image: l.image || '',
          ...(l.dealId ? { listPrice: l.listPrice, dealId: l.dealId, dealTitle: l.dealTitle || '', ...(l.dealTitleAr ? { dealTitleAr: l.dealTitleAr } : {}), dealSaving: l.dealSaving } : {}),
          isReturnable: l.isReturnable, freeShipping: l.freeShipping,
          categoryId: l.categoryId || '', categoryName: l.categoryName || '',
          ...(l.bundleItems ? { bundleItems: l.bundleItems } : {}),
        }));
        const units = lines.reduce((s, l) => s + l.quantity, 0);

        tx.set(orderRef, {
          orderNumber, userId: input.userId, userEmail: input.userEmail, userName: input.userName,
          ...(contactEmail ? { contactEmail } : {}),
          userPhone: address.phone, shippingAddress: address, items,
          productIds: [...new Set(items.map((i: any) => i.productId).concat(items.flatMap((i: any) => (i.bundleItems || []).map((b: any) => b.productId))).filter(Boolean))], // lets us tell if a product has order history
          status: 'pending', paymentStatus: 'pending', paymentMethod: method, ...(provider ? { paymentProvider: provider.id } : {}), currency: 'KWD',
          subtotal, discount, ...(loyaltyPoints > 0 ? { loyaltyPoints, loyaltyDiscount } : {}), ...(dealDiscount > 0 ? { dealDiscount, dealIds: usedDealIds } : {}), shippingCost, shippingMethod: chosen.name, tax: 0, total,
          couponCode: code || null, couponId: couponRef?.id || null, notes: String(input.notes || '').slice(0, 500) || null,
          statsDay: day, idempotencyKey: input.idempotencyKey || null,
          statusHistory: [{ status: 'pending', note: 'Order placed', createdAt: nowIso }],
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
        tx.set(numRef, { orderId: orderRef.id, createdAt: FieldValue.serverTimestamp() });

        // stock + per-product counters
        wentOut = snaps.filter(s => Number((s.data() as any)?.stock || 0) - need.get(s.id)! <= 0).map(s => s.id);   // these just sold out: their pages must say so
        for (const s of snaps) {
          const revenue = lines.filter(l => l.productId === s.id && !l.bundleItems).reduce((a, l) => a + l.total, 0);
          tx.update(s.ref, {
            stock: FieldValue.increment(-need.get(s.id)!),
            totalSold: FieldValue.increment(need.get(s.id)!),
            ...(revenue ? { totalRevenue: FieldValue.increment(revenue) } : {}),
          });
        }
        // rollups (O(1) analytics — dashboard never scans orders)
        const cats = new Map<string, { name: string; revenue: number; units: number }>();
        for (const l of lines) {
          const k = l.categoryId || 'uncategorised';
          const c = cats.get(k) || { name: l.categoryName || 'Uncategorised', revenue: 0, units: 0 };
          c.revenue += l.total; c.units += l.quantity; cats.set(k, c);
        }
        cats.forEach((c, k) => tx.set(db.collection('categoryStats').doc(k),
          { name: c.name, revenue: FieldValue.increment(c.revenue), units: FieldValue.increment(c.units) }, { merge: true }));
        tx.set(db.collection('statsDaily').doc(day),
          { date: day, revenue: FieldValue.increment(total), orders: FieldValue.increment(1), units: FieldValue.increment(units) }, { merge: true });
        tx.set(userRef,
          { totalSpent: FieldValue.increment(total), orderCount: FieldValue.increment(1), lastOrderAt: FieldValue.serverTimestamp(), ...(loyaltyPoints > 0 ? { loyaltyPoints: FieldValue.increment(-loyaltyPoints) } : {}) }, { merge: true });
        if (loyaltyPoints > 0) tx.set(db.collection('loyaltyLedger').doc(`${orderRef.id}_redeem`), { userId: input.userId, orderId: orderRef.id, orderNumber, type: 'redeem', points: -loyaltyPoints, note: `Used on order ${orderNumber}`, createdAt: nowIso });
        if (couponRef) {
          tx.update(couponRef, { usedCount: FieldValue.increment(1) });
          tx.set(db.collection('couponUsage').doc(`${couponRef.id}_${input.userId}`), { couponId: couponRef.id, userId: input.userId, count: FieldValue.increment(1) }, { merge: true });
        }
        dealRefs.forEach((r, i) => {
          tx.update(r, { usedCount: FieldValue.increment(1) });
          tx.set(usageRefs[i], { dealId: usedDealIds[i], userId: input.userId, count: FieldValue.increment(1) }, { merge: true });
        });

        const result = { orderId: orderRef.id, orderNumber, total, subtotal, discount, shippingCost, ...(loyaltyPoints > 0 ? { loyaltyPoints, loyaltyDiscount } : {}) };
        if (lockRef) tx.set(lockRef, { ...result, userId: input.userId, createdAt: FieldValue.serverTimestamp() });

        return {
          ...result, duplicate: false,
          order: {
            id: orderRef.id, orderNumber, userId: input.userId, userEmail: input.userEmail, userName: input.userName,
            ...(contactEmail ? { contactEmail } : {}),
            userPhone: address.phone, shippingAddress: address, status: 'pending', paymentStatus: 'pending',
            paymentMethod: method, currency: 'KWD', items, subtotal, discount, ...(loyaltyPoints > 0 ? { loyaltyPoints, loyaltyDiscount } : {}), ...(dealDiscount > 0 ? { dealDiscount } : {}), shippingCost, shippingMethod: chosen.name, tax: 0, total,
            couponCode: code || null, notes: String(input.notes || '').slice(0, 500) || null,
            createdAt: nowIso, updatedAt: nowIso,
          },
        };
      });
      if (!placed.duplicate && wentOut.length) void catalogChanged(wentOut);
      return placed;
    } catch (e) {
      if (e instanceof NumberCollision) continue; // draw another number
      throw e;
    }
  }
  throw new OrderError(503, 'Could not allocate an order number. Please try again.', 'NUMBER_ALLOC');
}

/** Firestore Timestamps -> ISO strings (and drop write-sentinels) so an order can be passed to email / WhatsApp code. */
export function plainOrder(v: any): any {
  if (v && typeof v === 'object') {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (/Transform$/.test(v.constructor?.name || '')) return undefined;
    if (Array.isArray(v)) return v.map(plainOrder);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainOrder(x)]).filter(([, x]) => x !== undefined));
  }
  return v;
}

// ── Cancel order ─────────────────────────────────────────────
export async function cancelOrder(args: { orderId: string; actor: { id: string; role: string }; note?: string }) {
  const db = getAdminDb();
  const isAdmin = args.actor.role === 'admin';
  let backInStock: string[] = [];
  const result = await db.runTransaction(async tx => {
    backInStock = [];
    const ref = db.collection('orders').doc(args.orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new OrderError(404, 'Order not found.', 'NOT_FOUND');
    const o: any = snap.data();
    if (!isAdmin && o.userId !== args.actor.id) throw new OrderError(403, 'Forbidden', 'FORBIDDEN');
    if (o.status === 'cancelled') return { alreadyCancelled: true, order: plainOrder({ id: snap.id, ...o }) };

    const allowed = isAdmin ? ['pending', 'confirmed', 'processing'] : ['pending', 'confirmed'];
    if (!allowed.includes(o.status))
      throw new OrderError(400, isAdmin ? `A ${String(o.status).replace(/_/g, ' ')} order cannot be cancelled.` : 'This order can no longer be cancelled online. Please contact support.', 'NOT_CANCELLABLE');

    const need = new Map<string, number>();
    for (const i of (o.items || []) as any[]) {
      if (Array.isArray(i.bundleItems)) i.bundleItems.forEach((c: any) => need.set(c.productId, (need.get(c.productId) || 0) + c.quantity * i.quantity));
      else need.set(i.productId, (need.get(i.productId) || 0) + i.quantity * (Number(i.unitFactor) || 1));
    }
    const refs = [...need.keys()].map(id => db.collection('products').doc(id));
    const pSnaps = refs.length ? await tx.getAll(...refs) : [];

    for (const p of pSnaps) {
      if (!p.exists) continue; // product deleted since
      const q = need.get(p.id)!;
      if (Number((p.data() as any)?.stock || 0) <= 0) backInStock.push(p.id);
      const revenueBack = (o.items as any[]).filter(i => i.productId === p.id && !i.bundleItems).reduce((a, i) => a + Number(i.total || 0), 0);
      tx.update(p.ref, {
        stock: FieldValue.increment(q), totalSold: FieldValue.increment(-q),
        ...(revenueBack ? { totalRevenue: FieldValue.increment(-revenueBack) } : {}),
      });
    }
    // Reverse rollups only for orders that were counted in them (new-format orders)
    if (o.statsDay) {
      const cats = new Map<string, { revenue: number; units: number }>();
      for (const i of (o.items || []) as any[]) {
        const k = i.categoryId || 'uncategorised';
        const c = cats.get(k) || { revenue: 0, units: 0 };
        c.revenue += i.total; c.units += i.quantity; cats.set(k, c);
      }
      cats.forEach((c, k) => tx.set(db.collection('categoryStats').doc(k),
        { revenue: FieldValue.increment(-c.revenue), units: FieldValue.increment(-c.units) }, { merge: true }));
      const units = (o.items as any[]).reduce((s, i) => s + i.quantity, 0);
      tx.set(db.collection('statsDaily').doc(o.statsDay),
        { revenue: FieldValue.increment(-o.total), orders: FieldValue.increment(-1), units: FieldValue.increment(-units) }, { merge: true });
      tx.set(db.collection('users').doc(o.userId),
        { totalSpent: FieldValue.increment(-o.total), orderCount: FieldValue.increment(-1) }, { merge: true });
    }
    if (o.couponId) {
      tx.update(db.collection('coupons').doc(o.couponId), { usedCount: FieldValue.increment(-1) });
      tx.set(db.collection('couponUsage').doc(`${o.couponId}_${o.userId}`), { count: FieldValue.increment(-1) }, { merge: true }); // a cancelled order frees the customer's use
    }
    for (const dealId of (Array.isArray(o.dealIds) ? o.dealIds : []) as string[]) {
      tx.set(db.collection('flashDeals').doc(dealId), { usedCount: FieldValue.increment(-1) }, { merge: true });
      tx.set(db.collection('flashDealUsage').doc(`${dealId}_${o.userId}`), { count: FieldValue.increment(-1) }, { merge: true });
    }

    if (Number(o.loyaltyPoints) > 0) { // points used on this order go back to the customer
      tx.set(db.collection('users').doc(o.userId), { loyaltyPoints: FieldValue.increment(Number(o.loyaltyPoints)) }, { merge: true });
      tx.set(db.collection('loyaltyLedger').doc(`${args.orderId}_refund`), { userId: o.userId, orderId: args.orderId, orderNumber: o.orderNumber || '', type: 'refund', points: Number(o.loyaltyPoints), note: `Order ${o.orderNumber || ''} cancelled`, createdAt: new Date().toISOString() });
    }
    const wasPaid = o.paymentStatus === 'paid';
    tx.update(ref, {
      status: 'cancelled', cancelledAt: FieldValue.serverTimestamp(), cancelledBy: isAdmin ? 'admin' : 'customer',
      paymentStatus: wasPaid ? 'refund_pending' : 'cancelled', ...(wasPaid ? { needsRefund: true } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      statusHistory: FieldValue.arrayUnion({
        status: 'cancelled', note: args.note || (isAdmin ? 'Cancelled by admin' : 'Cancelled by customer'), createdAt: new Date().toISOString(),
      }),
    });
    return { alreadyCancelled: false, needsRefund: wasPaid, order: plainOrder({ id: snap.id, ...o, status: 'cancelled' }) };
  });
  if (backInStock.length && !(result as any).alreadyCancelled) void catalogChanged(backInStock);   // it was sold out and is back: refresh its page
  return result;
}

// ── Card payments ────────────────────────────────────────────
/** Idempotent: safe to call from the webhook AND the success-page confirm. */
export async function markOrderPaid(orderId: string, info: { provider?: string; paymentRef?: string; sessionId?: string; paymentIntent?: string; usdAmount?: number; usdRate?: number }) {
  const db = getAdminDb();
  return db.runTransaction(async tx => {
    const ref = db.collection('orders').doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new OrderError(404, 'Order not found.', 'NOT_FOUND');
    const o: any = snap.data();
    if (o.paymentStatus === 'paid') return { already: true, order: plainOrder({ id: snap.id, ...o }) };
    const nowIso = new Date().toISOString();
    const history = Array.isArray(o.statusHistory) ? [...o.statusHistory] : [];
    const upd: Record<string, any> = {
      paymentStatus: 'paid', paidAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      ...(info.paymentRef ? { paymentRef: info.paymentRef } : {}),
      ...(info.sessionId ? { stripeSessionId: info.sessionId } : {}),
      ...(info.paymentIntent ? { stripePaymentIntent: info.paymentIntent } : {}),
      ...(info.usdAmount ? { usdAmount: info.usdAmount } : {}), ...(info.usdRate ? { usdRate: info.usdRate } : {}),
    };
    if (o.status === 'pending') {
      upd.status = 'confirmed';
      history.push({ status: 'confirmed', note: `Payment received via ${({ stripe: 'Stripe', tap: 'Tap', myfatoorah: 'MyFatoorah' } as any)[info.provider || o.paymentProvider || 'stripe'] || 'card'}`, createdAt: nowIso });
    } else if (o.status === 'cancelled') {
      // money arrived for an order that was already cancelled (expired session / race) -> needs a refund
      upd.needsRefund = true;
      history.push({ status: 'cancelled', note: 'Payment received after cancellation - refund required', createdAt: nowIso });
    }
    upd.statusHistory = history;
    tx.update(ref, upd);
    return { already: false, order: plainOrder({ id: snap.id, ...o, ...upd, paidAt: nowIso }) };
  });
}


/** Puts returned items back on the shelf (stock is held in base units). Bundles restock their components. */
export async function restockItems(db: Firestore, items: any[]) {
  const back = new Map<string, number>();
  for (const i of items || []) {
    const q = Number(i.quantity) || 0;
    if (Array.isArray(i.bundleItems)) i.bundleItems.forEach((c: any) => back.set(c.productId, (back.get(c.productId) || 0) + (Number(c.quantity) || 1) * q));
    else if (i.productId) back.set(i.productId, (back.get(i.productId) || 0) + q * (Number(i.unitFactor) || 1));
  }
  if (!back.size) return;
  const batch = db.batch();
  const snaps = await db.getAll(...[...back.keys()].map(id => db.collection('products').doc(id)));
  for (const s of snaps) if (s.exists) batch.update(s.ref, { stock: FieldValue.increment(back.get(s.id)!) });
  await batch.commit();
  void catalogChanged([...back.keys()]);
}


/**
 * Card orders that were placed but never paid (customer closed the tab before Stripe, or abandoned it) hold stock.
 * Cancel the ones older than `hours`, and close their Stripe session so they cannot be paid afterwards.
 */
export async function expireUnpaidCardOrders(hours = 2): Promise<{ cancelled: number }> {
  const db = getAdminDb();
  const cutoff = Date.now() - hours * 3_600_000;
  const snap = await db.collection('orders').where('paymentMethod', '==', 'card').where('paymentStatus', '==', 'pending').get();
  let cancelled = 0;
  for (const d of snap.docs) {
    const o: any = d.data();
    const created = o.createdAt?.toDate ? o.createdAt.toDate().getTime() : new Date(o.createdAt).getTime();
    if (o.paymentMethod !== 'card' || o.status !== 'pending' || !Number.isFinite(created) || created > cutoff) continue;
    try {
      // The customer may have paid without coming back (closed the tab): ask the provider before cancelling.
      try {
        const { settleOrderPayment } = await import('./payments/settle');
        const sr = await settleOrderPayment(d.id);
        if (sr.paid) {
          if (!sr.already && sr.order) { const { notifyOrderPlaced } = await import('./place-order-handler'); notifyOrderPlaced(sr.order); }
          continue;
        }
      } catch (e: any) { console.error('[sweep verify]', d.id, e?.message); continue; } // cannot verify -> do not cancel a possibly paid order
      if (o.stripeSessionId) await expireStripeSession(o.stripeSessionId);
      await cancelOrder({ orderId: d.id, actor: { id: 'system', role: 'admin' }, note: 'Card payment not completed in time' });
      cancelled++;
    } catch (e) { console.error('[expire card order]', d.id, e); }
  }
  return { cancelled };
}

/**
 * Vercel's free (Hobby) plan only allows ONE cron run per day, so abandoned card orders are also released
 * opportunistically: whenever someone places an order, at most once every 10 minutes per server instance.
 */
let lastSweep = 0;
export async function sweepStaleCardOrders(): Promise<void> {
  if (Date.now() - lastSweep < 10 * 60_000) return;
  lastSweep = Date.now();
  try {
    const r = await expireUnpaidCardOrders(2);
    if (r.cancelled) console.warn(`[sweep] released stock of ${r.cancelled} unpaid card order(s)`);
  } catch (e: any) { console.error('[sweep] failed', e?.message); }
}
