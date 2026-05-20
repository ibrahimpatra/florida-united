// src/lib/shippingService.ts — Kuwait shipping service
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  deleteDoc, setDoc, query, orderBy, where, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { ShippingZone, ShippingConfig, ShippingInput, ShippingCalculationResult, ShippingOption, UOM, FlashDeal } from './shipping';

const toData = <T>(snap: any): T | null => {
  if (!snap.exists()) return null;
  const convert = (obj: any): any =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [
      k,
      v instanceof Timestamp ? v.toDate().toISOString()
        : v && typeof v === 'object' && !Array.isArray(v) ? convert(v) : v
    ]));
  return { id: snap.id, ...convert(snap.data()) } as T;
};

// ─── Haversine distance (km) ──────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Shipping Config ──────────────────────────────────────────
export async function getShippingConfig(): Promise<ShippingConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'shipping'));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ShippingConfig;
  } catch { return null; }
}

export async function saveShippingConfig(config: Partial<ShippingConfig>): Promise<void> {
  await setDoc(doc(db, 'settings', 'shipping'), {
    ...config,
    updatedAt: serverTimestamp(),
    createdAt: config.createdAt || serverTimestamp(),
  }, { merge: true });
}

// ─── Shipping Zones ───────────────────────────────────────────
export async function getShippingZones(): Promise<ShippingZone[]> {
  const snap = await getDocs(query(collection(db, 'shippingZones'), orderBy('sortOrder', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShippingZone));
}

export async function createShippingZone(zone: Omit<ShippingZone, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'shippingZones'), {
    ...zone, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateShippingZone(id: string, data: Partial<ShippingZone>): Promise<void> {
  await updateDoc(doc(db, 'shippingZones', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteShippingZone(id: string): Promise<void> {
  await deleteDoc(doc(db, 'shippingZones', id));
}

// ─── Main Shipping Calculator ─────────────────────────────────
export async function calculateShipping(input: ShippingInput): Promise<ShippingCalculationResult> {
  const [zones, config] = await Promise.all([getShippingZones(), getShippingConfig()]);
  const activeZones = zones.filter(z => z.isActive);
  const matchedOptions: ShippingOption[] = [];
  let matchedZoneName = '';

  for (const zone of activeZones) {
    let matches = false;

    switch (zone.type) {
      case 'governorate':
        if (input.governorate && zone.governorates?.some(g =>
          g.toLowerCase().includes(input.governorate!.toLowerCase()) ||
          input.governorate!.toLowerCase().includes(g.toLowerCase())
        )) matches = true;
        break;
      case 'area':
        if (input.area && zone.areas?.map(a => a.toLowerCase()).includes(input.area.toLowerCase())) matches = true;
        break;
      case 'radius':
        if (input.lat && input.lng && zone.centerLat && zone.centerLng && zone.radiusKm) {
          const dist = haversineKm(zone.centerLat, zone.centerLng, input.lat, input.lng);
          if (dist <= zone.radiusKm) matches = true;
        }
        break;
      case 'country':
        if (input.country && zone.countries?.map(c => c.toLowerCase()).includes(input.country.toLowerCase())) matches = true;
        break;
    }

    if (!matches) continue;
    matchedZoneName = zone.name;

    for (const rate of zone.rates) {
      if (!rate.isActive) continue;
      if (rate.minOrderAmount !== undefined && input.orderAmount < rate.minOrderAmount) continue;
      if (rate.maxOrderAmount !== undefined && input.orderAmount > rate.maxOrderAmount) continue;
      if (rate.minWeight !== undefined && (input.orderWeightKg || 0) < rate.minWeight) continue;
      if (rate.maxWeight !== undefined && (input.orderWeightKg || 0) > rate.maxWeight) continue;

      let price = rate.basePrice;
      if (rate.freeAboveAmount !== undefined && input.orderAmount >= rate.freeAboveAmount) price = 0;
      if (rate.method === 'weight' && rate.perKgPrice && input.orderWeightKg) {
        price += input.orderWeightKg * rate.perKgPrice;
      }

      matchedOptions.push({
        rateId: rate.id,
        zoneId: zone.id,
        zoneName: zone.name,
        name: rate.name,
        carrier: rate.carrier,
        estimatedDays: rate.estimatedDays,
        price: Math.max(0, parseFloat(price.toFixed(3))),
        isFree: price === 0,
        badge: price === 0 ? 'FREE' : rate.badge,
        icon: rate.icon,
        method: rate.method,
      });
    }
    break; // first matching zone wins
  }

  const globalThreshold = config?.defaultFreeShippingThreshold ?? 10; // KWD 10
  const amountToFree = Math.max(0, globalThreshold - input.orderAmount);

  if (matchedOptions.length === 0) {
    const isFree = input.orderAmount >= globalThreshold;
    matchedOptions.push({
      rateId: 'default-standard',
      zoneId: 'default',
      zoneName: 'Kuwait Standard',
      name: 'Standard Delivery',
      estimatedDays: '1-3',
      price: isFree ? 0 : 1.500,
      isFree,
      badge: isFree ? 'FREE' : undefined,
      method: 'flat',
    });
  }

  matchedOptions.sort((a, b) => a.price - b.price);

  // If every item in the cart has freeShipping=true, override all prices to 0
  if (input.allItemsFreeShipping) {
    for (const opt of matchedOptions) {
      opt.price   = 0;
      opt.isFree  = true;
      opt.badge   = 'FREE';
    }
  }

  return {
    options: matchedOptions,
    defaultOption: matchedOptions[0],
    freeShippingThreshold: globalThreshold,
    amountToFreeShipping: amountToFree,
    localPickupAvailable: config?.localPickupEnabled ?? false,
    localPickupAddress: config?.localPickupAddress,
    codAvailable: config?.codEnabled ?? true,
    codFee: config?.codFee ?? 0,
    zoneMatched: matchedZoneName || undefined,
  };
}

// ─── UOM Service ──────────────────────────────────────────────
export async function getUOMs(): Promise<UOM[]> {
  const snap = await getDocs(query(collection(db, 'uoms'), where('isActive', '==', true), orderBy('category')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UOM));
}

export async function getAllUOMs(): Promise<UOM[]> {
  const snap = await getDocs(query(collection(db, 'uoms'), orderBy('category')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UOM));
}

export async function createUOM(data: Omit<UOM, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'uoms'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateUOM(id: string, data: Partial<UOM>): Promise<void> {
  await updateDoc(doc(db, 'uoms', id), data);
}

export async function deleteUOM(id: string): Promise<void> {
  await deleteDoc(doc(db, 'uoms', id));
}

// ─── Flash Deals ──────────────────────────────────────────────
export async function getAllFlashDeals(): Promise<FlashDeal[]> {
  const snap = await getDocs(query(collection(db, 'flashDeals'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => {
    const data = d.data();
    return { id: d.id, ...data,
      startAt: data.startAt?.toDate?.()?.toISOString?.() || data.startAt,
      endAt: data.endAt?.toDate?.()?.toISOString?.() || data.endAt,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
    } as FlashDeal;
  });
}

export async function getFlashDealById(id: string): Promise<FlashDeal | null> {
  const snap = await getDoc(doc(db, 'flashDeals', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data,
    startAt: data.startAt?.toDate?.()?.toISOString?.() || data.startAt,
    endAt: data.endAt?.toDate?.()?.toISOString?.() || data.endAt,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
  } as FlashDeal;
}

export async function getActiveFlashDeals(): Promise<FlashDeal[]> {
  const now = new Date().toISOString();
  const snap = await getDocs(query(
    collection(db, 'flashDeals'),
    where('isActive', '==', true),
    orderBy('isPinned', 'desc'),
    orderBy('startAt', 'asc')
  ));
  return snap.docs.map(d => {
    const data = d.data();
    return { id: d.id, ...data,
      startAt: data.startAt?.toDate?.()?.toISOString?.() || data.startAt,
      endAt: data.endAt?.toDate?.()?.toISOString?.() || data.endAt,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
    } as FlashDeal;
  }).filter(d => d.startAt <= now && d.endAt >= now);
}

export async function createFlashDeal(data: Omit<FlashDeal, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'flashDeals'), {
    ...data, usedCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateFlashDeal(id: string, data: Partial<FlashDeal>): Promise<void> {
  await updateDoc(doc(db, 'flashDeals', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteFlashDeal(id: string): Promise<void> {
  await deleteDoc(doc(db, 'flashDeals', id));
}

export function applyFlashDeal(originalPrice: number, deal: FlashDeal, productId?: string, categoryId?: string) {
  if (deal.scope === 'products' && productId && !deal.productIds?.includes(productId)) return null;
  if (deal.scope === 'category' && categoryId && !deal.categoryIds?.includes(categoryId)) return null;
  let finalPrice = originalPrice;
  if (deal.type === 'percentage') finalPrice = originalPrice * (1 - deal.discountValue / 100);
  else if (deal.type === 'fixed') finalPrice = Math.max(0, originalPrice - deal.discountValue);
  finalPrice = Math.round(finalPrice * 1000) / 1000; // KWD 3 decimal places
  return { finalPrice, savings: originalPrice - finalPrice, appliedDeal: deal };
}

// Kuwait hardware store UOM seed data
export const DEFAULT_UOMS: Omit<UOM, 'id' | 'createdAt'>[] = [
  // Count / Pack
  { name: 'Piece', abbreviation: 'pc', category: 'count', isBase: true, isActive: true },
  { name: 'Pair', abbreviation: 'pr', category: 'count', isBase: false, conversionFactor: 2, isActive: true },
  { name: 'Box', abbreviation: 'box', category: 'pack', isBase: false, conversionFactor: 1, isActive: true },
  { name: 'Pack of 10', abbreviation: 'pk10', category: 'pack', isBase: false, conversionFactor: 10, isActive: true },
  { name: 'Pack of 50', abbreviation: 'pk50', category: 'pack', isBase: false, conversionFactor: 50, isActive: true },
  { name: 'Pack of 100', abbreviation: 'pk100', category: 'pack', isBase: false, conversionFactor: 100, isActive: true },
  { name: 'Dozen', abbreviation: 'doz', category: 'count', isBase: false, conversionFactor: 12, isActive: true },
  { name: 'Roll', abbreviation: 'roll', category: 'count', isBase: false, conversionFactor: 1, isActive: true },
  { name: 'Coil', abbreviation: 'coil', category: 'count', isBase: false, conversionFactor: 1, isActive: true },
  { name: 'Bundle', abbreviation: 'bndl', category: 'count', isBase: false, conversionFactor: 1, isActive: true },
  { name: 'Pallet', abbreviation: 'plt', category: 'count', isBase: false, conversionFactor: 1, isActive: true },
  // Length (metric for Kuwait)
  { name: 'Meter', abbreviation: 'm', category: 'length', isBase: true, isActive: true },
  { name: 'Centimeter', abbreviation: 'cm', category: 'length', isBase: false, conversionFactor: 0.01, isActive: true },
  { name: 'Millimeter', abbreviation: 'mm', category: 'length', isBase: false, conversionFactor: 0.001, isActive: true },
  { name: '5 Meters', abbreviation: '5m', category: 'length', isBase: false, conversionFactor: 5, isActive: true },
  { name: '10 Meters', abbreviation: '10m', category: 'length', isBase: false, conversionFactor: 10, isActive: true },
  { name: '25 Meters', abbreviation: '25m', category: 'length', isBase: false, conversionFactor: 25, isActive: true },
  { name: '50 Meters', abbreviation: '50m', category: 'length', isBase: false, conversionFactor: 50, isActive: true },
  { name: '100 Meters', abbreviation: '100m', category: 'length', isBase: false, conversionFactor: 100, isActive: true },
  // Weight (metric)
  { name: 'Kilogram', abbreviation: 'kg', category: 'weight', isBase: true, isActive: true },
  { name: 'Gram', abbreviation: 'g', category: 'weight', isBase: false, conversionFactor: 0.001, isActive: true },
  { name: 'Ton', abbreviation: 'ton', category: 'weight', isBase: false, conversionFactor: 1000, isActive: true },
  // Area
  { name: 'Square Meter', abbreviation: 'sqm', category: 'area', isBase: true, isActive: true },
  { name: 'Square Centimeter', abbreviation: 'sqcm', category: 'area', isBase: false, conversionFactor: 0.0001, isActive: true },
  // Electrical (hardware store)
  { name: 'Ampere', abbreviation: 'A', category: 'electrical', isBase: true, isActive: true },
  { name: 'Kilowatt', abbreviation: 'kW', category: 'electrical', isBase: false, conversionFactor: 1, isActive: true },
  { name: 'Volt', abbreviation: 'V', category: 'electrical', isBase: false, conversionFactor: 1, isActive: true },
  { name: 'Watt', abbreviation: 'W', category: 'electrical', isBase: false, conversionFactor: 0.001, isActive: true },
];