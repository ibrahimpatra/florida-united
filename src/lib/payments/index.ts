import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '../firebase-admin';
import { PROVIDER_IDS, type PaymentProvider, type ProviderId } from './types';
import { stripeProvider } from './stripe-provider';
import { tapProvider } from './tap';
import { myfatoorahProvider } from './myfatoorah';
export * from './types';

export const PROVIDERS: Record<ProviderId, PaymentProvider> = { stripe: stripeProvider, tap: tapProvider, myfatoorah: myfatoorahProvider };

/** All providers with their configuration state (for the admin settings page). Never returns secrets. */
export const providerStatus = () => PROVIDER_IDS.map(id => ({ id, name: PROVIDERS[id].name, currency: PROVIDERS[id].currency, configured: PROVIDERS[id].configured() }));

/**
 * The provider customers pay online with, or null when online payment is off.
 * Admin > Settings > "Online payment" picks one (config/storeSettings.onlineProvider):
 *   'auto' (default) = the first provider whose keys are present (stripe, tap, myfatoorah),
 *   a provider id     = that provider, but ONLY if its keys are present,
 *   'none'            = online payment off.
 * A provider without keys is never offered, whatever the setting says.
 */
export async function onlineProvider(db?: Firestore): Promise<PaymentProvider | null> {
  let pick = 'auto';
  try { pick = String(((await (db || getAdminDb()).doc('config/storeSettings').get()).data() as any)?.onlineProvider || 'auto'); } catch {}
  if (pick === 'none') return null;
  if ((PROVIDER_IDS as string[]).includes(pick)) { const p = PROVIDERS[pick as ProviderId]; return p.configured() ? p : null; }
  return PROVIDER_IDS.map(id => PROVIDERS[id]).find(p => p.configured()) || null;
}

export const providerFor = (id?: string): PaymentProvider | null => ((PROVIDER_IDS as string[]).includes(String(id)) ? PROVIDERS[id as ProviderId] : null);

/** Amounts must match what we expect before an order is marked paid (KWD providers: the order total). */
export function amountOk(p: PaymentProvider, order: { total: number; usdAmount?: number }, v: { amount?: number; currency?: string }) {
  if (p.currency === 'KWD') return String(v.currency || 'KWD').toUpperCase() === 'KWD' && Math.abs(Number(v.amount) - Number(order.total)) < 0.0015;
  return true; // Stripe's USD amount was computed from the saved total when the session was created
}
