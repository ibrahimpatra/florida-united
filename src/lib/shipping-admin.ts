/**
 * shipping-admin.ts — Admin SDK versions of shippingService functions
 * Use in API routes only. Never import in client components.
 */
import { memo, dropMemo } from './memo';
import { getAdminDb } from './firebase-admin';
import { queueFill } from './bg';
import { FieldValue } from 'firebase-admin/firestore';
import type { ShippingZone, ShippingConfig, UOM, FlashDeal } from './shipping';

function toData<T>(snap: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as T;
}
function toList<T>(snap: FirebaseFirestore.QuerySnapshot): T[] {
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as T[];
}

// ── Shipping Zones ────────────────────────────────────────────
export async function adminGetShippingZones(): Promise<ShippingZone[]> {
  return toList<ShippingZone>(await getAdminDb().collection('shippingZones').get()).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name || '').localeCompare(String(b.name || '')));
}
export async function adminCreateShippingZone(data: Omit<ShippingZone,'id'|'createdAt'|'updatedAt'>): Promise<string> {
  const ref = await getAdminDb().collection('shippingZones').add({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}
export async function adminUpdateShippingZone(id: string, data: Partial<ShippingZone>): Promise<void> {
  await getAdminDb().collection('shippingZones').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}
export async function adminDeleteShippingZone(id: string): Promise<void> {
  await getAdminDb().collection('shippingZones').doc(id).delete();
}

// ── Shipping Config ───────────────────────────────────────────
export async function adminGetShippingConfig(): Promise<ShippingConfig | null> {
  const snap = await getAdminDb().doc('config/shippingConfig').get();
  return snap.exists ? (snap.data() as ShippingConfig) : null;
}
export async function adminSaveShippingConfig(config: Partial<ShippingConfig>): Promise<void> {
  await getAdminDb().doc('config/shippingConfig').set({ ...config, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

// ── UOMs ─────────────────────────────────────────────────────
export async function adminGetUOMs(): Promise<UOM[]> {
  return toList<UOM>(await getAdminDb().collection('uoms').get()).sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
}
export class AdminInputError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function adminCreateUOM(data: Omit<UOM,'id'|'createdAt'>): Promise<string> {
  const name = String((data as any)?.name || '').trim(), abbr = String((data as any)?.abbreviation || '').trim();
  if (!name || !abbr) throw new AdminInputError(400, 'Name and abbreviation are required.');
  const existing = toList<any>(await getAdminDb().collection('uoms').get());
  if (existing.some(u => String(u.name).toLowerCase() === name.toLowerCase())) throw new AdminInputError(409, `A unit named "${name}" already exists.`);
  data = { ...data, name, abbreviation: abbr } as any;
  const ref = await getAdminDb().collection('uoms').add({ ...data, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}
export async function adminUpdateUOM(id: string, data: Partial<UOM>): Promise<void> {
  const d: any = { ...data };
  for (const k of ['id', 'createdAt']) delete d[k];
  if ('name' in d && !String(d.name).trim()) throw new AdminInputError(400, 'Name is required.');
  if ('abbreviation' in d && !String(d.abbreviation).trim()) throw new AdminInputError(400, 'Abbreviation is required.');
  await getAdminDb().collection('uoms').doc(id).update(d);
}
export async function adminDeleteUOM(id: string): Promise<void> {
  const db = getAdminDb();
  const used = await db.collection('products').where('uomId', '==', id).limit(3).get();
  if (!used.empty) throw new AdminInputError(409, `This unit is used by ${used.size >= 3 ? 'several products' : used.size === 1 ? `"${(used.docs[0].data() as any).name}"` : 'products'}. Change those products to another unit first.`);
  await db.collection('uoms').doc(id).delete();
}

// ── Flash Deals ───────────────────────────────────────────────
export async function adminGetAllFlashDeals(): Promise<FlashDeal[]> {
  return toList<FlashDeal>(await getAdminDb().collection('flashDeals').get()).sort((a: any, b: any) => String(b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : b.createdAt || '').localeCompare(String(a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : a.createdAt || '')));
}
export async function adminGetActiveFlashDeals(): Promise<FlashDeal[]> {
  // Single-field read + in-memory filter: avoids a composite index and docs missing a field vanishing.
  // Shown to shoppers only (orders re-check deals themselves), so one read per minute per server is shared by every visitor.
  const all = await memo('deals:all', 60_000, async () => toList<any>(await getAdminDb().collection('flashDeals').get()));
  const now = Date.now();
  const t = (v: any) => (v?.toDate ? v.toDate().getTime() : new Date(v).getTime());
  return all.filter(d => d.isActive !== false && t(d.endAt) >= now && (!d.startAt || t(d.startAt) <= now))
    .sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || t(a.endAt) - t(b.endAt)) as FlashDeal[];
}
export async function adminGetFlashDealById(id: string): Promise<FlashDeal | null> {
  return toData<FlashDeal>(await getAdminDb().collection('flashDeals').doc(id).get());
}
/** Whitelists and types the fields a flash deal may have (the form and the AI agent both send loose JSON). */
export function sanitizeDeal(b: any, partial = false): Record<string, any> {
  const out: Record<string, any> = {};
  const str = (k: string, max = 200) => { if (k in b) out[k] = String(b[k] ?? '').trim().slice(0, max); };
  const num = (k: string) => { if (k in b) { const n = Number(b[k]); if (b[k] === '' || b[k] === null || !Number.isFinite(n)) out[k] = null; else out[k] = n; } };
  const bool = (k: string) => { if (k in b) out[k] = !!b[k]; };
  const list = (k: string) => { if (k in b) out[k] = Array.isArray(b[k]) ? [...new Set(b[k].map((x: any) => String(x)).filter(Boolean))].slice(0, 500) : []; };
  ['title', 'titleAr', 'subtitle', 'subtitleAr', 'badgeText', 'badgeTextAr'].forEach(k => str(k));
  str('bannerColor', 20); str('image', 600); str('metaTitle', 70); str('metaDesc', 170); str('metaTitleAr', 70); str('metaDescAr', 170); str('imageAlt', 120); str('imageAltAr', 120);
  if ('imageMode' in b) out.imageMode = b.imageMode === 'side' ? 'side' : 'background';
  if ('type' in b) out.type = ['percentage', 'fixed', 'bogo'].includes(b.type) ? b.type : 'percentage';
  if ('scope' in b) out.scope = ['all', 'category', 'products'].includes(b.scope) ? b.scope : 'all';
  ['discountValue', 'minCartAmount', 'maxUsesTotal', 'maxUsesPerUser', 'maxQtyPerOrder'].forEach(num);
  ['showCountdown', 'showOnHomepage', 'showOnProductPage', 'isActive', 'isPinned', 'noCoupon'].forEach(bool);
  list('categoryIds'); list('productIds'); list('tags');
  if ('startAt' in b) out.startAt = b.startAt ? new Date(b.startAt).toISOString() : '';
  if ('endAt' in b) out.endAt = b.endAt ? new Date(b.endAt).toISOString() : '';
  if (!partial) { out.usedCount = 0; if (!('isActive' in out)) out.isActive = true; }
  // null means "no limit": store as absent so the pricing code sees undefined
  for (const k of Object.keys(out)) if (out[k] === null) delete out[k];
  return out;
}

export async function adminCreateFlashDeal(data: any): Promise<string> {
  const ref = await getAdminDb().collection('flashDeals').add({ ...sanitizeDeal(data), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  dropMemo('deals'); queueFill('flashDeals', ref.id);
  return ref.id;
}
export async function adminUpdateFlashDeal(id: string, data: Partial<FlashDeal>): Promise<void> {
  const ref = getAdminDb().collection('flashDeals').doc(id);
  const d = sanitizeDeal(data, true);
  const cleared = ['minCartAmount', 'maxUsesTotal', 'maxUsesPerUser'].filter(k => k in (data as any) && (data as any)[k] === null || (data as any)[k] === '').reduce((o: any, k) => ({ ...o, [k]: FieldValue.delete() }), {});
  await ref.update({ ...d, ...cleared, updatedAt: FieldValue.serverTimestamp() }); // usedCount / id / createdAt are never taken from the form
  dropMemo('deals'); queueFill('flashDeals', id);
}
/** A deal that was used keeps its record (orders reference it): it is switched off instead of deleted. */
export async function adminDeleteFlashDeal(id: string): Promise<{ archived?: true; message: string }> {
  const ref = getAdminDb().collection('flashDeals').doc(id);
  const snap = await ref.get();
  if (snap.exists && Number((snap.data() as any).usedCount || 0) > 0) {
    await ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() }); dropMemo('deals');
    return { archived: true, message: 'This deal was already used in orders, so it was switched off instead of deleted.' };
  }
  await ref.delete(); dropMemo('deals');
  return { message: 'Deal deleted.' };
}

// ── Shipping Calculate (uses zones from Admin SDK) ────────────
import { SITE_CONFIG } from './siteConfig';

export async function adminCalculateShipping(input: {
  governorate?: string;
  area?: string;
  country?: string;
  orderAmount: number;
  orderWeightKg?: number;
  paymentMethod?: string;
  allItemsFreeShipping?: boolean;
}) {
  const { orderAmount, governorate, allItemsFreeShipping } = input;

  // If ALL items in the cart have freeShipping=true → force free regardless of order amount
  if (allItemsFreeShipping) {
    return {
      options: [{ id: 'free', name: 'Free Shipping', price: 0, estimatedDays: 'Same Day / Next Day', isFree: true }],
      recommended: { id: 'free', name: 'Free Shipping', price: 0, estimatedDays: 'Same Day / Next Day', isFree: true },
    };
  }

  // Order-amount threshold (e.g. free above KD 15)
  if (orderAmount >= SITE_CONFIG.freeShippingThreshold) {
    return {
      options: [{ id: 'free', name: 'Free Shipping', price: 0, estimatedDays: 'Same Day / Next Day', isFree: true }],
      recommended: { id: 'free', name: 'Free Shipping', price: 0, estimatedDays: 'Same Day / Next Day', isFree: true },
    };
  }

  // Governorate-wise zone lookup
  const zones = await adminGetShippingZones();
  const zone = zones.find(z =>
    z.isActive &&
    z.governorates?.some(g =>
      g.toLowerCase().includes((governorate || '').toLowerCase()) ||
      (governorate || '').toLowerCase().includes(g.toLowerCase().split(' ')[0])
    )
  );

  const activeRates = (zone?.rates || []).filter((r: any) => r.isActive);
  const options = activeRates.length > 0
    ? activeRates.map((r: any) => ({
        id: r.id,
        name: r.name,
        price: orderAmount >= (r.freeAboveAmount || Infinity) ? 0 : r.basePrice,
        estimatedDays: r.estimatedDays,
        isFree: orderAmount >= (r.freeAboveAmount || Infinity),
        carrier: r.carrier,
        badge: r.badge,
      }))
    : [{
        id: 'standard',
        name: 'Standard Delivery',
        price: SITE_CONFIG.defaultShippingCost,
        estimatedDays: '2-4 days',
        isFree: false,
      }];

  return { options, recommended: options.sort((a: any, b: any) => a.price - b.price)[0] };
}
