import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { onlineProvider, providerStatus } from '../src/lib/payments';
import { settleOrderPayment } from '../src/lib/payments/settle';
import { tapProvider } from '../src/lib/payments/tap';

let db: FakeDb; const realFetch = global.fetch; const ENV = ['STRIPE_SECRET_KEY', 'TAP_SECRET_KEY', 'MYFATOORAH_API_KEY'];
const saved: Record<string, string | undefined> = {};
beforeEach(() => { db = new FakeDb(); __setAdminDbForTests(db); for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { global.fetch = realFetch; for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

test('no keys: no provider is offered, so checkout hides the card option', async () => {
  assert.equal(await onlineProvider(db as any), null);
  assert.ok(providerStatus().every(p => !p.configured));
});
test('auto picks the first configured provider; a chosen provider without keys is never offered; none switches it off', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_x';
  assert.equal((await onlineProvider(db as any))?.id, 'tap');
  db.seed('config', 'storeSettings', { onlineProvider: 'myfatoorah' });
  assert.equal(await onlineProvider(db as any), null);
  db.seed('config', 'storeSettings', { onlineProvider: 'none' });
  assert.equal(await onlineProvider(db as any), null);
});
test('tap start sends KWD amount and returns the payment page', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_x'; let body: any;
  global.fetch = (async (_u: any, init: any) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ id: 'chg_1', transaction: { url: 'https://pay/x' } }), { status: 200 }); }) as any;
  const r = await tapProvider.start({ id: 'o1', orderNumber: 'N1', total: 12.5, userName: 'Ali K' }, { appUrl: 'a', returnUrl: 'https://s/return', cancelUrl: 'c' });
  assert.equal(r.url, 'https://pay/x'); assert.equal(body.currency, 'KWD'); assert.equal(body.amount, 12.5); assert.equal(body.redirect.url, 'https://s/return');
});
const seedOrder = (o: any = {}) => db.seed('orders', 'o1', { orderNumber: 'N1', paymentMethod: 'card', paymentStatus: 'pending', orderStatus: 'pending', status: 'pending', paymentProvider: 'tap', paymentRef: 'chg_1', total: 12.5, items: [], ...o });
const tapSays = (c: any) => { global.fetch = (async () => new Response(JSON.stringify(c), { status: 200 })) as any; };

test('settle: captured charge for this order and amount marks it paid, once', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_x'; seedOrder();
  tapSays({ id: 'chg_1', status: 'CAPTURED', amount: 12.5, currency: 'KWD', reference: { transaction: 'o1' } });
  const r = await settleOrderPayment('o1', 'chg_1'); assert.equal(r.paid, true);
  assert.equal(db.read('orders', 'o1').paymentStatus, 'paid');
  assert.equal((await settleOrderPayment('o1')).already, true);
});
test('settle: wrong amount, other order, or not captured never marks paid', async () => {
  process.env.TAP_SECRET_KEY = 'sk_test_x';
  for (const c of [{ status: 'CAPTURED', amount: 1, currency: 'KWD', reference: { transaction: 'o1' } },
    { status: 'CAPTURED', amount: 12.5, currency: 'KWD', reference: { transaction: 'other' } },
    { status: 'DECLINED', amount: 12.5, currency: 'KWD', reference: { transaction: 'o1' } }]) {
    seedOrder(); tapSays({ id: 'chg_1', ...c });
    assert.equal((await settleOrderPayment('o1')).paid, false); assert.equal(db.read('orders', 'o1').paymentStatus, 'pending');
  }
});
