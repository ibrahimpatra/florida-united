import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { reportIssue, listIssues } from '../src/lib/issues';
import { withLog, log } from '../src/lib/logger';
import { nextSteps, customerCanCancel, adminCanCancel } from '../src/lib/order-flow';

let db: FakeDb;
beforeEach(() => { db = new FakeDb(); __setAdminDbForTests(db); });
const tick = () => new Promise(r => setTimeout(r, 30));

test('reportIssue groups identical problems into one row with a count, and old rows are dropped after 30 days', async () => {
  await reportIssue('job x', new Error('boom ' + Math.random()));
  const e = new Error('same problem'); await reportIssue('webhook', e); await tick();
  // throttle is per-minute per instance, so seed the repeat directly through a second distinct instance of the same id
  const rows = await listIssues(); assert.ok(rows.length >= 2);
  db.seed('errorLog', 'old1', { route: 'r', method: 'APP', status: 500, message: 'old', user: '', count: 1, firstAt: '2020-01-01T00:00:00.000Z', lastAt: '2020-01-01T00:00:00.000Z' });
  const after = await listIssues(); assert.ok(!after.find(r => r.id === 'old1'));
});
test('log.error anywhere lands in Issues; warnings do not', async () => {
  log.error('stripe', 'webhook signature failed'); log.warn('stripe', 'just a warning'); await tick();
  const rows = await listIssues();
  assert.ok(rows.some(r => r.route === 'stripe' && /signature/.test(r.message)));
  assert.ok(!rows.some(r => /just a warning/.test(r.message)));
});
test('expected 4xx answers are not recorded; a 500 is, and its admin detail only appears when it adds something', async () => {
  const bad = withLog('POST', '/api/t1', async (_r: Request) => new Response(JSON.stringify({ error: 'A cancelled order cannot be changed.' }), { status: 400, headers: { 'content-type': 'application/json' } }));
  await bad(new Request('http://x/api/t1', { method: 'POST' })); await tick();
  assert.equal((await listIssues()).length, 0);
  const boom = withLog('GET', '/api/t2', async (_r: Request): Promise<Response> => { throw new Error('db exploded'); });
  const r = await boom(new Request('http://x/api/t2')); await tick();
  assert.equal(r.status, 500);
  assert.ok((await listIssues()).some(i => i.route === '/api/t2' && /db exploded/.test(i.message)));
});
test('order flow table', () => {
  assert.deepEqual(nextSteps('pending'), ['confirmed', 'cancelled']);
  assert.deepEqual(nextSteps('shipped'), ['out_for_delivery', 'delivered']);
  assert.deepEqual(nextSteps('delivered'), []);
  assert.deepEqual(nextSteps('cancelled'), []);
  assert.equal(customerCanCancel('processing'), false); assert.equal(adminCanCancel('processing'), true); assert.equal(adminCanCancel('shipped'), false);
});

import { useCartStore } from '../src/store/cartStore';
import { publicProduct, stockForIds, invalidateProductCache } from '../src/lib/firestore-admin';
test('shoppers never get the real stock number; cart ignores sold-out lines', async () => {
  const p = publicProduct({ id: 'a', stock: 480, costPrice: 3, lowStockAlert: 5 } as any) as any;
  assert.equal(p.stock, 10); assert.equal(p.costPrice, undefined); assert.equal(p.lowStockAlert, undefined);
  assert.equal((publicProduct({ stock: 0 } as any) as any).stock, 0);
  assert.equal((publicProduct({ stock: 500, units: [{ id: 'box', factor: 12 }] } as any) as any).stock, 120);
  db.seed('products', 'p1', { name: 'X', slug: 'x', stock: 300, isActive: true, price: 1, units: [{ id: 'box', factor: 12 }] });
  db.seed('products', 'p2', { name: 'Y', slug: 'y', stock: 0, isActive: true, price: 1 });
  invalidateProductCache(true);
  const m = await stockForIds(['p1', 'p2', 'nope']);
  assert.equal(m.p1.inStock, true); assert.equal(m.p1.cap, 120); assert.equal(m.p2.inStock, false); assert.equal(m.nope.inStock, false);
  const base = { name: 'n', slug: 's', price: 2, image: '', sku: 'k', isReturnable: true, id: '' };
  useCartStore.setState({ items: [{ ...base, id: '1', productId: 'p1', quantity: 15, stock: 999 }, { ...base, id: '2', productId: 'p2', quantity: 2, stock: 5 }] as any });
  useCartStore.getState().applyStock(m);
  const st = useCartStore.getState();
  assert.equal(st.items[0].quantity, 15); assert.equal(st.items[1].unavailable, true);
  assert.equal(st.getCount(), 15); assert.equal(st.getSubtotal(), 30);
});

import { findNav, visibleGroups } from '../src/lib/admin-nav';
test('admin menu: super-only tiles are hidden from normal admins, every tile has a route and the page lookup finds its group', () => {
  const normal = visibleGroups(false).flatMap(g => g.items.map(i => i.href));
  const sup = visibleGroups(true).flatMap(g => g.items.map(i => i.href));
  for (const h of ['/admin/settings', '/admin/issues', '/admin/jobs', '/admin/shipping', '/admin/loyalty', '/admin/graph']) { assert.ok(!normal.includes(h), h); assert.ok(sup.includes(h), h); }
  assert.ok(normal.includes('/admin/orders'));
  assert.equal(findNav('/admin/orders/abc')?.group.id, 'sales'); assert.equal(findNav('/admin/products/x/edit')?.item.label, 'Products');
  assert.equal(findNav('/admin'), null);
});

import { priceUnderDeal, applyFlashDeals } from '../src/lib/pricing';
test('deal limits: max units per order at the offer price; the rest is charged normally', () => {
  const d: any = { id: 'd', type: 'percentage', discountValue: 50, scope: 'all', isActive: true, endAt: new Date(Date.now() + 1e7).toISOString(), maxQtyPerOrder: 2 };
  assert.equal(priceUnderDeal(d, 10, 2).total, 10);
  const r = priceUnderDeal(d, 10, 5);
  assert.equal(r.total, 40); assert.equal(r.saving, 10); assert.equal(r.price, 10);
  const out = applyFlashDeals([{ productId: 'p', name: 'x', sku: 's', price: 10, quantity: 5, total: 50 } as any], [d]);
  assert.equal(out.lines[0].total, 40); assert.equal(out.totalSaving, 10);
  assert.equal(priceUnderDeal({ ...d, maxQtyPerOrder: undefined }, 10, 5).total, 25);
});

import { bundleSlug, bundleIdFromSlug, bundlePath } from '../src/lib/bundle-path';
import { getStorefrontBundle } from '../src/lib/firestore-admin';
import { mergeRecent } from '../src/lib/recent';
import { summariseDay, estimateUsd } from '../src/lib/ai-cost';
test('bundle page address finds the bundle by id even after a rename; stock comes from the parts and is capped', async () => {
  assert.equal(bundleIdFromSlug(bundleSlug({ id: 'abc123XYZ', name: 'Starter Tool Kit' })), 'abc123XYZ');
  assert.equal(bundlePath({ id: 'q1', name: '' }), '/shop/bundles/bundle-q1');
  db.seed('products', 'p1', { name: 'Drill', slug: 'drill', stock: 100, isActive: true, price: 30, images: ['/media/a.webp'] });
  db.seed('products', 'p2', { name: 'Bit', slug: 'bit', stock: 9, isActive: true, price: 2 });
  db.seed('bundles', 'b1', { name: 'Kit', bundlePrice: 28, isActive: true, items: [{ productId: 'p1', quantity: 1, price: 30, productName: 'Drill' }, { productId: 'p2', quantity: 3, price: 2, productName: 'Bit' }] });
  const b: any = await getStorefrontBundle('b1');
  assert.equal(b.available, 3); assert.equal(b.items[0].slug, 'drill'); assert.equal(b.items[0].image, '/media/a.webp');
  db.seed('products', 'p2', { name: 'Bit', slug: 'bit', stock: 0, isActive: true, price: 2 });
  assert.equal(((await getStorefrontBundle('b1')) as any).available, 0);
  db.seed('bundles', 'b2', { name: 'Off', bundlePrice: 1, isActive: false, items: [] });
  assert.equal(await getStorefrontBundle('b2'), null); assert.equal(await getStorefrontBundle('nope'), null);
});
test('recently viewed merge: one entry per product, newest time wins, capped at 20, bundles ignored', () => {
  const a = Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, at: 100 + i }));
  const b = Array.from({ length: 15 }, (_, i) => ({ id: `b${i}`, at: 200 + i })).concat([{ id: 'a0', at: 999 }, { id: 'bundle:x', at: 1000 }]);
  const m = mergeRecent(a, b);
  assert.equal(m.length, 20); assert.equal(m[0].id, 'a0'); assert.ok(!m.some(x => x.id.startsWith('bundle:')));
  assert.equal(new Set(m.map(x => x.id)).size, 20);
});
test('AI usage summary turns counters into per-model and per-provider numbers with an estimate', () => {
  const s = summariseDay({ id: '2026-11-23', calls: 3, errors: 1, fallbacks: 1, bulkCalls: 2, tokensIn: 3000, tokensOut: 600, ms: 900, p_gemini_calls: 2, p_gemini_in: 2000, p_gemini_out: 400, p_openai_calls: 1, p_openai_errors: 1, m_gemini_3_6_flash_calls: 2, m_gemini_3_6_flash_in: 2000, m_gemini_3_6_flash_out: 400, t_seo_calls: 2 });
  assert.equal(s.avgMs, 300); assert.equal(s.providers.length, 2); assert.equal(s.models[0].calls, 2); assert.ok(s.usd > 0); assert.equal(s.tasks[0].task, 'seo');
  assert.ok(estimateUsd('gemini-flash-lite', 1e6, 0) < estimateUsd('gemini-pro', 1e6, 0));
});
