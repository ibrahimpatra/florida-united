import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { changeOrderStatus } from '../src/lib/order-actions';

let db: FakeDb;
const admin = { id: 'a', role: 'admin' } as any, cust = { id: 'u1', role: 'user' } as any;
beforeEach(() => {
  db = new FakeDb(); __setAdminDbForTests(db);
  db.seed('orders', 'o1', { orderNumber: 'N1', userId: 'u1', paymentMethod: 'cod', paymentStatus: 'pending', orderStatus: 'pending', status: 'pending', total: 5, items: [{ productId: 'p1', quantity: 2 }], statusHistory: [] });
  db.seed('orders', 'o2', { orderNumber: 'N2', userId: 'u1', paymentMethod: 'card', paymentStatus: 'pending', orderStatus: 'pending', status: 'pending', total: 5, items: [], statusHistory: [] });
  db.seed('products', 'p1', { name: 'A', stock: 8, totalSold: 2 });
});

test('admin moves an order forward and the history records it', async () => {
  await changeOrderStatus({ orderId: 'o1', actor: admin, status: 'processing' } as any);
  assert.equal(db.read('orders', 'o1').status, 'processing');
});
test('customers cannot change status except cancel; others cannot cancel it', async () => {
  await assert.rejects(() => changeOrderStatus({ orderId: 'o1', actor: cust, status: 'shipped' } as any), /only cancel/);
  await assert.rejects(() => changeOrderStatus({ orderId: 'o1', actor: { id: 'zzz', role: 'user' } as any, status: 'cancelled' } as any));
  assert.equal(db.read('orders', 'o1').status, 'pending');
});
test('unpaid card order cannot be shipped', async () => {
  await assert.rejects(() => changeOrderStatus({ orderId: 'o2', actor: admin, status: 'shipped' } as any), /not been paid/);
});
test('cancel restores stock once', async () => {
  await changeOrderStatus({ orderId: 'o1', actor: cust, status: 'cancelled' } as any);
  assert.equal(db.read('products', 'p1').stock, 10);
  await assert.rejects(() => changeOrderStatus({ orderId: 'o1', actor: admin, status: 'shipped' } as any), /cancelled/);
});
