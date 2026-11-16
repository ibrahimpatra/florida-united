import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { placeOrder, cancelOrder, markOrderPaid, quoteShipping, restockItems, OrderError } from '../src/lib/orders-server';

let db: FakeDb;
const FUT = new Date(Date.now() + 86400000).toISOString(), PAST = new Date(Date.now() - 86400000).toISOString();
const addr = { firstName: 'Ali', lastName: 'K', phone: '55512345', governorate: 'Hawalli', city: 'Hawalli', block: '1', street: '2', building: '3' };
const input = (items: any[], o: any = {}) => ({ userId: 'u1', userEmail: 'a@b.com', userName: 'Ali', items, shippingAddress: addr, paymentMethod: 'cod' as const, ...o });
const product = (o: any = {}) => ({ name: 'Cable', sku: 'C1', price: 10, stock: 100, isActive: true, categoryId: 'cat1', categoryName: 'Cables', isReturnable: true, ...o });
const stock = (id: string) => db.read('products', id).stock;

beforeEach(() => {
  db = new FakeDb(); __setAdminDbForTests(db);
  db.seed('products', 'p1', product());
  db.seed('products', 'p2', product({ name: 'Box', sku: 'B1', price: 4, stock: 20, units: [{ id: 'u12', name: 'Carton of 12', nameAr: 'كرتون 12', factor: 12, price: 40 }] }));
  db.seed('shippingZones', 'z1', { name: 'Capital', isActive: true, governorates: ['Hawalli'], rates: [{ id: 'r1', name: 'Std', basePrice: 2, estimatedDays: '1-2', isActive: true }] });
  db.seed('config', 'storeSettings', { freeShippingThreshold: 1000 });
});

test('plain order: server price, stock reserved, items stored', async () => {
  const r: any = await placeOrder(input([{ productId: 'p1', quantity: 3, price: 0.001 }]));
  const o = db.read('orders', r.orderId || r.id);
  assert.equal(o.subtotal, 30); assert.equal(o.total, 32); assert.equal(stock('p1'), 97);
  assert.equal(o.items[0].productName, 'Cable'); assert.equal(o.paymentMethod, 'cod');
});
test('selling unit: price comes from the server, stock reserved in base units', async () => {
  const r: any = await placeOrder(input([{ productId: 'p2', quantity: 1, variantId: 'u12', variantName: 'cheat', price: 0.001 }]));
  const o = db.read('orders', r.orderId || r.id);
  assert.equal(o.items[0].total, 40); assert.equal(o.items[0].unitFactor, 12); assert.equal(o.items[0].variantName, 'Carton of 12'); assert.equal(stock('p2'), 8);
});
test('cannot oversell: 2 cartons need 24 base units but only 20 exist', async () => {
  await assert.rejects(() => placeOrder(input([{ productId: 'p2', quantity: 2, variantId: 'u12' }])), (e: any) => e instanceof OrderError && e.status === 409);
  assert.equal(stock('p2'), 20);
});
test('one carton works and cancel puts 12 units back', async () => {
  const r: any = await placeOrder(input([{ productId: 'p2', quantity: 1, variantId: 'u12' }]));
  assert.equal(stock('p2'), 8);
  await cancelOrder({ orderId: r.orderId || r.id, actor: { id: 'u1', role: 'customer' } as any, note: 't' });
  assert.equal(stock('p2'), 20);
});
test('flash deal: discount applied by the server, usage counted, released on cancel', async () => {
  db.seed('flashDeals', 'd1', { title: 'Sale', type: 'percentage', discountValue: 20, scope: 'all', startAt: PAST, endAt: FUT, isActive: true, maxUsesTotal: 5, usedCount: 0 });
  const q: any = await quoteShipping([{ productId: 'p1', quantity: 2 }], 'Hawalli', 'u1');
  assert.equal(q.subtotal, 16); assert.equal(q.dealSaving, 4);
  const r: any = await placeOrder(input([{ productId: 'p1', quantity: 2 }]));
  const id = r.orderId || r.id; const o = db.read('orders', id);
  assert.equal(o.subtotal, 16); assert.equal(o.dealDiscount, 4); assert.equal(o.items[0].listPrice, 10); assert.equal(o.items[0].price, 8);
  assert.equal(db.read('flashDeals', 'd1').usedCount, 1); assert.equal(db.read('flashDealUsage', 'd1_u1').count, 1);
  await cancelOrder({ orderId: id, actor: { id: 'u1', role: 'customer' } as any, note: 't' });
  assert.equal(db.read('flashDeals', 'd1').usedCount, 0); assert.equal(db.read('flashDealUsage', 'd1_u1').count, 0);
});
test('flash deal limits: per-customer limit blocks the deal, sold-out deal is ignored', async () => {
  db.seed('flashDeals', 'd1', { title: 'One each', type: 'percentage', discountValue: 50, scope: 'all', startAt: PAST, endAt: FUT, isActive: true, maxUsesPerUser: 1 });
  await placeOrder(input([{ productId: 'p1', quantity: 1 }]));
  const second: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }]));
  assert.equal(db.read('orders', second.orderId || second.id).subtotal, 10); // no deal the second time
  db.seed('flashDeals', 'd2', { title: 'Gone', type: 'percentage', discountValue: 90, scope: 'all', startAt: PAST, endAt: FUT, isActive: true, maxUsesTotal: 1, usedCount: 1 });
  const q: any = await quoteShipping([{ productId: 'p1', quantity: 1 }], 'Hawalli', 'u2');
  assert.equal(q.subtotal, 5); // d1 (50%) applies to a different customer; d2 is exhausted
});
test('bogo deal: 3 units charged as 2', async () => {
  db.seed('flashDeals', 'd1', { title: '1+1', type: 'bogo', scope: 'products', productIds: ['p1'], startAt: PAST, endAt: FUT, isActive: true });
  const q: any = await quoteShipping([{ productId: 'p1', quantity: 3 }], 'Hawalli');
  assert.equal(q.subtotal, 20);
});
test('card order: pending until markOrderPaid, which is idempotent; late payment on cancelled order flags a refund', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  const r: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }], { paymentMethod: 'card' }));
  const id = r.orderId || r.id;
  assert.equal(db.read('orders', id).paymentStatus, 'pending');
  const a = await markOrderPaid(id, { sessionId: 's1', paymentIntent: 'pi_1', usdAmount: 39 });
  assert.equal(a.already, false); assert.equal(db.read('orders', id).status, 'confirmed'); assert.equal(db.read('orders', id).stripePaymentIntent, 'pi_1');
  assert.equal((await markOrderPaid(id, { sessionId: 's1' })).already, true);
  const r2: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }], { paymentMethod: 'card' }));
  const id2 = r2.orderId || r2.id;
  await cancelOrder({ orderId: id2, actor: { id: 'stripe', role: 'admin' } as any, note: 'expired' });
  await markOrderPaid(id2, { sessionId: 's2' });
  assert.equal(db.read('orders', id2).needsRefund, true);
});
test('cancelling a paid card order marks it refund-needed and restores stock', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  const r: any = await placeOrder(input([{ productId: 'p1', quantity: 5 }], { paymentMethod: 'card' }));
  const id = r.orderId || r.id; await markOrderPaid(id, { paymentIntent: 'pi_9' });
  const c: any = await cancelOrder({ orderId: id, actor: { id: 'u1', role: 'customer' } as any, note: 't' });
  assert.equal(c.needsRefund, true); assert.equal(stock('p1'), 100);
});
test('restockItems: units use their factor, bundles restock components', async () => {
  await restockItems(db as any, [{ productId: 'p2', quantity: 2, unitFactor: 12 }, { productId: 'bundle:x', quantity: 2, bundleItems: [{ productId: 'p1', quantity: 3 }] }]);
  assert.equal(stock('p2'), 44); assert.equal(stock('p1'), 106);
});

import { formatAddress } from '../src/lib/utils';
import { plainOrder } from '../src/lib/orders-server';
import { expireUnpaidCardOrders } from '../src/lib/orders-server';

test('same idempotency key twice creates ONE order and reserves stock once', async () => {
  const a: any = await placeOrder(input([{ productId: 'p1', quantity: 2 }], { idempotencyKey: 'k1' }));
  const b: any = await placeOrder(input([{ productId: 'p1', quantity: 2 }], { idempotencyKey: 'k1' }));
  assert.equal(b.duplicate, true); assert.equal(b.orderId, a.orderId);
  assert.equal(stock('p1'), 98);
  assert.equal([...db.data.get('orders')!.keys()].length, 1);
});
test('saved order has everything My Orders, admin and invoice read', async () => {
  const r: any = await placeOrder(input([{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 1, variantId: 'u12' }], { couponCode: '', contactEmail: 'Other@Mail.com' }));
  const o = db.read('orders', r.orderId);
  assert.match(o.orderNumber, /^[A-Z0-9-]+$/);
  assert.equal(o.status, 'pending'); assert.equal(o.paymentStatus, 'pending'); assert.equal(o.userId, 'u1');
  assert.equal(o.contactEmail, 'other@mail.com'); assert.equal(o.userEmail, 'a@b.com');
  assert.equal(o.shippingAddress.phone, '+96555512345'); assert.equal(o.shippingAddress.governorate, 'Hawalli');
  assert.equal(o.items.length, 2);
  assert.deepEqual(o.items.map((i: any) => [i.productName, i.quantity, i.price, i.total]), [['Cable', 2, 10, 20], ['Box', 1, 40, 40]]);
  assert.equal(o.items[1].variantName, 'Carton of 12'); assert.equal(o.items[1].variantNameAr, 'كرتون 12');
  assert.equal(o.subtotal, 60); assert.equal(o.shippingCost, 2); assert.equal(o.total, 62);
  assert.equal(o.statusHistory[0].status, 'pending');
  assert.equal(r.order.shippingMethod, 'Std'); assert.equal(r.order.total, 62);
  assert.equal(db.read('users', 'u1').orderCount, 1); assert.equal(db.read('users', 'u1').totalSpent, 62);
});
test('address formatter handles new and legacy orders', () => {
  assert.deepEqual(formatAddress({ firstName: 'Ali', lastName: 'K', block: '1', street: '2', building: '3', city: 'Hawalli', governorate: 'Hawalli', phone: '+96555512345' }),
    { name: 'Ali K', line1: 'Block 1, 2, Building 3', line2: 'Hawalli, Hawalli, Kuwait', phone: '+96555512345' });
  assert.equal(formatAddress({ name: 'Old Name', street: 'S', area: 'A', city: 'C' }).line1, 'S, A');
  assert.equal(formatAddress(undefined).name, '');
});
test('orders passed to email code carry ISO dates, not Firestore timestamps', () => {
  const ts = { toDate: () => new Date('2026-01-02T03:04:05Z') };
  const o = plainOrder({ createdAt: ts, paidAt: { constructor: { name: 'ServerTimestampTransform' } }, items: [{ n: 1 }] });
  assert.equal(o.createdAt, '2026-01-02T03:04:05.000Z'); assert.deepEqual(o.items, [{ n: 1 }]);
});
test('abandoned card orders are cancelled after 2 hours and stock comes back; fresh and COD ones are left alone', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  const old: any = await placeOrder(input([{ productId: 'p1', quantity: 4 }], { paymentMethod: 'card' }));
  const fresh: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }], { paymentMethod: 'card' }));
  const cod: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }]));
  db.data.get('orders')!.get(old.orderId).createdAt = new Date(Date.now() - 3 * 3_600_000).toISOString();
  db.data.get('orders')!.get(cod.orderId).createdAt = new Date(Date.now() - 3 * 3_600_000).toISOString();
  assert.equal(stock('p1'), 94);
  const r = await expireUnpaidCardOrders(2);
  assert.equal(r.cancelled, 1); assert.equal(stock('p1'), 98);
  assert.equal(db.read('orders', old.orderId).status, 'cancelled'); assert.equal(db.read('orders', fresh.orderId).status, 'pending'); assert.equal(db.read('orders', cod.orderId).status, 'pending');
});
test('coupon: discount applied, usage counted, released on cancel; bad code rejected', async () => {
  db.seed('coupons', 'c1', { code: 'SAVE5', type: 'fixed', value: 5, isActive: true, usedCount: 0, startDate: PAST, endDate: FUT });
  const r: any = await placeOrder(input([{ productId: 'p1', quantity: 2 }], { couponCode: 'save5' }));
  const o = db.read('orders', r.orderId);
  assert.equal(o.discount, 5); assert.equal(o.total, 17); assert.equal(db.read('coupons', 'c1').usedCount, 1);
  await cancelOrder({ orderId: r.orderId, actor: { id: 'u1', role: 'customer' } as any });
  assert.equal(db.read('coupons', 'c1').usedCount, 0);
  await assert.rejects(() => placeOrder(input([{ productId: 'p1', quantity: 1 }], { couponCode: 'NOPE' })), (e: any) => e.code === 'BAD_COUPON');
});
test('other customers cannot cancel your order; delivered orders cannot be cancelled online', async () => {
  const r: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }]));
  await assert.rejects(() => cancelOrder({ orderId: r.orderId, actor: { id: 'u2', role: 'customer' } as any }), (e: any) => e.status === 403);
  db.data.get('orders')!.get(r.orderId).status = 'shipped';
  await assert.rejects(() => cancelOrder({ orderId: r.orderId, actor: { id: 'u1', role: 'customer' } as any }), (e: any) => e.code === 'NOT_CANCELLABLE');
});
test('invalid input is rejected without touching stock', async () => {
  for (const bad of [[], [{ productId: 'p1', quantity: 0 }], [{ productId: 'p1', quantity: 1.5 }], [{ productId: 'nope', quantity: 1 }], [{ productId: 'p1', quantity: 101 }]])
    await assert.rejects(() => placeOrder(input(bad as any)));
  await assert.rejects(() => placeOrder(input([{ productId: 'p1', quantity: 1 }], { shippingAddress: { ...addr, phone: '123' } })), (e: any) => e.code === 'BAD_ADDRESS');
  await assert.rejects(() => placeOrder(input([{ productId: 'p1', quantity: 1 }], { shippingAddress: { ...addr, governorate: 'Mars' } })), (e: any) => e.code === 'BAD_ADDRESS');
  assert.equal(stock('p1'), 100); assert.equal(db.data.get('orders')?.size || 0, 0);
});

test('checkout quote (unit line + coupon + deal) equals what placeOrder charges', async () => {
  db.seed('coupons', 'c1', { code: 'SAVE10', type: 'percentage', value: 10, isActive: true, usedCount: 0 });
  db.seed('flashDeals', 'd2', { title: 'Sale', type: 'percentage', discountValue: 20, scope: 'all', startAt: PAST, endAt: FUT, isActive: true });
  const items = [{ productId: 'p2', quantity: 1, variantId: 'u12' }, { productId: 'p1', quantity: 2 }];
  const q: any = await quoteShipping(items, 'Hawalli', 'u1', 'save10');
  const r: any = await placeOrder(input(items, { couponCode: 'SAVE10' }));
  const o = db.read('orders', r.orderId || r.id);
  assert.equal(q.subtotal, o.subtotal); assert.equal(q.discount, o.discount);
  assert.equal(Math.round((q.subtotal - q.discount + q.defaultOption.price) * 1000) / 1000, o.total);
});
test('quote reports a bad coupon instead of silently discounting', async () => {
  const q: any = await quoteShipping([{ productId: 'p1', quantity: 1 }], 'Hawalli', 'u1', 'NOPE');
  assert.equal(q.discount, 0); assert.ok(q.couponError);
});
