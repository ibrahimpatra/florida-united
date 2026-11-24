import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { placeOrder, cancelOrder } from '../src/lib/orders-server';
import { earnPoints, redeemPlan, sanitizeLoyalty, DEFAULT_LOYALTY, tierFor } from '../src/lib/loyalty-core';
import { awardForDelivered, reverseForRefund, adjustPoints, saveLoyaltySettings, releaseDue, pendingFor, joinLoyalty, isMember } from '../src/lib/loyalty';
import { missingSeo, runJob, enqueueSeoIfMissing, runQueued } from '../src/lib/jobs';
import { isSuperSession, __resetRolesCache } from '../src/lib/roles';
import { cleanTile } from '../src/lib/promo-tiles';
import { splitFollowUps } from '../src/lib/agent/followups';
import { sanitizeDeal } from '../src/lib/shipping-admin';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const addr = { firstName: 'Ali', lastName: 'K', phone: '55512345', governorate: 'Hawalli', city: 'Hawalli', block: '1', street: '2', building: '3' };
let db: FakeDb;
const order = (o: any = {}) => placeOrder({ userId: 'u1', userEmail: 'a@b.com', userName: 'Ali', items: [{ productId: 'p1', quantity: 2 }], shippingAddress: addr, paymentMethod: 'cod', ...o }) as Promise<any>;
const LOY = { enabled: true, earnPerKwd: 2, pointValueKwd: 0.01, minRedeem: 100, maxRedeemPct: 50, tiers: [] };

beforeEach(() => {
  db = new FakeDb(); __setAdminDbForTests(db); __resetRolesCache();
  db.seed('products', 'p1', { name: 'Cable', sku: 'C1', price: 10, stock: 100, isActive: true, categoryId: 'cat1', categoryName: 'Cables', isReturnable: true });
  db.seed('shippingZones', 'z1', { name: 'Capital', isActive: true, governorates: ['Hawalli'], rates: [{ id: 'r1', name: 'Std', basePrice: 2, estimatedDays: '1-2', isActive: true }] });
  db.seed('config', 'storeSettings', { freeShippingThreshold: 1000 });
  db.seed('users', 'u1', { email: 'a@b.com', role: 'customer', loyaltyPoints: 1500, totalSpent: 0 });
  db.seed('settings', 'loyalty', LOY);
});

// ── loyalty rules ─────────────────────────────────────────────
test('earning: points per KWD, tier bonus, off means nothing', () => {
  const s = sanitizeLoyalty({ ...LOY, tiers: [{ name: 'Gold', minSpent: 500, bonusPct: 50 }] });
  assert.equal(earnPoints(s, 12.9, 0), 25);
  assert.equal(earnPoints(s, 10, 600), 30);
  assert.equal(tierFor(s, 600)?.name, 'Gold'); assert.equal(tierFor(s, 10), null);
  assert.equal(earnPoints({ ...s, enabled: false }, 50), 0);
});
test('redeeming: capped by balance, % of goods and minimum', () => {
  const s = sanitizeLoyalty(LOY);
  assert.deepEqual(redeemPlan(s, 5000, 1500, 20), { points: 1000, discount: 10 });  // 50% of 20 KWD = 10 KWD = 1000 pts
  assert.deepEqual(redeemPlan(s, 5000, 300, 20), { points: 300, discount: 3 });
  assert.deepEqual(redeemPlan(s, 50, 300, 20), { points: 0, discount: 0 });          // below minimum
  assert.deepEqual(redeemPlan({ ...s, enabled: false }, 500, 500, 20), { points: 0, discount: 0 });
  assert.deepEqual(redeemPlan(s, -5, 500, 20), { points: 0, discount: 0 });
});
test('settings are clamped to sane values', () => {
  const s = sanitizeLoyalty({ enabled: true, earnPerKwd: -3, pointValueKwd: 'x', maxRedeemPct: 900, minRedeem: 2.7 });
  assert.equal(s.earnPerKwd, 0); assert.equal(s.pointValueKwd, DEFAULT_LOYALTY.pointValueKwd); assert.equal(s.maxRedeemPct, 100); assert.equal(s.minRedeem, 2);
});

// ── loyalty at checkout / cancel / delivered / refund ─────────
test('order with points: balance drops, discount applied, ledger written', async () => {
  const r = await order({ redeemPoints: 1000 });                                  // goods 20 KWD, 50% cap = 10 KWD = 1000 pts, + 2 shipping
  const o = db.read('orders', r.orderId);
  assert.equal(o.loyaltyPoints, 1000); assert.equal(o.loyaltyDiscount, 10); assert.equal(o.total, 12);
  assert.equal(db.read('users', 'u1').loyaltyPoints, 500);
  assert.equal(db.read('loyaltyLedger', `${r.orderId}_redeem`).points, -1000);
});
test('asking for more points than allowed only spends what is allowed; never more than the balance', async () => {
  db.seed('users', 'u1', { email: 'a@b.com', loyaltyPoints: 300 });
  const r = await order({ redeemPoints: 99999 });
  assert.equal(db.read('orders', r.orderId).loyaltyPoints, 300); assert.equal(db.read('users', 'u1').loyaltyPoints, 0);
});
test('points are ignored when the programme is off or the request is 0', async () => {
  db.seed('settings', 'loyalty', { ...LOY, enabled: false });
  const r = await order({ redeemPoints: 1000 });
  assert.equal(db.read('orders', r.orderId).loyaltyPoints, undefined); assert.equal(db.read('users', 'u1').loyaltyPoints, 1500);
  assert.equal(db.read('orders', r.orderId).total, 22);
});
test('cancelling gives the used points back', async () => {
  const r = await order({ redeemPoints: 1000 });
  await cancelOrder({ orderId: r.orderId, actor: { id: 'u1', role: 'customer' } });
  assert.equal(db.read('users', 'u1').loyaltyPoints, 1500); assert.equal(db.read('loyaltyLedger', `${r.orderId}_refund`).points, 1000);
});
const deliver = async (id: string, daysAgo = 0) => { db.seed('orders', id, { ...db.read('orders', id), status: 'delivered', deliveredAt: new Date(Date.now() - daysAgo * 86400000).toISOString() }); };
test('delivered: points are held as pending, counted once, and not in the balance yet', async () => {
  const r = await order(); await deliver(r.orderId);                              // goods 20 KWD x 2 = 40 points
  assert.equal(await awardForDelivered(r.orderId), 40); assert.equal(await awardForDelivered(r.orderId), 0);
  assert.equal(db.read('users', 'u1').loyaltyPoints, 1500); assert.equal(db.read('orders', r.orderId).loyaltyPending, 40);
  assert.equal((await pendingFor('u1')).total, 40);
});
test('points reach the balance only after the return window, only for members, and not while a return is open', async () => {
  const r = await order(); await deliver(r.orderId, 1); await awardForDelivered(r.orderId);
  assert.equal(await releaseDue('u1'), 0);                                         // still inside the 7-day window
  const later = Date.now() + 8 * 86400000;
  db.seed('orders', r.orderId, { ...db.read('orders', r.orderId), status: 'return_requested' });
  assert.equal(await releaseDue('u1', later), 0);                                  // return in progress holds them
  db.seed('orders', r.orderId, { ...db.read('orders', r.orderId), status: 'delivered' });
  assert.equal(await releaseDue('u1', later), 40); assert.equal(await releaseDue('u1', later), 0);
  assert.equal(db.read('users', 'u1').loyaltyPoints, 1540);
});
test('nobody is enrolled automatically: a non-member keeps pending points until they join', async () => {
  db.seed('users', 'u2', { email: 'z@b.com' });
  assert.equal(isMember(db.read('users', 'u2')), false);
  db.seed('orders', 'oo', { userId: 'u2', status: 'delivered', loyaltyPending: 10, loyaltyReleaseAt: '2020-01-01T00:00:00.000Z', orderNumber: 'X', items: [] });
  assert.equal(await releaseDue('u2'), 0);
  await joinLoyalty('u2'); assert.equal(await releaseDue('u2'), 10); assert.equal(db.read('users', 'u2').loyaltyPoints, 10);
});
test('refund before release just cancels the pending points; after release it takes back the share, never below zero', async () => {
  const r = await order(); await deliver(r.orderId); await awardForDelivered(r.orderId);
  assert.equal(await reverseForRefund(r.orderId, 99), 0);
  assert.equal(db.read('orders', r.orderId).loyaltyPending, 0); assert.equal(db.read('users', 'u1').loyaltyPoints, 1500);
  const r2 = await order(); await deliver(r2.orderId, 30); await awardForDelivered(r2.orderId); await releaseDue('u1');
  const o = db.read('orders', r2.orderId);
  const back = await reverseForRefund(r2.orderId, o.total / 2);
  assert.ok(back > 0 && back <= 20, `took back ${back}`);
  db.seed('users', 'u1', { email: 'a@b.com', loyaltyPoints: 1 });
  assert.ok(await reverseForRefund(r2.orderId, o.total) <= 1);
});
test('manual adjustment cannot make a balance negative', async () => {
  await adjustPoints('u1', 100, 'gift', 'admin'); assert.equal(db.read('users', 'u1').loyaltyPoints, 1600);
  await assert.rejects(() => adjustPoints('u1', -99999, 'x', 'admin'), /only has/);
  await assert.rejects(() => adjustPoints('u1', 0, 'x', 'admin'));
});
test('saving settings sanitises them', async () => {
  const s = await saveLoyaltySettings({ enabled: 1, maxRedeemPct: 5000 }); assert.equal(s.enabled, true); assert.equal(s.maxRedeemPct, 100);
});

// ── superadmin ────────────────────────────────────────────────
test('super admin: only the stored superadmin; with none, the oldest admin becomes owner and others stay plain', async () => {
  db.seed('users', 'old', { role: 'admin', createdAt: '2020-01-01T00:00:00.000Z' });
  db.seed('users', 'new', { role: 'admin', createdAt: '2024-01-01T00:00:00.000Z' });
  db.seed('users', 'cust', { role: 'customer' });
  __resetRolesCache();
  assert.equal(await isSuperSession({ user: { id: 'new', role: 'admin' } }), false);   // newer admin is never promoted
  assert.equal(await isSuperSession({ user: { id: 'old', role: 'admin' } }), true);    // the owner is
  assert.equal(db.read('users', 'old').role, 'superadmin');
  assert.equal(await isSuperSession({ user: { id: 'new', role: 'admin', isSuper: true } }), false); // a stale flag in the login cannot grant it
  assert.equal(await isSuperSession({ user: { id: 'cust', role: 'customer', isSuper: true } }), false);
  assert.equal(await isSuperSession(null), false);
  db.seed('users', 'old', { role: 'admin', createdAt: '2020-01-01T00:00:00.000Z' }); db.seed('users', 'boss', { role: 'superadmin' }); __resetRolesCache();
  assert.equal(await isSuperSession({ user: { id: 'old', role: 'admin' } }), false);   // demotion applies
  assert.equal(await isSuperSession({ user: { id: 'boss', role: 'admin' } }), true);
});

// ── background SEO jobs ───────────────────────────────────────
test('missingSeo lists exactly the empty fields', () => {
  assert.deepEqual(missingSeo({ name: 'N', nameAr: 'ن', description: 'x', shortDescription: 'y', shortDescriptionAr: 'ي', descriptionAr: 'z', metaTitle: 'a', metaDesc: 'b', metaTitleAr: 'أ', metaDescAr: 'ب', tags: ['t'] }), []);
  assert.deepEqual(missingSeo({ description: 'x', tags: [] }).sort(), ['descriptionAr', 'metaDesc', 'metaDescAr', 'metaTitle', 'metaTitleAr', 'shortDescription', 'tags']);
});
test('SEO job fills only empty fields and keeps what a person wrote', async () => {
  process.env.OPENAI_API_KEY = 'k'; delete process.env.GEMINI_API_KEY;
  db.seed('products', 'p9', { name: 'Switch', description: 'Written by hand', isActive: true });
  db.seed('jobs', 'seo_p9', { type: 'seo', status: 'queued', productId: 'p9', productName: 'Switch', attempts: 0, createdAt: 'x', updatedAt: new Date().toISOString() });
  globalThis.fetch = (async () => json({ choices: [{ message: { content: JSON.stringify({ description: 'AI text', shortDescription: 'Short', descriptionAr: 'وصف', shortDescriptionAr: 'قصير', metaTitle: 'Switch | Florida', metaDesc: 'Buy the switch', tags: ['Switch', 'مفتاح'] }) } }] })) as any;
  await runJob('seo_p9');
  const p = db.read('products', 'p9'); const j = db.read('jobs', 'seo_p9');
  assert.equal(p.description, 'Written by hand'); assert.equal(p.metaTitle, 'Switch | Florida'); assert.deepEqual(p.tags, ['switch', 'مفتاح']); assert.equal(p.descriptionAr, 'وصف');
  assert.equal(j.status, 'done'); assert.ok(j.result.filled.includes('metaDesc') && !j.result.filled.includes('description'));
});
test('SEO job: AI failure re-queues, after 3 tries it shows as failed with a readable reason', async () => {
  process.env.OPENAI_API_KEY = 'k'; delete process.env.GEMINI_API_KEY;
  db.seed('products', 'p9', { name: 'Switch', isActive: true });
  db.seed('jobs', 'seo_p9', { type: 'seo', status: 'queued', productId: 'p9', productName: 'Switch', attempts: 0, createdAt: 'x', updatedAt: new Date().toISOString() });
  globalThis.fetch = (async () => json({ error: { message: 'no credit' } }, 429)) as any;
  await runJob('seo_p9'); assert.equal(db.read('jobs', 'seo_p9').status, 'queued');
  await runJob('seo_p9'); await runJob('seo_p9');
  const j = db.read('jobs', 'seo_p9'); assert.equal(j.status, 'failed'); assert.match(j.error, /credit|quota/i);
});
test('two runners cannot start the same job', async () => {
  process.env.OPENAI_API_KEY = 'k';
  db.seed('products', 'p9', { name: 'Switch', isActive: true });
  db.seed('jobs', 'seo_p9', { type: 'seo', status: 'queued', productId: 'p9', productName: 'Switch', attempts: 0, createdAt: 'x', updatedAt: new Date().toISOString() });
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return json({ choices: [{ message: { content: JSON.stringify({ description: 'd', shortDescription: 's', descriptionAr: 'a', metaTitle: 't', metaDesc: 'm', tags: ['x'] }) } }] }); }) as any;
  await Promise.all([runJob('seo_p9'), runJob('seo_p9')]);
  assert.equal(calls, 1);
});
test('no AI key: nothing is queued; with a key, a product with empty SEO is queued', async () => {
  delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY;
  db.seed('products', 'p9', { name: 'Switch', isActive: true });
  await enqueueSeoIfMissing('p9'); assert.equal(db.read('jobs', 'seo_p9'), undefined);
  process.env.OPENAI_API_KEY = 'k';
  globalThis.fetch = (async () => json({ error: {} }, 500)) as any;
  await enqueueSeoIfMissing('p9'); await new Promise(r => setTimeout(r, 30));
  assert.ok(['queued', 'running', 'failed', 'done'].includes(db.read('jobs', 'seo_p9').status));
  const r = await runQueued(1000); assert.ok(r.ran >= 0);
});

// ── small helpers ─────────────────────────────────────────────
test('promo tile validation', () => {
  assert.throws(() => cleanTile({ title: '  ' }), /title/);
  assert.throws(() => cleanTile({ title: 'x', link: 'javascript:alert(1)' }), /link/);
  const t = cleanTile({ title: 'Clearance', link: '/deals', color: 'red' }); assert.equal(t.color, '#b91c1c'); assert.equal(t.isActive, true);
});
test('follow-up questions are split off the answer, with defaults when missing', () => {
  const a = splitFollowUps('Cable costs 2 KWD.\nFOLLOWUPS: How much is delivery? | Do you have 4mm?', 'en');
  assert.equal(a.text, 'Cable costs 2 KWD.'); assert.deepEqual(a.followUps, ['How much is delivery?', 'Do you have 4mm?']);
  const b = splitFollowUps('Just an answer', 'ar'); assert.equal(b.text, 'Just an answer'); assert.equal(b.followUps.length, 2);
  assert.equal(splitFollowUps('x\n**FOLLOWUPS:** one | two | three', 'en').followUps.length, 2);
});
test('banner picture mode is whitelisted on flash deals', () => {
  assert.equal(sanitizeDeal({ imageMode: 'side' }, true).imageMode, 'side');
  assert.equal(sanitizeDeal({ imageMode: 'weird' }, true).imageMode, 'background');
});
