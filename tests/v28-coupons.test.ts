import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { placeOrder, quoteShipping } from '../src/lib/orders-server';
import { computeCoupon, customerSegments } from '../src/lib/pricing';

let db: FakeDb;
const addr = { firstName: 'Ali', lastName: 'K', phone: '55512345', governorate: 'Hawalli', city: 'Hawalli', block: '1', street: '2', building: '3' };
const input = (items: any[], o: any = {}) => ({ userId: 'u1', userEmail: 'a@b.com', userName: 'Ali', items, shippingAddress: addr, paymentMethod: 'cod' as const, ...o });
const product = (o: any = {}) => ({ name: 'Cable', sku: 'C1', price: 10, stock: 100, isActive: true, categoryId: 'cat1', categoryName: 'Cables', isReturnable: true, ...o });
const base = { isActive: true, usedCount: 0 };

beforeEach(() => {
  db = new FakeDb(); __setAdminDbForTests(db);
  db.seed('products', 'p1', product());
  db.seed('products', 'p2', product({ name: 'Paint', sku: 'P2', price: 4, categoryId: 'cat2', categoryName: 'Paint' }));
  db.seed('shippingZones', 'z1', { name: 'Capital', isActive: true, governorates: ['Hawalli'], rates: [{ id: 'r1', name: 'Std', basePrice: 2, estimatedDays: '1-2', isActive: true }] });
  db.seed('config', 'storeSettings', { freeShippingThreshold: 1000 });
});

test('start date, expiry and plain coupons behave as before', () => {
  const now = new Date();
  const c: any = { code: 'A', type: 'percentage', value: 10, ...base };
  assert.equal(computeCoupon(c, 50).discount, 5);
  assert.equal(computeCoupon({ ...c, startsAt: new Date(now.getTime() + 86400000).toISOString() }, 50).valid, false);
  assert.equal(computeCoupon({ ...c, startsAt: new Date(now.getTime() - 86400000).toISOString() }, 50).valid, true);
  assert.equal(computeCoupon({ ...c, expiresAt: new Date(now.getTime() - 1000).toISOString() }, 50).valid, false);
  assert.equal(computeCoupon({ ...c, type: 'fixed', value: 99 }, 50).discount, 50);
});

test('scope: percentage applies only to the chosen products/categories', () => {
  const lines = [{ productId: 'p1', categoryId: 'cat1', quantity: 1, total: 10 }, { productId: 'p2', categoryId: 'cat2', quantity: 1, total: 4 }];
  const c: any = { code: 'A', type: 'percentage', value: 50, ...base, categoryIds: ['cat2'] };
  assert.equal(computeCoupon(c, 14, new Date(), 0, { lines }).discount, 2);
  assert.equal(computeCoupon({ ...c, categoryIds: [], productIds: ['p1'] }, 14, new Date(), 0, { lines }).discount, 5);
  assert.equal(computeCoupon({ ...c, categoryIds: ['zzz'] }, 14, new Date(), 0, { lines }).valid, false);
});

test('buy X get Y: cheapest eligible units are free, needs enough items', () => {
  const lines = [{ productId: 'p1', categoryId: 'cat1', quantity: 2, total: 20 }, { productId: 'p2', categoryId: 'cat2', quantity: 1, total: 4 }];
  const c: any = { code: 'B', type: 'buy_x_get_y', buyQty: 2, getQty: 1, ...base };
  assert.equal(computeCoupon(c, 24, new Date(), 0, { lines }).discount, 4);
  assert.equal(computeCoupon(c, 10, new Date(), 0, { lines: [lines[0]] }).valid, false);
  assert.equal(computeCoupon({ ...c, buyQty: 0 }, 24, new Date(), 0, { lines }).valid, false);
});

test('customer groups', () => {
  const now = new Date();
  assert.deepEqual(customerSegments({}, now), ['new']);
  assert.ok(customerSegments({ orderCount: 2, totalSpent: 250, lastOrderAt: now.toISOString() }, now).includes('vip'));
  assert.ok(customerSegments({ orderCount: 1, totalSpent: 10, lastOrderAt: new Date(now.getTime() - 100 * 86400000).toISOString() }, now).includes('inactive'));
  const c: any = { code: 'N', type: 'fixed', value: 1, ...base, segment: 'new' };
  assert.equal(computeCoupon(c, 10, now, 0, { segments: ['returning'] }).valid, false);
  assert.equal(computeCoupon(c, 10, now, 0, { segments: ['new'] }).valid, true);
  assert.equal(computeCoupon(c, 10, now, 0, {}).valid, false);
});

test('free delivery coupon: quote and placed order both charge no delivery', async () => {
  db.seed('coupons', 'c1', { code: 'SHIPFREE', type: 'free_shipping', value: 0, ...base });
  const items = [{ productId: 'p1', quantity: 1 }];
  const q: any = await quoteShipping(items, 'Hawalli', 'u1', 'shipfree');
  assert.equal(q.defaultOption.price, 0); assert.equal(q.discount, 0); assert.ok(!q.couponError);
  const r: any = await placeOrder(input(items, { couponCode: 'SHIPFREE' }));
  const o = db.read('orders', r.orderId); assert.equal(o.shippingCost, 0); assert.equal(o.total, 10);
  const plain: any = await placeOrder(input(items)); assert.equal(db.read('orders', plain.orderId).total, 12);
});

test('scoped + buy-x-get-y coupons: quote equals the placed order; segment coupon blocks the wrong customer', async () => {
  db.seed('coupons', 'c1', { code: 'PAINT50', type: 'percentage', value: 50, ...base, categoryIds: ['cat2'] });
  const items = [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 2 }];
  const q: any = await quoteShipping(items, 'Hawalli', 'u1', 'PAINT50');
  const r: any = await placeOrder(input(items, { couponCode: 'PAINT50' }));
  assert.equal(q.discount, 4); assert.equal(db.read('orders', r.orderId).discount, 4);
  db.seed('coupons', 'c2', { code: 'BUY2', type: 'buy_x_get_y', buyQty: 2, getQty: 1, value: 0, ...base });
  const r2: any = await placeOrder(input([{ productId: 'p2', quantity: 3 }, { productId: 'p1', quantity: 1 }], { couponCode: 'BUY2' }));
  assert.equal(db.read('orders', r2.orderId).discount, 4);
  db.seed('coupons', 'c3', { code: 'NEWONLY', type: 'fixed', value: 1, ...base, segment: 'new' });
  db.seed('users', 'u1', { orderCount: 3, totalSpent: 50 });
  await assert.rejects(() => placeOrder(input([{ productId: 'p1', quantity: 1 }], { couponCode: 'NEWONLY' })), (e: any) => e.code === 'BAD_COUPON');
  db.seed('users', 'u9', { orderCount: 0 });
  const ok: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }], { userId: 'u9', couponCode: 'NEWONLY' }));
  assert.equal(db.read('orders', ok.orderId).discount, 1);
});
