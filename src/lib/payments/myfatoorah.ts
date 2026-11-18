import type { PaymentProvider } from './types';

/**
 * MyFatoorah (Kuwait). Charged in KWD.
 * Env: MYFATOORAH_API_KEY (token), MYFATOORAH_BASE_URL (default https://api.myfatoorah.com; test: https://apitest.myfatoorah.com)
 */
const base = () => (process.env.MYFATOORAH_BASE_URL || 'https://api.myfatoorah.com').replace(/\/$/, '');
const key = () => process.env.MYFATOORAH_API_KEY || '';

async function mf(path: string, body: any) {
  const res = await fetch(`${base()}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j?.IsSuccess === false) throw new Error(`MyFatoorah ${res.status}: ${j?.Message || j?.ValidationErrors?.[0]?.Error || 'request failed'}`);
  return j;
}

export const myfatoorahProvider: PaymentProvider = {
  id: 'myfatoorah', name: 'MyFatoorah', currency: 'KWD',
  configured: () => !!key(),
  async start(o, ctx) {
    const phone = String(o.phone || '').replace(/\D/g, '').replace(/^965/, '').slice(0, 11);
    const j = await mf('/v2/SendPayment', {
      CustomerName: o.userName || 'Customer', NotificationOption: 'LNK', InvoiceValue: Number(o.total.toFixed(3)), DisplayCurrencyIso: 'KWD',
      CustomerEmail: o.contactEmail || o.userEmail || undefined, ...(phone ? { MobileCountryCode: '+965', CustomerMobile: phone } : {}),
      CallBackUrl: ctx.returnUrl, ErrorUrl: ctx.cancelUrl, Language: 'en',
      CustomerReference: o.id, UserDefinedField: o.orderNumber,
    });
    const d = j?.Data;
    if (!d?.InvoiceURL || !d?.InvoiceId) throw new Error('MyFatoorah did not return a payment page.');
    return { url: d.InvoiceURL, ref: String(d.InvoiceId) };
  },
  async verify(o) {
    const id = o.paymentRef;
    if (!id) return { paid: false };
    const j = await mf('/v2/GetPaymentStatus', { Key: id, KeyType: 'InvoiceId' });
    const d = j?.Data || {};
    const status = String(d.InvoiceStatus || '');
    return {
      paid: status === 'Paid', failed: status === 'Expired' || status === 'Canceled',
      ref: String(d.InvoiceId || id), amount: Number(d.InvoiceValue), currency: 'KWD',
      extra: { matches: String(d.CustomerReference || '') === o.id },
    };
  },
};
