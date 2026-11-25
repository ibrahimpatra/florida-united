import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { adminBulkProducts, adminGetProducts, invalidateProductCache } from '../src/lib/firestore-admin';

function setup() {
  const db: any = new FakeDb(); __setAdminDbForTests(db);
  for (let i = 0; i < 6; i++) db.seed('products', `p${i}`, { name: `Item ${i}`, sku: `S${i}`, price: 10, stock: 5, isActive: true, categoryId: 'c1', brand: 'Old' });
  db.seed('categories', 'c1', { name: 'Tools', slug: 'tools', isActive: true });
  db.seed('categories', 'c2', { name: 'Paint', nameAr: 'دهان', slug: 'paint', isActive: true });
  invalidateProductCache(true);
  return db;
}
const get = async (f: any = {}) => (await adminGetProducts({ pageSize: 100, admin: true, ...f })).items as any[];

test('bulk: price percent / amount, stock, status, category, brand', async () => {
  setup();
  let r = await adminBulkProducts(['p0', 'p1', 'nope'], { action: 'price', mode: 'percent', value: 10 });
  assert.equal(r.updated, 2); assert.equal(r.skipped, 1);
  assert.equal((await get()).find(p => p.id === 'p0').price, 11);
  await adminBulkProducts(['p0'], { action: 'price', mode: 'amount', value: -1.5 });
  assert.equal((await get()).find(p => p.id === 'p0').price, 9.5);
  r = await adminBulkProducts(['p2'], { action: 'price', mode: 'amount', value: -50 });
  assert.equal(r.updated, 0); assert.equal(r.errors.length, 1);   // would go below zero: refused, nothing written
  await adminBulkProducts(['p2', 'p3'], { action: 'stock', value: 0 });
  assert.equal((await get({ stockStatus: 'out' })).length, 2);
  await adminBulkProducts(['p4'], { action: 'deactivate' });
  assert.equal((await get({ status: 'inactive' })).length, 1);
  await adminBulkProducts(['p4'], { action: 'archive' });
  assert.equal((await get({ status: 'archived' })).length, 1); assert.equal((await get({ status: 'inactive' })).length, 0);
  await adminBulkProducts(['p4'], { action: 'activate' });
  assert.equal((await get({ status: 'active' })).length, 6);
  await adminBulkProducts(['p0', 'p1'], { action: 'category', categoryId: 'c2' });
  const moved = (await get({ categoryId: 'c2' })); assert.equal(moved.length, 2); assert.equal(moved[0].categoryName, 'Paint');
  await adminBulkProducts(['p5'], { action: 'brand', brand: 'Bosch' });
  assert.equal((await get({ brand: 'bosch' })).length, 1);
  await assert.rejects(() => adminBulkProducts([], { action: 'activate' }));
});

test('bulk delete removes a never-ordered product and archives one with orders', async () => {
  const db = setup();
  db.seed('orders', 'o1', { productIds: ['p1'], items: [{ productId: 'p1' }] });
  const r = await adminBulkProducts(['p0', 'p1'], { action: 'delete' });
  assert.equal(r.deleted, 1); assert.equal(r.archived, 1);
  const all = await get(); assert.equal(all.length, 5); assert.equal(all.find(p => p.id === 'p1').isArchived, true);
});

test('image-copy job replaces other-site links with our own and keeps links that fail', async () => {
  const db = setup();
  const { __setIngestForTests } = await import('../src/lib/image-ingest');
  const { enqueueImageCopies, runJob } = await import('../src/lib/jobs');
  db.seed('products', 'px', { name: 'Pic', sku: 'PX', price: 1, stock: 1, isActive: true, images: ['https://a.com/1.jpg', '/media/products/own.webp', 'https://b.com/bad.jpg'] });
  invalidateProductCache(true);
  __setIngestForTests(async (u: string) => { if (u.includes('bad')) throw new Error('The other site answered 404.'); return '/media/products/px-new.webp'; });
  assert.equal(await enqueueImageCopies(['px']), 1);
  await runJob('images_px');
  const doc: any = db.data.get('products').get('px');
  assert.deepEqual(doc.images, ['/media/products/px-new.webp', '/media/products/own.webp', 'https://b.com/bad.jpg']);
  assert.equal(db.data.get('jobs').get('images_px').status, 'done');
  __setIngestForTests(null);
});
