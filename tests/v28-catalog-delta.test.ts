import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { adminGetProducts, adminGetCategories, invalidateProductCache } from '../src/lib/firestore-admin';

test('after a change, only the changed products are re-read (not the whole catalogue)', async () => {
  const db: any = new FakeDb(); __setAdminDbForTests(db);
  for (let i = 0; i < 30; i++) db.seed('products', `p${i}`, { name: `Item ${i}`, sku: `S${i}`, price: 1, stock: 5, isActive: true });
  db.seed('categories', 'c1', { name: 'Tools', slug: 'tools', isActive: true });
  let wholeReads = 0;
  const col = db.collection.bind(db);
  db.collection = (n: string) => {
    const c = col(n);
    if (n === 'products') { const lim = c.limit.bind(c); c.limit = (k: number) => { const q = lim(k); const g = q.get.bind(q); q.get = async () => { wholeReads++; return g(); }; return q; }; }
    return c;
  };

  assert.equal((await adminGetProducts({ pageSize: 100 })).total, 30);
  assert.equal(wholeReads, 1);
  assert.equal((await adminGetProducts({ pageSize: 100, admin: true })).total, 30);   // admin list shares the list: no second full read
  assert.equal(wholeReads, 1);

  db.seed('products', 'p99', { name: 'New thing', sku: 'N', price: 2, stock: 1, isActive: true });
  db.seed('products', 'p0', { name: 'Renamed', sku: 'S0', price: 1, stock: 0, isActive: true });
  invalidateProductCache(true, { ids: ['p99', 'p0'] });
  const r = await adminGetProducts({ pageSize: 100 });
  assert.equal(r.total, 31);
  assert.equal(r.items.find((p: any) => p.id === 'p0')!.name, 'Renamed');
  assert.equal(wholeReads, 1, 'no full re-read');

  // a product that no longer exists drops out of the list
  db.data.get('products').delete('p5');
  invalidateProductCache(true, { ids: ['p5'] });
  assert.equal((await adminGetProducts({ pageSize: 100 })).total, 30);
  assert.equal(wholeReads, 1);
});

test('categories are cached and a new category shows up after cats invalidation', async () => {
  const db: any = new FakeDb(); __setAdminDbForTests(db);
  db.seed('categories', 'c1', { name: 'Tools', slug: 'tools', isActive: true });
  invalidateProductCache(true);                               // fresh start for this test
  assert.equal((await adminGetCategories(false)).length, 1);
  db.seed('categories', 'c2', { name: 'Paint', slug: 'paint', isActive: true });
  assert.equal((await adminGetCategories(false)).length, 1);  // still cached
  invalidateProductCache(true, { cats: true });
  assert.equal((await adminGetCategories(false)).length, 2);
});
