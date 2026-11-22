import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { placeOrder, cancelOrder, quoteShipping, OrderError } from '../src/lib/orders-server';
import { fixImageUrl, publicBase } from '../src/lib/image-url';
import { matchScore, computeCoupon, applyFlashDeals } from '../src/lib/pricing';
import { scoreRecommendations, tokens } from '../src/lib/recommend';
import { toOpenAITools, openaiAgent } from '../src/lib/openai';
import { aiText, parseJsonLoose } from '../src/lib/ai';
import { searchBundles } from '../src/lib/firestore-admin';
import { buildInvoicePdf } from '../src/lib/invoice-pdf';

// ── image links ───────────────────────────────────────────────
test('image links without https:// are repaired, good ones untouched', () => {
  assert.equal(fixImageUrl('img.yourdomain.com/products/hello-l66pay.webp'), '/media/products/hello-l66pay.webp');     // the placeholder from your env
  assert.equal(fixImageUrl('https://pub-1a2b.r2.dev/banners/sale.webp'), '/media/banners/sale.webp');
  assert.equal(fixImageUrl('https://shop.example.com/cdn/shop/files/a.jpg'), 'https://shop.example.com/cdn/shop/files/a.jpg'); // someone else's picture is left alone
  assert.equal(fixImageUrl('https://random.com/products/a.webp'), 'https://random.com/products/a.webp');
  assert.equal(fixImageUrl('/media/products/a.webp'), '/media/products/a.webp');
  assert.equal(fixImageUrl('https://pub-1.r2.dev/a.webp'), 'https://pub-1.r2.dev/a.webp');
  assert.equal(fixImageUrl('/logo.svg'), '/logo.svg');
  assert.equal(fixImageUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
  assert.equal(fixImageUrl(undefined), undefined);
  assert.equal(publicBase('img.shop.com/'), 'https://img.shop.com');
  assert.equal(publicBase('https://img.shop.com//'), 'https://img.shop.com');
  assert.equal(publicBase(''), '');
});

// ── search ────────────────────────────────────────────────────
const P = (name: string, short = '', extra: any = {}) => ({ name, short, ...extra });
test('search matches name and short description only', () => {
  assert.ok(matchScore(P('LED Flood Light 50W'), 'flood') > 0);
  assert.ok(matchScore(P('Hammer', 'Heavy duty steel hammer for demolition'), 'demolition') > 0);
  assert.equal(matchScore(P('Hammer', 'steel'), 'cable'), 0);
  assert.equal(matchScore(P('Hammer'), 'hello'), 0);
  assert.equal(matchScore({ name: 'Hammer', extra: undefined }, 'H1-sku'), 0);       // SKU / tags / brand / category never match
  assert.ok(matchScore({ name: 'Hammer', extra: 'H1-SKU' }, 'h1-sku') > 0);            // ...unless the admin picker passes the SKU
});
test('search needs every word, tolerates one typo, understands Arabic, ranks name above description', () => {
  assert.equal(matchScore(P('LED Flood Light'), 'led pump'), 0);
  assert.ok(matchScore(P('LED Flood Light'), 'led flood') > 0);
  assert.ok(matchScore(P('Hammer'), 'hammr') > 0);
  assert.equal(matchScore(P('Hammer'), 'hxxxr'), 0);
  assert.ok(matchScore({ name: 'Cable', nameAr: 'كيبل نحاس' }, 'نحاس') > 0);
  assert.ok(matchScore({ name: 'Wire clip', short: 'for cable' }, 'cable') < matchScore({ name: 'Cable 2.5mm' }, 'cable'));
  assert.equal(matchScore(P('Anything'), ''), 1);                                      // empty box lists everything
});
test('bundles are searchable by name', async () => {
  const db = new FakeDb(); __setAdminDbForTests(db);
  db.seed('bundles', 'b1', { name: 'Bathroom starter kit', isActive: true, bundlePrice: 20, items: [] });
  db.seed('bundles', 'b2', { name: 'Garden hose set', isActive: true, bundlePrice: 9, items: [] });
  db.seed('bundles', 'b3', { name: 'Bathroom hidden', isActive: false, bundlePrice: 9, items: [] });
  assert.deepEqual((await searchBundles('bathroom')).map((b: any) => b.id), ['b1']);
  assert.equal((await searchBundles('bathroom', 6, true)).length, 2);               // admin picker also sees inactive ones
  assert.equal((await searchBundles('zzzz')).length, 0);
});

// ── coupons: one use per customer ─────────────────────────────
test('computeCoupon: per-customer limit', () => {
  const c: any = { code: 'ONCE', type: 'percentage', value: 10, isActive: true, perUserLimit: 1 };
  assert.equal(computeCoupon(c, 100, new Date(), 0).valid, true);
  const r = computeCoupon(c, 100, new Date(), 1);
  assert.equal(r.valid, false); assert.match(r.error!, /already used/);
  assert.equal(computeCoupon({ ...c, perUserLimit: 2 }, 100, new Date(), 1).valid, true);
  assert.equal(computeCoupon({ ...c, perUserLimit: null }, 100, new Date(), 99).valid, true);
});

const addr = { firstName: 'Ali', lastName: 'K', phone: '55512345', governorate: 'Hawalli', city: 'Hawalli', block: '1', street: '2', building: '3' };
const input = (items: any[], o: any = {}) => ({ userId: 'u1', userEmail: 'a@b.com', userName: 'Ali', items, shippingAddress: addr, paymentMethod: 'cod' as const, ...o });
function seedShop(db: FakeDb) {
  db.seed('products', 'p1', { name: 'Cable', sku: 'C1', price: 10, stock: 100, isActive: true, categoryId: 'cat1' });
  db.seed('shippingZones', 'z1', { name: 'Capital', isActive: true, governorates: ['Hawalli'], rates: [{ id: 'r1', name: 'Std', basePrice: 2, estimatedDays: '1-2', isActive: true }] });
  db.seed('config', 'storeSettings', { freeShippingThreshold: 1000 });
}
test('coupon once per customer: second order is refused, other customer is fine, cancel frees the use', async () => {
  const db = new FakeDb(); __setAdminDbForTests(db); seedShop(db);
  db.seed('coupons', 'c1', { code: 'WELCOME', type: 'percentage', value: 10, isActive: true, usedCount: 0, perUserLimit: 1 });
  const first: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }], { couponCode: 'welcome' }));
  assert.equal(db.read('orders', first.orderId || first.id).discount, 1);
  assert.equal(db.read('couponUsage', 'c1_u1').count, 1);
  // checkout preview says so before the customer pays
  const q: any = await quoteShipping([{ productId: 'p1', quantity: 1 }], 'Hawalli', 'u1', 'WELCOME');
  assert.match(q.couponError, /already used/); assert.equal(q.discount, 0);
  await assert.rejects(() => placeOrder(input([{ productId: 'p1', quantity: 1 }], { couponCode: 'WELCOME' })), (e: any) => e instanceof OrderError && e.code === 'BAD_COUPON');
  const other: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }], { couponCode: 'WELCOME', userId: 'u2', userEmail: 'c@d.com' }));
  assert.equal(db.read('orders', other.orderId || other.id).discount, 1);
  await cancelOrder({ orderId: first.orderId || first.id, actor: { id: 'u1', role: 'customer' } as any, note: 't' });
  assert.equal(db.read('couponUsage', 'c1_u1').count, 0);
  const again: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }], { couponCode: 'WELCOME' }));
  assert.equal(db.read('orders', again.orderId || again.id).discount, 1);
});
test('coupon without a per-customer limit can be reused', async () => {
  const db = new FakeDb(); __setAdminDbForTests(db); seedShop(db);
  db.seed('coupons', 'c1', { code: 'OPEN', type: 'fixed', value: 1, isActive: true, usedCount: 0 });
  await placeOrder(input([{ productId: 'p1', quantity: 1 }], { couponCode: 'OPEN' }));
  const r: any = await placeOrder(input([{ productId: 'p1', quantity: 1 }], { couponCode: 'OPEN' }));
  assert.equal(db.read('orders', r.orderId || r.id).discount, 1);
});

// ── flash deals on bundles ────────────────────────────────────
test('a deal that names a bundle discounts it; "all products" deals leave bundles alone', () => {
  const NOW = Date.now(), live = { startAt: new Date(NOW - 1e6).toISOString(), endAt: new Date(NOW + 1e6).toISOString(), isActive: true };
  const lines: any[] = [
    { productId: 'bundle:b1', price: 20, quantity: 1, total: 20, bundleItems: [{ productId: 'p1', quantity: 2 }] },
    { productId: 'p1', price: 10, quantity: 1, total: 10 },
  ];
  const all = applyFlashDeals(lines, [{ id: 'dAll', type: 'percentage', discountValue: 50, scope: 'all', ...live }]);
  assert.equal(all.lines[0].price, 20); assert.equal(all.lines[1].price, 5);          // product discounted, bundle not
  const named = applyFlashDeals(lines, [{ id: 'dB', type: 'percentage', discountValue: 25, scope: 'products', productIds: ['bundle:b1'], ...live }]);
  assert.equal(named.lines[0].price, 15); assert.equal(named.lines[0].dealId, 'dB'); assert.equal(named.lines[1].price, 10);
  assert.equal(named.totalSaving, 5);
});
test('placeOrder charges the bundle deal price and counts the deal', async () => {
  const db = new FakeDb(); __setAdminDbForTests(db); seedShop(db);
  const FUT = new Date(Date.now() + 86400000).toISOString(), PAST = new Date(Date.now() - 86400000).toISOString();
  db.seed('bundles', 'b1', { name: 'Kit', isActive: true, bundlePrice: 20, items: [{ productId: 'p1', quantity: 2 }] });
  db.seed('flashDeals', 'd1', { title: 'Kit week', type: 'percentage', discountValue: 10, scope: 'products', productIds: ['bundle:b1'], startAt: PAST, endAt: FUT, isActive: true });
  const r: any = await placeOrder(input([{ productId: 'bundle:b1', quantity: 1 }]));
  const o = db.read('orders', r.orderId || r.id);
  assert.equal(o.subtotal, 18); assert.equal(o.dealDiscount, 2); assert.equal(db.read('flashDeals', 'd1').usedCount, 1);
  assert.equal(db.read('products', 'p1').stock, 98);                                   // bundle components still leave stock
});

// ── recommendations ───────────────────────────────────────────
const prod = (id: string, name: string, o: any = {}) => ({ id, name, price: 5, stock: 10, isActive: true, categoryId: 'c1', ...o });
test('recommendations: bought-together first, unrelated and out-of-stock never', () => {
  const seed = prod('s', 'Circuit breaker 20A', { categoryId: 'elec' });
  const pairs = new Map([['s', new Map([['plug', 4]])]]);
  const cands = [
    prod('plug', 'Wall plug', { categoryId: 'acc' }),
    prod('b2', 'Circuit breaker 32A', { categoryId: 'elec' }),
    prod('paint', 'White paint 4L', { categoryId: 'paint', price: 40 }),
    prod('gone', 'Circuit breaker 10A', { categoryId: 'elec', stock: 0 }),
    seed,
  ];
  const r = scoreRecommendations([seed], cands, pairs as any, 8);
  assert.deepEqual(r.map(x => x.product.id), ['plug', 'b2']);
  assert.equal(r[0].reason, 'frequently_bought_together'); assert.equal(r[1].reason, 'similar_specs'); // shares "circuit breaker" with the seed
});
test('recommendations: several seeds (the cart) are combined, cart items are excluded', () => {
  const a = prod('a', 'Cable 2.5mm', { categoryId: 'cab' }), b = prod('b', 'Switch 1 gang', { categoryId: 'sw' });
  const r = scoreRecommendations([a, b], [a, b, prod('c', 'Cable 4mm', { categoryId: 'cab' }), prod('d', 'Switch 2 gang', { categoryId: 'sw' }), prod('e', 'Tape', { categoryId: 'x' })], new Map(), 8);
  assert.deepEqual(r.map(x => x.product.id).sort(), ['c', 'd']);
  assert.deepEqual(scoreRecommendations([], [a], new Map()), []);
  assert.ok(tokens('LED 9W bulb').has('led')); assert.ok(!tokens('LED 9W bulb').has('9w'));
});

// ── Claude + fallback ─────────────────────────────────────────
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY; });
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('Gemini tool declarations convert to OpenAI tools', () => {
  const t = toOpenAITools([{ name: 'x', description: 'd', parameters: { type: 'OBJECT', properties: { q: { type: 'STRING' }, l: { type: 'ARRAY', items: { type: 'NUMBER' } } }, required: ['q'] } }]);
  assert.equal(t[0].type, 'function'); assert.equal(t[0].function.parameters.type, 'object'); assert.equal(t[0].function.parameters.properties.q.type, 'string');
  assert.equal(t[0].function.parameters.properties.l.items.type, 'number'); assert.deepEqual(t[0].function.parameters.required, ['q']);
});
test('OpenAI assistant: runs the tool, sends the result back, returns the final text and proposals', async () => {
  process.env.OPENAI_API_KEY = 'k';
  const sent: any[] = [];
  globalThis.fetch = (async (_u: any, init: any) => {
    const body = JSON.parse(init.body); sent.push(body);
    if (sent.length === 1) return json({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'search_products', arguments: '{"query":"cable"}' } }] } }] });
    return json({ choices: [{ message: { role: 'assistant', content: 'Cable is 10 KWD.' } }] });
  }) as any;
  const r = await openaiAgent({
    system: 'sys', tools: [{ name: 'search_products', description: 'd', parameters: { type: 'OBJECT', properties: {} } }],
    history: [{ role: 'user', text: 'price of cable?' }],
    runTool: async (_n, a) => ({ data: { found: [{ name: 'Cable', price: 10 }], args: a }, pending: { name: 'admin_x', args: {}, summary: 'do x' } }),
  });
  assert.equal(r.text, 'Cable is 10 KWD.'); assert.equal(r.pending.length, 1);
  const back = sent[1].messages.at(-1); assert.equal(back.role, 'tool'); assert.equal(back.tool_call_id, 't1'); assert.match(back.content, /Cable/);
});
test('aiText: bulk jobs go to OpenAI first, live jobs to Gemini first, and each covers for the other', async () => {
  process.env.OPENAI_API_KEY = 'k'; process.env.GEMINI_API_KEY = 'g';
  const hits: string[] = [];
  globalThis.fetch = (async (u: any) => {
    hits.push(String(u));
    if (String(u).includes('openai')) return json({ error: { message: 'down' } }, 500);
    return json({ candidates: [{ content: { parts: [{ text: '{"a":"مرحبا"}' }] } }] });
  }) as any;
  const r = await aiText({ system: 's', user: 'u', json: true, fast: true, job: 'bulk' });
  assert.equal(r.provider, 'gemini'); assert.deepEqual(parseJsonLoose(r.text), { a: 'مرحبا' });
  assert.ok(hits[0].includes('openai'));
  globalThis.fetch = (async (u: any) => String(u).includes('openai') ? json({ choices: [{ message: { content: 'hello' } }] }) : json({ error: {} }, 500)) as any;
  assert.equal((await aiText({ system: 's', user: 'u', job: 'bulk' })).provider, 'openai');
});
test('parseJsonLoose copes with fences and chatter', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Sure! {"a":1} done'), { a: 1 });
  assert.deepEqual(parseJsonLoose('nope'), {});
});

// ── invoice ───────────────────────────────────────────────────
test('invoice PDF builds (English and Arabic lines) without touching the network', async () => {
  const db = new FakeDb(); __setAdminDbForTests(db);
  const buf = await buildInvoicePdf({
    orderNumber: 'ABC-1234', createdAt: new Date().toISOString(), status: 'confirmed', paymentMethod: 'cod', paymentStatus: 'pending',
    items: [{ productName: 'Cable 2.5mm', productNameAr: 'كيبل ٢٫٥ ملم', productSku: 'C1', quantity: 2, price: 10, total: 20 }],
    subtotal: 20, shippingCost: 2, discount: 0, total: 22,
    shippingAddress: { firstName: 'Ali', lastName: 'K', phone: '55512345', governorate: 'Hawalli', city: 'Hawalli', block: '1', street: '2', building: '3' },
    userName: 'Ali K', userEmail: 'a@b.com',
  });
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-'); assert.ok(buf.length > 2000);
});
