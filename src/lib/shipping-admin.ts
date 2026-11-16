/**
 * shipping-admin.ts — Admin SDK versions of shippingService functions
 * Use in API routes only. Never import in client components.
 */
import { getAdminDb } from './firebase-admin';
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
  await getAdminDb().collection('uoms').doc(id).delete();
}

// ── Flash Deals ───────────────────────────────────────────────
export async function adminGetAllFlashDeals(): Promise<FlashDeal[]> {
  return toList<FlashDeal>(await getAdminDb().collection('flashDeals').get()).sort((a: any, b: any) => String(b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : b.createdAt || '').localeCompare(String(a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : a.createdAt || '')));
}
export async function adminGetActiveFlashDeals(): Promise<FlashDeal[]> {
  // Single-field read + in-memory filter: avoids a composite index and docs missing a field vanishing.
  const now = Date.now();
  const all = toList<any>(await getAdminDb().collection('flashDeals').get());
  const t = (v: any) => (v?.toDate ? v.toDate().getTime() : new Date(v).getTime());
  return all.filter(d => d.isActive !== false && t(d.endAt) >= now && (!d.startAt || t(d.startAt) <= now))
    .sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || t(a.endAt) - t(b.endAt)) as FlashDeal[];
}
export async function adminGetFlashDealById(id: string): Promise<FlashDeal | null> {
  return toData<FlashDeal>(await getAdminDb().collection('flashDeals').doc(id).get());
}
export async function adminCreateFlashDeal(data: Omit<FlashDeal,'id'|'createdAt'|'updatedAt'>): Promise<string> {
  const ref = await getAdminDb().collection('flashDeals').add({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}
export async function adminUpdateFlashDeal(id: string, data: Partial<FlashDeal>): Promise<void> {
  const d: any = { ...data };
  for (const k of ['id', 'createdAt', 'updatedAt', 'usedCount']) delete d[k]; // server-owned; the form echoes them back
  await getAdminDb().collection('flashDeals').doc(id).update({ ...d, updatedAt: FieldValue.serverTimestamp() });
}
export async function adminDeleteFlashDeal(id: string): Promise<void> {
  await getAdminDb().collection('flashDeals').doc(id).delete();
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
