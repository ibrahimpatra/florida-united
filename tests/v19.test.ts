import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { placeOrder } from '../src/lib/orders-server';
import { priceUnderDeal, applyFlashDeals, bestDealFor, dealIsLive } from '../src/lib/pricing';
import { returnWindowDays, returnDaysLeft, isInReturnWindow, deliveredAtOf } from '../src/lib/returns';

const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);
const live = { isActive: true, startAt: new Date(NOW - 3600e3).toISOString(), endAt: new Date(NOW + 3600e3).toISOString() };
const line = (productId: string, price: number, quantity: number, categoryId = 'c1'): any => ({ productId, price, quantity, total: price * quantity, categoryId });

// ── flash deals: percentage ───────────────────────────────────
test('percentage deal: 10% off each unit, any quantity', () => {
  const r = priceUnderDeal({ id: 'd', type: 'percentage', discountValue: 10, scope: 'all', ...live } as any, 10, 3);
  assert.deepEqual(r, { price: 9, total: 27, saving: 3 });
});
test('percentage deal handles awkward prices without drifting', () => {
  const r = priceUnderDeal({ id: 'd', type: 'percentage', discountValue: 15, scope: 'all', ...live } as any, 3.333, 7);
  assert.equal(r.price, 2.833); assert.equal(r.total, 19.831); assert.equal(r.saving, Math.round((23.331 - 19.831) * 1000) / 1000);
});
test('percentage is clamped to 0-100', () => {
  assert.equal(priceUnderDeal({ type: 'percentage', discountValue: 250 } as any, 10, 1).total, 0);
  assert.equal(priceUnderDeal({ type: 'percentage', discountValue: -5 } as any, 10, 1).total, 10);
});
// ── flash deals: fixed price off ──────────────────────────────
test('fixed deal: KWD off each unit', () => {
  assert.deepEqual(priceUnderDeal({ type: 'fixed', discountValue: 2.5 } as any, 10, 2), { price: 7.5, total: 15, saving: 5 });
});
test('fixed deal never goes below zero', () => {
  assert.deepEqual(priceUnderDeal({ type: 'fixed', discountValue: 20 } as any, 10, 2), { price: 0, total: 0, saving: 20 });
});
test('buy one get one: every second unit free', () => {
  assert.equal(priceUnderDeal({ type: 'bogo' } as any, 4, 1).total, 4);
  assert.equal(priceUnderDeal({ type: 'bogo' } as any, 4, 2).total, 4);
  assert.equal(priceUnderDeal({ type: 'bogo' } as any, 4, 5).total, 12);
});
// ── when a deal applies ───────────────────────────────────────
test('a deal is live only inside its dates, while active and below its use cap', () => {
  const base: any = { id: 'd', type: 'percentage', discountValue: 10, scope: 'all', ...live };
  assert.equal(dealIsLive(base, NOW), true);
  assert.equal(dealIsLive({ ...base, isActive: false }, NOW), false);
  assert.equal(dealIsLive({ ...base, startAt: new Date(NOW + 1e6).toISOString() }, NOW), false);
  assert.equal(dealIsLive({ ...base, endAt: new Date(NOW - 1e6).toISOString() }, NOW), false);
  assert.equal(dealIsLive({ ...base, maxUsesTotal: 5, usedCount: 5 }, NOW), false);
  assert.equal(dealIsLive({ ...base, maxUsesTotal: 5, usedCount: 4 }, NOW), true);
});
test('scopes: all, category, chosen products; best deal wins; min cart; blocked deals skipped', () => {
  const pct: any = { id: 'p', type: 'percentage', discountValue: 10, scope: 'all', ...live };
  const fix: any = { id: 'f', type: 'fixed', discountValue: 3, scope: 'products', productIds: ['a'], ...live };
  const cat: any = { id: 'c', type: 'percentage', discountValue: 50, scope: 'category', categoryIds: ['cat9'], ...live };
  const lines = [line('a', 10, 1), line('b', 10, 1), line('z', 10, 1, 'cat9')];
  const r = applyFlashDeals(lines, [pct, fix, cat], { now: NOW });
  assert.deepEqual(r.lines.map(l => l.price), [7, 9, 5]);                             // a: fixed 3 beats 10%; b: 10%; z: category 50%
  assert.equal(r.totalSaving, 3 + 1 + 5);
  assert.deepEqual(applyFlashDeals(lines, [{ ...pct, minCartAmount: 100 }], { now: NOW }).lines.map(l => l.price), [10, 10, 10]);
  assert.deepEqual(applyFlashDeals(lines, [pct], { now: NOW, blocked: new Set(['p']) }).lines.map(l => l.price), [10, 10, 10]);
});
test('product card badge: bestDealFor shows the better of percent and fixed', () => {
  const pct: any = { id: 'p', type: 'percentage', discountValue: 10, scope: 'all', ...live };
  const fix: any = { id: 'f', type: 'fixed', discountValue: 3, scope: 'all', ...live };
  const b = bestDealFor([pct, fix], 'x', 'c1', 10, NOW)!;
  assert.equal(b.price, 7); assert.equal(b.deal.id, 'f');
  assert.equal(bestDealFor([pct], 'x', 'c1', 10, NOW)!.price, 9);
});

// ── end to end: what the customer is actually charged ─────────
const addr = { firstName: 'Ali', lastName: 'K', phone: '55512345', governorate: 'Hawalli', city: 'Hawalli', block: '1', street: '2', building: '3' };
async function charged(dealType: string, value: number, qty: number) {
  const db = new FakeDb(); __setAdminDbForTests(db);
  db.seed('products', 'p1', { name: 'Cable', sku: 'C1', price: 10, stock: 100, isActive: true, categoryId: 'cat1' });
  db.seed('shippingZones', 'z1', { name: 'Capital', isActive: true, governorates: ['Hawalli'], rates: [{ id: 'r1', name: 'Std', basePrice: 2, estimatedDays: '1-2', isActive: true }] });
  db.seed('config', 'storeSettings', { freeShippingThreshold: 1000 });
  db.seed('flashDeals', 'd1', { title: 'T', type: dealType, discountValue: value, scope: 'products', productIds: ['p1'], startAt: new Date(Date.now() - 1e6).toISOString(), endAt: new Date(Date.now() + 1e6).toISOString(), isActive: true });
  const r: any = await placeOrder({ userId: 'u1', userEmail: 'a@b.com', userName: 'Ali', items: [{ productId: 'p1', quantity: qty }], shippingAddress: addr, paymentMethod: 'cod' });
  return db.read('orders', r.orderId || r.id);
}
test('order charges the percentage deal price', async () => {
  const o = await charged('percentage', 20, 3);
  assert.equal(o.subtotal, 24); assert.equal(o.dealDiscount, 6); assert.equal(o.total, 26);       // 3 x 8.000 + 2.000 shipping
});
test('order charges the fixed deal price', async () => {
  const o = await charged('fixed', 1.5, 4);
  assert.equal(o.subtotal, 34); assert.equal(o.dealDiscount, 6); assert.equal(o.total, 36);       // 4 x 8.500 + 2.000 shipping
});

// ── return window ─────────────────────────────────────────────
const delivered = (daysAgo: number, extra: any = {}) => ({ status: 'delivered', deliveredAt: new Date(NOW - daysAgo * 86400e3).toISOString(), ...extra });
test('return window defaults to 7 days and follows the setting', () => {
  assert.equal(returnWindowDays(undefined), 7); assert.equal(returnWindowDays(0), 7); assert.equal(returnWindowDays('abc'), 7);
  assert.equal(returnWindowDays(14), 14); assert.equal(returnWindowDays(9999), 365);
});
test('Return button: open for 7 days after delivery, closed after', () => {
  assert.equal(isInReturnWindow(delivered(0), 7, NOW), true);
  assert.equal(isInReturnWindow(delivered(6.5), 7, NOW), true);
  assert.equal(returnDaysLeft(delivered(6.5), 7, NOW), 0);                                           // last day
  assert.equal(returnDaysLeft(delivered(2), 7, NOW), 4);
  assert.equal(isInReturnWindow(delivered(7.01), 7, NOW), false);
  assert.equal(returnDaysLeft(delivered(8), 7, NOW), -1);
  assert.equal(isInReturnWindow(delivered(10), 14, NOW), true);                                      // setting raised to 14
});
test('delivery date falls back to the status history; unknown date does not block the button', () => {
  const o = { status: 'delivered', statusHistory: [{ status: 'confirmed', createdAt: '2026-01-01T00:00:00Z' }, { status: 'delivered', createdAt: new Date(NOW - 3 * 86400e3).toISOString() }] };
  assert.equal(deliveredAtOf(o)!.getTime(), NOW - 3 * 86400e3);
  assert.equal(returnDaysLeft(o, 7, NOW), 3);
  assert.equal(deliveredAtOf({ status: 'delivered' }), null);
  assert.equal(isInReturnWindow({ status: 'delivered' }, 7, NOW), true);
});

// ── return request API rules (server) ─────────────────────────
import { NextRequest } from 'next/server';
import * as nextAuth from 'next-auth';
test('return API route module loads', async () => { const m = await import('../src/app/api/orders/returns/route'); assert.equal(typeof m.GET + typeof m.POST + typeof m.PATCH, 'functionfunctionfunction'); void nextAuth; void NextRequest; });
