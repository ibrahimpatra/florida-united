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
  return toList<ShippingZone>(await getAdminDb().collection('shippingZones').orderBy('name').get());
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
  return toList<UOM>(await getAdminDb().collection('uoms').orderBy('name').get());
}
export async function adminCreateUOM(data: Omit<UOM,'id'|'createdAt'>): Promise<string> {
  const ref = await getAdminDb().collection('uoms').add({ ...data, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}
export async function adminUpdateUOM(id: string, data: Partial<UOM>): Promise<void> {
  await getAdminDb().collection('uoms').doc(id).update(data);
}
export async function adminDeleteUOM(id: string): Promise<void> {
  await getAdminDb().collection('uoms').doc(id).delete();
}

// ── Flash Deals ───────────────────────────────────────────────
export async function adminGetAllFlashDeals(): Promise<FlashDeal[]> {
  return toList<FlashDeal>(await getAdminDb().collection('flashDeals').orderBy('createdAt','desc').get());
}
export async function adminGetActiveFlashDeals(): Promise<FlashDeal[]> {
  const now = new Date().toISOString();
  return toList<FlashDeal>(
    await getAdminDb().collection('flashDeals')
      .where('isActive','==',true)
      .where('endDate','>=',now)
      .orderBy('endDate','asc')
      .get()
  );
}
export async function adminGetFlashDealById(id: string): Promise<FlashDeal | null> {
  return toData<FlashDeal>(await getAdminDb().collection('flashDeals').doc(id).get());
}
export async function adminCreateFlashDeal(data: Omit<FlashDeal,'id'|'createdAt'|'updatedAt'>): Promise<string> {
  const ref = await getAdminDb().collection('flashDeals').add({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}
export async function adminUpdateFlashDeal(id: string, data: Partial<FlashDeal>): Promise<void> {
  await getAdminDb().collection('flashDeals').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
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
}) {
  const { orderAmount, governorate } = input;
  
  // Free shipping check
  if (orderAmount >= SITE_CONFIG.freeShippingThreshold) {
    return {
      options: [{ id: 'free', name: 'Free Shipping', price: 0, estimatedDays: 'Same Day / Next Day', isFree: true }],
      recommended: { id: 'free', name: 'Free Shipping', price: 0, estimatedDays: 'Same Day / Next Day', isFree: true },
    };
  }

  // Find matching zone and pick cheapest active rate
  const zones = await adminGetShippingZones();
  const zone = zones.find(z => z.isActive && z.governorates?.some(g =>
    g.toLowerCase().includes((governorate || '').toLowerCase()) ||
    (governorate || '').toLowerCase().includes(g.toLowerCase().split(' ')[0])
  ));

  const activeRates = (zone?.rates || []).filter((r: any) => r.isActive);
  const options = activeRates.length > 0
    ? activeRates.map((r: any) => ({
        id: r.id,
        name: r.name,
        price: r.basePrice,
        estimatedDays: r.estimatedDays,
        isFree: orderAmount >= (r.freeAboveAmount || Infinity),
      }))
    : [{ id: 'standard', name: 'Standard Delivery', price: SITE_CONFIG.defaultShippingCost, estimatedDays: '2-4 days', isFree: false }];

  return { options, recommended: options[0] };
}
