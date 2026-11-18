import type { PaymentProvider } from './types';

/** Tap Payments (Kuwait). Charged in KWD. Env: TAP_SECRET_KEY (sk_test_... or sk_live_...). */
const BASE = 'https://api.tap.company/v2';
const key = () => process.env.TAP_SECRET_KEY || '';

async function tap(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Tap ${res.status}: ${body?.errors?.[0]?.description || body?.message || 'request failed'}`);
  return body;
}

export const tapProvider: PaymentProvider = {
  id: 'tap', name: 'Tap', currency: 'KWD',
  configured: () => !!key(),
  async start(o, ctx) {
    const [first, ...rest] = String(o.userName || 'Customer').split(' ');
    const phone = String(o.phone || '').replace(/\D/g, '').replace(/^965/, '');
    const charge = await tap('/charges', { method: 'POST', body: JSON.stringify({
      amount: Number(o.total.toFixed(3)), currency: 'KWD', threeDSecure: true, save_card: false,
      description: `Order ${o.orderNumber}`, reference: { transaction: o.id, order: o.orderNumber },
      receipt: { email: false, sms: false },
      customer: { first_name: first || 'Customer', last_name: rest.join(' ') || '-', email: o.contactEmail || o.userEmail || undefined, ...(phone ? { phone: { country_code: '965', number: phone } } : {}) },
      source: { id: 'src_all' }, redirect: { url: ctx.returnUrl },
    }) });
    const url = charge?.transaction?.url;
    if (!charge?.id || !url) throw new Error('Tap did not return a payment page.');
    return { url, ref: charge.id };
  },
  async verify(o, hint) {
    const id = hint || o.paymentRef;
    if (!id) return { paid: false };
    const c = await tap(`/charges/${encodeURIComponent(id)}`);
    const status = String(c.status || '').toUpperCase();
    return {
      paid: status === 'CAPTURED', failed: ['DECLINED', 'FAILED', 'CANCELLED', 'ABANDONED', 'VOID', 'TIMEDOUT', 'RESTRICTED'].includes(status),
      ref: c.id, amount: Number(c.amount), currency: String(c.currency || ''),
      // the charge must belong to THIS order
      extra: { matches: c?.reference?.transaction === o.id },
    };
  },
};
