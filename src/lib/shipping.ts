// src/lib/shipping.ts — Kuwait-focused shipping types

export type ShippingMethod = 'flat' | 'weight' | 'price_based' | 'free' | 'local_pickup';
export type ZoneType = 'governorate' | 'area' | 'radius' | 'country';

export interface ShippingZone {
  id: string;
  name: string;
  description?: string;
  type: ZoneType;
  isActive: boolean;
  sortOrder: number;
  // Governorate-based (primary for Kuwait)
  governorates?: string[]; // e.g. ['Capital', 'Hawalli']
  // Area-based (district level)
  areas?: string[];
  // Radius-based
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  // Country-based
  countries?: string[];
  rates: ShippingRate[];
  createdAt: string;
  updatedAt: string;
}

export interface ShippingRate {
  id: string;
  name: string;
  method: ShippingMethod;
  carrier?: string;
  estimatedDays: string; // e.g. 'Same Day', '1-2', 'Next Day'
  isActive: boolean;
  minOrderAmount?: number; // KWD
  maxOrderAmount?: number;
  minWeight?: number; // kg
  maxWeight?: number;
  basePrice: number; // KWD
  perKgPrice?: number;
  freeAboveAmount?: number; // KWD — free if order >= this
  icon?: string;
  badge?: string;
}

export interface ShippingConfig {
  id: string;
  storeLat: number;
  storeLng: number;
  storeAddress: string;
  currency: string; // 'KWD'
  defaultFreeShippingThreshold: number; // KWD
  handlingFee: number;
  localPickupEnabled: boolean;
  localPickupAddress?: string;
  localPickupInstructions?: string;
  codEnabled: boolean;
  codFee: number; // extra fee for COD
  createdAt: string;
  updatedAt: string;
}

// ─── UOM Types ────────────────────────────────────────────────
export type UOMCategory = 'length' | 'weight' | 'volume' | 'area' | 'count' | 'electrical' | 'pack';

export interface UOM {
  id: string;
  name: string;
  abbreviation: string;
  category: UOMCategory;
  isBase: boolean;
  conversionFactor?: number;
  baseUOMId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProductUOM {
  uomId: string;
  uomName: string;
  uomAbbr: string;
  priceMultiplier: number;
  stockMultiplier: number;
  minOrderQty: number;
  maxOrderQty?: number;
  stepQty: number;
  isDefault: boolean;
  label?: string;
}

// ─── Variant Types ─────────────────────────────────────────────
export type VariantType = 'size' | 'color' | 'material' | 'gauge' | 'amperage' | 'voltage' | 'length' | 'pack_size' | 'custom';

export interface VariantOption {
  id: string;
  value: string;
  label?: string;
  priceAdjustment: number;
  stockQty: number;
  sku?: string;
  image?: string;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ProductVariantGroup {
  id: string;
  type: VariantType;
  name: string;
  required: boolean;
  displayType: 'dropdown' | 'buttons' | 'color_swatches' | 'image_buttons';
  options: VariantOption[];
}

// ─── Flash Deal Types ─────────────────────────────────────────
export interface FlashDeal {
  id: string;
  title: string;
  subtitle?: string;
  badgeText: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'bundle';
  discountValue: number;
  scope: 'all' | 'category' | 'products';
  categoryIds?: string[];
  productIds?: string[];
  startAt: string;
  endAt: string;
  image?: string;
  bannerColor: string;
  showCountdown: boolean;
  showOnHomepage: boolean;
  showOnProductPage: boolean;
  minCartAmount?: number;
  maxUsesTotal?: number;
  maxUsesPerUser?: number;
  usedCount: number;
  isActive: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Shipping Calculation ─────────────────────────────────────
export interface ShippingInput {
  governorate?: string;
  area?: string;
  country?: string;
  lat?: number;
  lng?: number;
  orderAmount: number; // KWD
  orderWeightKg?: number;
  paymentMethod?: 'tap' | 'cod';
}

export interface ShippingOption {
  rateId: string;
  zoneId: string;
  zoneName: string;
  name: string;
  carrier?: string;
  estimatedDays: string;
  price: number; // KWD
  originalPrice?: number;
  isFree: boolean;
  badge?: string;
  icon?: string;
  method: ShippingMethod;
}

export interface ShippingCalculationResult {
  options: ShippingOption[];
  defaultOption?: ShippingOption;
  freeShippingThreshold?: number;
  amountToFreeShipping?: number;
  localPickupAvailable: boolean;
  localPickupAddress?: string;
  codAvailable: boolean;
  codFee: number;
  zoneMatched?: string;
}
