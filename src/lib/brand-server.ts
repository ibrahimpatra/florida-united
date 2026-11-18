import { getAdminDb } from './firebase-admin';
import { mergeBrand, DEFAULT_BRAND, type Brand } from './brand';

let cache: { at: number; brand: Brand } | null = null;

/** Brand for server code (layout, emails, invoices, WhatsApp, the assistant). Cached for 30 seconds. */
export async function getBrand(): Promise<Brand> {
  if (cache && Date.now() - cache.at < 30_000) return cache.brand;
  try {
    const snap = await getAdminDb().doc('config/storeSettings').get();
    const brand = mergeBrand(snap.exists ? snap.data() : {});
    cache = { at: Date.now(), brand };
    return brand;
  } catch {
    return cache?.brand || DEFAULT_BRAND;
  }
}
export const clearBrandCache = () => { cache = null; };
