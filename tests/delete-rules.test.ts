import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { adminDeleteProduct, adminDeleteCoupon } from '../src/lib/firestore-admin';
import { adminDeleteUOM, adminDeleteFlashDeal, sanitizeDeal } from '../src/lib/shipping-admin';

let db: FakeDb;
beforeEach(() => { db = new FakeDb(); __setAdminDbForTests(db); });

test('product with order history is archived, never deleted; unused product is deleted', async () => {
  db.seed('products', 'p1', { name: 'A', sku: 'A', isActive: true });
  db.seed('products', 'p2', { name: 'B', sku: 'B', isActive: true });
  db.seed('orders', 'o1', { productIds: ['p1'], items: [{ productId: 'p1' }] });
  const a: any = await adminDeleteProduct('p1'); const b: any = await adminDeleteProduct('p2');
  assert.equal(a.archived, true); assert.ok(db.read('products', 'p1')); assert.equal(db.read('products', 'p1').isActive, false);
  assert.equal(b.deleted, true); assert.equal(db.read('products', 'p2'), undefined);
});
test('unit used by a product cannot be deleted', async () => {
  db.seed('uoms', 'u1', { name: 'Pieces', abbreviation: 'pcs' }); db.seed('products', 'p1', { name: 'A', uomId: 'u1' });
  await assert.rejects(() => adminDeleteUOM('u1'), /used by/);
  db.seed('uoms', 'u2', { name: 'Kg', abbreviation: 'kg' }); await adminDeleteUOM('u2'); assert.equal(db.read('uoms', 'u2'), undefined);
});
test('used coupon and used deal are switched off instead of deleted', async () => {
  db.seed('coupons', 'c1', { code: 'X', usedCount: 3, isActive: true }); db.seed('flashDeals', 'd1', { usedCount: 2, isActive: true });
  await adminDeleteCoupon('c1'); await adminDeleteFlashDeal('d1');
  assert.equal(db.read('coupons', 'c1').isActive, false); assert.equal(db.read('flashDeals', 'd1').isActive, false);
});
test('sanitizeDeal drops undefined and bad numbers', () => {
  const d: any = sanitizeDeal({ name: 'Sale', discountValue: '10', categoryIds: ['a', 'a', ''] } as any);
  assert.ok(!Object.values(d).includes(undefined));
});
