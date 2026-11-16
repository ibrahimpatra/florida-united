import { applyFlashDeals, dealIsLive, computeShipping, computeCoupon, computeTotal, makeOrderNumber, canonicalGovernorate, fuzzyScore, type PricedLine } from '../src/lib/pricing';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const line = (o: Partial<PricedLine>): PricedLine => ({ productId: 'p', name: 'P', sku: '', price: 5, quantity: 1, total: 5, freeShipping: false, isReturnable: true, ...o });
const zones = [{ id: 'z1', name: 'Capital', isActive: true, governorates: ['Al Asimah (Capital)', 'Hawalli'],
  rates: [{ id: 'r1', name: 'Std', basePrice: 2, estimatedDays: '1-2', isActive: true }] },
  { id: 'z2', name: 'Jahra', isActive: true, governorates: ['Jahra'], rates: [{ id: 'r2', name: 'Std', basePrice: 3, estimatedDays: '2-3', isActive: true }] }];
const settings = { freeShippingThreshold: 15, defaultShippingCost: 1.5 };

test('mixed cart (p1 paid + p2 free) still charges shipping', () => {
  const r = computeShipping({ governorate: 'Hawalli', zones, settings, lines: [line({ total: 5 }), line({ productId: 'p2', total: 50, freeShipping: true })] });
  assert.equal(r.allItemsFreeShipping, false);
  assert.equal(r.defaultOption!.price, 2); // 50 KD free item must NOT waive fee
});
test('all free-shipping items => free', () => {
  const r = computeShipping({ governorate: 'Hawalli', zones, settings, lines: [line({ freeShipping: true })] });
  assert.equal(r.defaultOption!.price, 0);
});
test('chargeable subtotal over threshold => free', () => {
  const r = computeShipping({ governorate: 'Jahra', zones, settings, lines: [line({ total: 20 })] });
  assert.equal(r.defaultOption!.price, 0);
});
test('governorate-specific rate', () => {
  assert.equal(computeShipping({ governorate: 'Jahra', zones, settings, lines: [line({})] }).defaultOption!.price, 3);
  assert.equal(computeShipping({ governorate: 'Capital (العاصمة)', zones, settings, lines: [line({})] }).defaultOption!.price, 2);
});
test('unknown governorate => default fee', () => {
  assert.equal(computeShipping({ governorate: 'Mars', zones, settings, lines: [line({})] }).defaultOption!.price, 1.5);
});
test('canonicalGovernorate', () => {
  assert.equal(canonicalGovernorate('hawalli'), 'Hawalli');
  assert.equal(canonicalGovernorate('الفروانية'), 'Farwaniya');
  assert.equal(canonicalGovernorate('x'), null);
});
test('coupon', () => {
  const c = { code: 'A', type: 'percentage' as const, value: 10, isActive: true, maxDiscount: 1 };
  assert.equal(computeCoupon(c, 50).discount, 1);
  assert.equal(computeCoupon({ ...c, isActive: false }, 50).valid, false);
  assert.equal(computeCoupon({ ...c, minOrderAmount: 100 }, 50).valid, false);
  assert.equal(computeCoupon({ ...c, type: 'fixed', value: 99, maxDiscount: undefined }, 5).discount, 5);
  assert.equal(computeTotal(10, 2, 1.5), 9.5);
});
test('order number format + spread', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) { const n = makeOrderNumber(m => Math.floor(Math.random() * m)); assert.match(n, /^[A-HJ-NP-Z]{3}-\d{4}$/); seen.add(n); }
  assert.ok(seen.size > 1900);
});
test('fuzzy search + synonyms', () => {
  assert.ok(fuzzyScore('20A Circuit Breaker MCB', 'breaker') > 0);
  assert.ok(fuzzyScore('20A Circuit Breaker', 'brekaer') > 0);   // typo
  assert.ok(fuzzyScore('Copper Cable 2.5mm', 'wire') > 0);        // synonym
  assert.equal(fuzzyScore('Hammer', 'breaker'), 0);
});

// ── flash deals ──
const FUT = new Date(Date.now() + 86400000).toISOString(), PAST = new Date(Date.now() - 86400000).toISOString();
const deal = (o: any) => ({ id: 'd1', title: 'Sale', type: 'percentage', discountValue: 20, scope: 'all', startAt: PAST, endAt: FUT, ...o });
test('percentage deal reduces unit price and total', () => {
  const r = applyFlashDeals([line({ price: 10, quantity: 3, total: 30 })], [deal({})]);
  assert.equal(r.lines[0].price, 8); assert.equal(r.lines[0].total, 24); assert.equal(r.lines[0].listPrice, 10); assert.equal(r.totalSaving, 6);
});
test('fixed deal is per unit and never goes below zero', () => {
  const r = applyFlashDeals([line({ price: 2, quantity: 2, total: 4 })], [deal({ type: 'fixed', discountValue: 5 })]);
  assert.equal(r.lines[0].price, 0); assert.equal(r.lines[0].total, 0);
});
test('bogo makes every second unit free', () => {
  const r = applyFlashDeals([line({ price: 4, quantity: 5, total: 20 })], [deal({ type: 'bogo' })]);
  assert.equal(r.lines[0].total, 12); assert.equal(r.lines[0].price, 4);
});
test('scope: products and category only match their own', () => {
  const ls = [line({ productId: 'a', categoryId: 'c1', total: 5 }), line({ productId: 'b', categoryId: 'c2', total: 5 })];
  assert.equal(applyFlashDeals(ls, [deal({ scope: 'products', productIds: ['a'] })]).lines.map(l => l.dealId).join(','), 'd1,');
  assert.equal(applyFlashDeals(ls, [deal({ scope: 'category', categoryIds: ['c2'] })]).lines.map(l => l.dealId).join(','), ',d1'.slice(0) && ',d1');
});
test('expired, not started, inactive, exhausted and bundle-type deals do nothing', () => {
  for (const d of [deal({ endAt: PAST }), deal({ startAt: FUT, endAt: FUT }), deal({ isActive: false }), deal({ maxUsesTotal: 3, usedCount: 3 }), deal({ type: 'bundle' })])
    assert.equal(dealIsLive(d as any), false);
  assert.equal(applyFlashDeals([line({})], [deal({ endAt: PAST })]).totalSaving, 0);
});
test('minimum cart amount and best-of-two deals', () => {
  assert.equal(applyFlashDeals([line({ price: 5, quantity: 1, total: 5 })], [deal({ minCartAmount: 10 })]).totalSaving, 0);
  const r = applyFlashDeals([line({ price: 10, quantity: 1, total: 10 })], [deal({ id: 'small', discountValue: 5 }), deal({ id: 'big', discountValue: 30 })]);
  assert.equal(r.lines[0].dealId, 'big'); assert.deepEqual(r.usedDealIds, ['big']);
});
test('blocked deals (per-customer limit) and bundle lines are skipped', () => {
  assert.equal(applyFlashDeals([line({})], [deal({})], { blocked: new Set(['d1']) }).totalSaving, 0);
  assert.equal(applyFlashDeals([line({ bundleItems: [{ productId: 'x', quantity: 1 }] })], [deal({})]).totalSaving, 0);
});
