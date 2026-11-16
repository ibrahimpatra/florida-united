/** Validation/normalisation for shipping zones + config. Server-only helpers (pure). */
import { canonicalGovernorate } from './pricing';

export class ValidationError extends Error {}

const num = (v: any, label: string, { min = 0, optional = false } = {}): number | undefined => {
  if (v === undefined || v === null || v === '') {
    if (optional) return undefined;
    throw new ValidationError(`${label} is required.`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new ValidationError(`${label} must be a number ${min === 0 ? 'of 0 or more' : `≥ ${min}`}.`);
  return Math.round(n * 1000) / 1000;
};
const str = (v: any, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function normalizeZone(input: any) {
  if (!input || typeof input !== 'object') throw new ValidationError('Invalid zone data.');
  const name = str(input.name, 120);
  if (!name) throw new ValidationError('Zone name is required.');
  const govs = Array.from(new Set((Array.isArray(input.governorates) ? input.governorates : [])
    .map((g: string) => canonicalGovernorate(g)).filter(Boolean))) as string[];
  const isActive = input.isActive !== false;
  if (isActive && govs.length === 0) throw new ValidationError('Select at least one governorate for this zone (checkout matches zones by governorate).');
  const rawRates = Array.isArray(input.rates) ? input.rates : [];
  if (isActive && rawRates.filter((r: any) => r?.isActive !== false).length === 0)
    throw new ValidationError('Add at least one active delivery rate.');
  const seen = new Set<string>();
  const rates = rawRates.map((r: any, i: number) => {
    const rname = str(r?.name, 120);
    if (!rname) throw new ValidationError(`Rate #${i + 1} needs a name.`);
    let id = str(r?.id, 40) || Math.random().toString(36).slice(2, 10);
    while (seen.has(id)) id += 'x';
    seen.add(id);
    const method = r?.method === 'free' ? 'free' : 'flat';
    const basePrice = method === 'free' ? 0 : num(r?.basePrice, `Rate "${rname}" price`)!;
    const out: any = {
      id, name: rname, method, estimatedDays: str(r?.estimatedDays, 40) || '2-4',
      isActive: r?.isActive !== false, basePrice,
    };
    const nameAr = str(r?.nameAr, 120); if (nameAr) out.nameAr = nameAr;
    const carrier = str(r?.carrier, 80); if (carrier) out.carrier = carrier;
    const badge = str(r?.badge, 30); if (badge) out.badge = badge;
    const free = num(r?.freeAboveAmount, `Rate "${rname}" free-above amount`, { optional: true });
    if (free !== undefined && free > 0) out.freeAboveAmount = free;
    return out;
  });
  const zone: any = {
    name, type: 'governorate', isActive, governorates: govs, rates,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
    description: str(input.description, 300),
  };
  const nameAr = str(input.nameAr, 120); zone.nameAr = nameAr; // '' clears it on edit
  return zone;
}

/** A governorate may belong to only one ACTIVE zone, otherwise the winner would be arbitrary. */
export function findGovernorateConflict(zone: any, others: any[]): string | null {
  if (!zone.isActive) return null;
  for (const o of others) {
    if (!o.isActive) continue;
    const overlap = (o.governorates || []).map((g: string) => canonicalGovernorate(g)).filter((g: string | null) => g && zone.governorates.includes(g));
    if (overlap.length) return `${overlap[0]} is already covered by the active zone "${o.name}". Remove it there first.`;
  }
  return null;
}

export function normalizeShippingConfig(input: any) {
  if (!input || typeof input !== 'object') throw new ValidationError('Invalid configuration.');
  const out: any = {};
  const n = (k: string, label: string, opts?: any) => { if (k in input) { const v = num(input[k], label, opts); if (v !== undefined) out[k] = v; } };
  n('defaultFreeShippingThreshold', 'Free shipping threshold');
  n('defaultShippingCost', 'Default shipping cost');
  n('handlingFee', 'Handling fee');
  n('codFee', 'COD fee');
  if ('codEnabled' in input) out.codEnabled = !!input.codEnabled;
  if ('localPickupEnabled' in input) out.localPickupEnabled = !!input.localPickupEnabled;
  for (const k of ['storeAddress', 'localPickupAddress', 'localPickupInstructions']) if (k in input) out[k] = str(input[k], 400);
  for (const k of ['storeLat', 'storeLng']) if (k in input && input[k] !== '' && input[k] != null) {
    const v = Number(input[k]); if (!Number.isFinite(v)) throw new ValidationError(`${k} must be a number.`); out[k] = v;
  }
  out.currency = 'KWD';
  return out;
}
