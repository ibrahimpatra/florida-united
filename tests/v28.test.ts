import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { holdRevenue, settleDueRevenue, applyRefund, revenueParts, kuwaitDay } from '../src/lib/revenue';
import { recogniseForRebuild } from '../src/lib/stats-server';

let db: FakeDb;
beforeEach(() => { db = new FakeDb(); __setAdminDbForTests(db); });
const DAY = 86400000;
const order = (over: any = {}) => ({
  userId: 'u1', status: 'delivered', total: 12, subtotal: 10, shippingCost: 2, discount: 0,
  deliveredAt: new Date(Date.now() - 8 * DAY).toISOString(),
  items: [{ productId: 'p1', quantity: 2, total: 6, categoryId: 'c1', categoryName: 'Tools' }, { productId: 'p2', quantity: 1, total: 4, categoryId: 'c2', categoryName: 'Paint' }],
  ...over,
});
const get = async (col: string, id: string) => (await db.collection(col).doc(id).get()).data() as any;

test('revenueParts splits goods, shipping and units and scales for a part refund', () => {
  const p = revenueParts(order());
  assert.equal(p.revenue, 12); assert.equal(p.shipping, 2); assert.equal(p.units, 3);
  assert.equal(p.cats.get('c1')!.revenue, 6); assert.equal(p.prods.get('p2')!.units, 1);
  const half = revenueParts(order(), 0.5); assert.equal(half.revenue, 6);
});

test('delivered order is HELD, then recognised only after its return window ends', async () => {
  db.seed('orders', 'o1', order({ deliveredAt: new Date().toISOString() }));
  await holdRevenue('o1');
  assert.equal((await get('orders', 'o1')).revenueState, 'held');
  assert.equal(await settleDueRevenue(new Date()), 0);                                  // window still open
  assert.equal((await get('revenueDaily', kuwaitDay(new Date()))), undefined);
  const later = new Date(Date.now() + 8 * DAY);                                          // default window is 7 days
  assert.equal(await settleDueRevenue(later), 1);
  const o = await get('orders', 'o1'); assert.equal(o.revenueState, 'recognized'); assert.equal(o.revenueAmount, 12);
  const d = await get('revenueDaily', kuwaitDay(later)); assert.equal(d.revenue, 12); assert.equal(d.orders, 1);
  assert.equal((await get('products', 'p1')).recRevenue, 6);
  assert.equal(await settleDueRevenue(later), 0);                                        // never counted twice
  assert.equal((await get('revenueDaily', kuwaitDay(later))).revenue, 12);
});

test('an order with a return in progress is not recognised, even when its window is over', async () => {
  db.seed('orders', 'o2', order({ status: 'return_requested', revenueState: 'held', revenueDueAt: new Date(Date.now() - DAY).toISOString() }));
  assert.equal(await settleDueRevenue(new Date()), 0);
  assert.equal((await get('orders', 'o2')).revenueState, 'held');
  db.seed('orders', 'o3', order({ status: 'return_rejected', revenueState: 'held', revenueDueAt: new Date(Date.now() - DAY).toISOString() }));
  assert.equal(await settleDueRevenue(new Date()), 1);                                   // rejected return: sale stands
});

test('full refund voids the sale; part refund recognises only what the customer kept; refund booked once', async () => {
  db.seed('orders', 'a', order({ status: 'refunded', revenueState: 'held' }));
  await applyRefund('a', 12); await applyRefund('a', 12);
  assert.equal((await get('orders', 'a')).revenueState, 'void');
  const day = kuwaitDay(new Date());
  let d = await get('revenueDaily', day); assert.equal(d.refunds, 12); assert.equal(d.refundCount, 1); assert.ok(!d.revenue);
  db.seed('orders', 'b', order({ status: 'refunded', revenueState: 'held' }));
  await applyRefund('b', 4);
  const b = await get('orders', 'b'); assert.equal(b.revenueState, 'recognized'); assert.equal(b.revenueAmount, 8);
  d = await get('revenueDaily', day); assert.equal(d.revenue, 8); assert.equal(d.refunds, 16);
});

test('holdRevenue honours the product return days and does nothing twice', async () => {
  db.seed('orders', 'r', order({ deliveredAt: new Date().toISOString(), items: [{ productId: 'p1', quantity: 1, total: 5, returnDays: 14 }] }));
  await holdRevenue('r');
  const due = new Date((await get('orders', 'r')).revenueDueAt).getTime();
  assert.ok(Math.abs(due - (Date.now() + 14 * DAY)) < 60000);
  await db.collection('orders').doc('r').update({ revenueState: 'recognized' });
  await holdRevenue('r'); assert.equal((await get('orders', 'r')).revenueState, 'recognized');
});

test('rebuild rule: cancelled/returned void, in-transit nothing, in-window held, past-window recognised, refunds netted', () => {
  const now = Date.now();
  assert.equal(recogniseForRebuild(order({ status: 'cancelled' }), 7, undefined, now)!.state, 'void');
  assert.equal(recogniseForRebuild(order({ status: 'returned' }), 7, undefined, now)!.state, 'void');
  assert.equal(recogniseForRebuild(order({ status: 'shipped' }), 7, undefined, now), null);
  assert.equal(recogniseForRebuild(order({ deliveredAt: new Date(now - 2 * DAY).toISOString() }), 7, undefined, now)!.state, 'held');
  const done = recogniseForRebuild(order(), 7, undefined, now)!; assert.equal(done.state, 'recognized'); assert.equal(done.amount, 12);
  assert.equal(recogniseForRebuild(order({ status: 'return_approved' }), 7, undefined, now)!.state, 'held');
  const part = recogniseForRebuild(order({ status: 'refunded' }), 7, 4, now)!; assert.equal(part.amount, 8); assert.equal(part.refund, 4);
  assert.equal(recogniseForRebuild(order({ status: 'refunded' }), 7, undefined, now)!.state, 'void');
});
