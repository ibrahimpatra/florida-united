import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { adminGetProducts, invalidateProductCache, __setSnapshotProvider } from '../src/lib/firestore-admin';

function setup() {
  const db: any = new FakeDb(); __setAdminDbForTests(db);
  for (let i = 0; i < 20; i++) db.seed('products', `p${i}`, { name: `Item ${i}`, sku: `S${i}`, price: 1, stock: 5, isActive: true });
  let whole = 0; const col = db.collection.bind(db);
  db.collection = (n: string) => { const c = col(n); if (n === 'products') { const lim = c.limit.bind(c); c.limit = (k: number) => { const q = lim(k); const g = q.get.bind(q); q.get = async () => { whole++; return g(); }; return q; }; } return c; };
  invalidateProductCache(true);
  return { db, whole: () => whole };
}

test('a cold server starts from the shared copy and re-reads only what changed since', async () => {
  const { db, whole } = setup();
  const old = (await adminGetProducts({ pageSize: 100 })).items.map((p: any) => ({ ...p }));   // the shared copy as it was an hour ago
  assert.equal(whole(), 1);
  // since then: p1 renamed, v is now 5
  db.seed('products', 'p1', { name: 'Renamed', sku: 'S1', price: 1, stock: 5, isActive: true });
  db.seed('config', 'catalog', { v: 5, base: 0, log: [{ v: 5, ids: ['p1'] }] });
  __setSnapshotProvider(async () => ({ v: 4, items: old as any }));
  invalidateProductCache(true);                         // this server goes cold
  const r = await adminGetProducts({ pageSize: 100 });
  assert.equal(r.total, 20);
  assert.equal(r.items.find((p: any) => p.id === 'p1')!.name, 'Renamed');
  assert.equal(whole(), 1, 'no second full read: the shared copy + change log was enough');
  __setSnapshotProvider(null);
});

test('a shared copy that is too far behind falls back to one full read', async () => {
  const { db, whole } = setup();
  const old = (await adminGetProducts({ pageSize: 100 })).items.map((p: any) => ({ ...p }));
  db.seed('config', 'catalog', { v: 90, base: 50, log: [{ v: 90, ids: ['p1'] }] });
  __setSnapshotProvider(async () => ({ v: 4, items: old as any }));
  invalidateProductCache(true);
  assert.equal((await adminGetProducts({ pageSize: 100 })).total, 20);
  assert.equal(whole(), 2, 'one more full read, then it is current');
  __setSnapshotProvider(null);
});

test('without a shared copy (tests, scripts) it reads the database as before', async () => {
  const { whole } = setup();
  __setSnapshotProvider(async () => null);
  assert.equal((await adminGetProducts({ pageSize: 100 })).total, 20);
  assert.equal(whole(), 1);
  __setSnapshotProvider(null);
});

test('bundle parts show the live product price and name, not the copy saved with the bundle', async () => {
  const { getStorefrontBundle, getStorefrontBundles, invalidateProductCache: inv } = await import('../src/lib/firestore-admin');
  const { dropMemo } = await import('../src/lib/memo');
  const db: any = new FakeDb(); __setAdminDbForTests(db);
  db.seed('products', 'a', { name: 'Drill NEW', nameAr: 'مثقاب', sku: 'A', price: 14, stock: 9, isActive: true, images: ['/media/new.webp'] });
  db.seed('bundles', 'b1', { name: 'Kit', isActive: true, bundlePrice: 20, items: [{ productId: 'a', quantity: 1, name: 'Drill OLD', price: 12, image: '/media/old.webp' }] });
  inv(true); dropMemo('bundles');
  const one: any = await getStorefrontBundle('b1');
  assert.equal(one.items[0].price, 14); assert.equal(one.items[0].name, 'Drill NEW'); assert.equal(one.items[0].image, '/media/new.webp');
  const list: any = await getStorefrontBundles();
  assert.equal(list[0].items[0].price, 14);
});
