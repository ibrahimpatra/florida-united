import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { notifyUser, notifyAdmins, createBroadcast, deleteBroadcast, listFor, markAllRead, notifyOrderStatus, notifyNewOrder } from '../src/lib/notifications';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

test('a customer sees own updates and broadcasts; unread clears after marking read', async () => {
  __setAdminDbForTests(new FakeDb() as any);
  const first = await listFor('u1', 'me');                 // first visit: clean bell
  assert.equal(first.unread, 0);
  await wait(5);
  await notifyOrderStatus({ id: 'o1', orderNumber: 'FK-1', userId: 'u1' }, 'shipped');
  await notifyOrderStatus({ id: 'o2', orderNumber: 'FK-2', userId: 'u2' }, 'delivered');   // someone else's
  await wait(5);
  await createBroadcast({ type: 'offer', title: 'Free delivery', href: '/deals' });
  const r = await listFor('u1', 'me');
  assert.equal(r.items.length, 2);
  assert.equal(r.unread, 2);
  assert.ok(r.items.some(i => i.kind === 'broadcast'));
  assert.ok(r.items.find(i => i.type === 'order')!.href === '/account/orders/o1');
  await wait(5); await markAllRead('u1', 'me');
  assert.equal((await listFor('u1', 'me')).unread, 0);
  assert.equal((await listFor('u2', 'me')).items.filter(i => i.kind === 'mine').length, 1);
});

test('admin alerts are separate from customer ones, and unknown statuses create nothing', async () => {
  const db: any = new FakeDb(); __setAdminDbForTests(db);
  await listFor('a1', 'admin'); await wait(5);
  await notifyNewOrder({ id: 'o9', orderNumber: 'FK-9', userId: 'u9', userName: 'Sara', total: 12.5 });
  await notifyOrderStatus({ id: 'o9', orderNumber: 'FK-9', userId: 'u9' }, 'pending');   // no message for plain "pending"
  const a = await listFor('a1', 'admin');
  assert.equal(a.items.length, 1); assert.equal(a.items[0].href, '/admin/orders/o9'); assert.equal(a.unread, 1);
  const u = await listFor('u9', 'me');
  assert.equal(u.items.filter(i => i.kind === 'mine').length, 1);   // "We received your order"
  const id = await createBroadcast({ type: 'offer', title: 'x' }); await deleteBroadcast(id);
  assert.equal((await listFor('u9', 'me')).items.filter(i => i.kind === 'broadcast').length, 0);
  await notifyUser(undefined, { type: 'order', title: 'ignored' }); await notifyAdmins({ type: 'order', title: 'y' });
});
