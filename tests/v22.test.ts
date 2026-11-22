import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { createBrand, updateBrand, deleteBrand, getBrands, ensureBrands, getHomeBrands, BrandError } from '../src/lib/brands';
import { planBrandImport } from '../src/lib/brand-import';
import { SPECS, missingFields } from '../src/lib/entity-fill';
import { assistSheet } from '../src/lib/import-assist';
import { runJob, queueAllMissing } from '../src/lib/jobs';
import { sanitizePopup } from '../src/lib/popups';
import { siteBase, productLink } from '../src/lib/site-url';
import { buildShareUrl } from '../src/lib/utils';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const openai = (content: any) => (async () => json({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] })) as any;
let db: FakeDb;
beforeEach(() => { db = new FakeDb(); __setAdminDbForTests(db); process.env.OPENAI_API_KEY = 'k'; delete process.env.GEMINI_API_KEY; globalThis.fetch = (async () => json({ error: {} }, 500)) as any; });

test('brands: create makes a slug, rejects duplicates, lists active ones in order', async () => {
  const a = await createBrand({ name: ' Siemens ', sortOrder: 2 }); await createBrand({ name: 'Bosch', sortOrder: 1 });
  assert.equal(db.read('brands', a).slug, 'siemens'); assert.equal(db.read('brands', a).name, 'Siemens');
  await assert.rejects(() => createBrand({ name: 'siemens' }), (e: any) => e instanceof BrandError && e.status === 409);
  await assert.rejects(() => createBrand({ name: '' }), BrandError);
  await assert.rejects(() => createBrand({ name: 'X', website: 'javascript:1' }), BrandError);
  const b2 = await createBrand({ name: 'Hidden', isActive: false });
  assert.deepEqual((await getBrands(true)).map(b => b.name), ['Bosch', 'Siemens']);
  assert.equal((await getBrands(false)).length, 3); assert.ok(b2);
});
test('brands: renaming follows into products; slug never changes; delete keeps product text', async () => {
  const id = await createBrand({ name: 'Bosh' });
  db.seed('products', 'p1', { name: 'Drill', brand: 'Bosh' }); db.seed('products', 'p2', { name: 'Saw', brand: 'Other' });
  await updateBrand(id, { name: 'Bosch', slug: 'hacked' });
  assert.equal(db.read('products', 'p1').brand, 'Bosch'); assert.equal(db.read('products', 'p2').brand, 'Other'); assert.equal(db.read('brands', id).slug, 'bosh');
  await deleteBrand(id); assert.equal(db.read('brands', id), undefined); assert.equal(db.read('products', 'p1').brand, 'Bosch');
});
test('ensureBrands adds only the missing names once (case-insensitive)', async () => {
  await createBrand({ name: 'Bosch' });
  assert.equal(await ensureBrands(['bosch', 'Makita', 'MAKITA', ' ', 'Hilti']), 2);
  assert.equal((await getBrands(false)).length, 3);
  assert.equal(await ensureBrands(['makita']), 0);
});
test('home brands: managed ones with logos; falls back to product brands when none are managed', async () => {
  db.seed('products', 'p1', { name: 'a', brand: 'Hilti', isActive: true }); db.seed('products', 'p2', { name: 'b', brand: 'Hilti', isActive: true });
  assert.deepEqual((await getHomeBrands()).map(b => b.name), ['Hilti']);
  await createBrand({ name: 'Bosch', image: '/media/brands/a.webp' }); await createBrand({ name: 'Off', showOnHome: false });
  const h = await getHomeBrands(); assert.deepEqual(h.map(b => b.name), ['Bosch']); assert.equal(h[0].image, '/media/brands/a.webp');
});

test('brand import plan: create/update by name, validates, never overwrites with blanks', () => {
  const p = planBrandImport([['Name', 'Name Ar', 'tags', 'website', 'image'], ['Siemens', 'سيمنز', 'a; b', 'https://s.com', ''], ['Bosch', '', '', '', ''], ['Siemens', '', '', '', ''], ['Bad', '', '', 'ftp://x', ''], ['', 'x', '', '', ''], ['Logo', '', '', '', 'logo.png']],
    [{ id: 'b1', name: 'Bosch' }]);
  assert.equal(p.counts.create, 1); assert.equal(p.counts.update, 1); assert.equal(p.counts.error, 4);
  assert.deepEqual(p.rows[0].data?.tags, ['a', 'b']); assert.equal(p.rows[1].action, 'update'); assert.match(p.rows[1].message || '', /nothing to change/);
  assert.equal(planBrandImport([['x'], ['y']], []).headerError, 'Missing required column: name');
});

test('SPECS: brands are filled by the background job, including logo alt text', () => {
  assert.ok(SPECS.brands);
  assert.deepEqual(missingFields(SPECS.brands, { name: 'Bosch', image: '/l.webp' }).sort(), ['description', 'descriptionAr'.replace('descriptionAr', 'imageAlt'), 'imageAltAr', 'metaDesc', 'metaDescAr', 'metaTitle', 'metaTitleAr', 'nameAr', 'tags'].sort());
  assert.deepEqual(missingFields(SPECS.brands, { name: 'Bosch' }).sort(), ['description', 'metaDesc', 'metaDescAr', 'metaTitle', 'metaTitleAr', 'nameAr', 'tags']);
});
test('cron (queueAllMissing) queues unfilled brands and popups with pictures', async () => {
  db.seed('brands', 'b1', { name: 'Bosch', slug: 'bosch' });
  db.seed('brands', 'b2', { name: 'Full', nameAr: 'ف', description: 'd', descriptionAr: 'و', metaTitle: 't', metaDesc: 'm', metaTitleAr: 'ت', metaDescAr: 'م', tags: ['a'] });
  db.seed('popups', 'pp1', { title: 'Hi', titleAr: 'مرحبا', body: 'x', bodyAr: 'y', ctaText: 'Go', ctaTextAr: 'اذهب', image: '/media/banners/a.webp' });
  await queueAllMissing(50);
  assert.ok(db.read('jobs', 'fill_brands_b1')); assert.equal(db.read('jobs', 'fill_brands_b2'), undefined); assert.ok(db.read('jobs', 'fill_popups_pp1'));
});
test('fill job completes a brand', async () => {
  db.seed('brands', 'b1', { name: 'Bosch', slug: 'bosch' });
  db.seed('jobs', 'fill_brands_b1', { type: 'fill', collection: 'brands', status: 'queued', productId: 'b1', productName: 'Bosch', attempts: 0, createdAt: 'x', updatedAt: new Date().toISOString() });
  globalThis.fetch = openai({ nameAr: 'بوش', description: 'Power tools', descriptionAr: 'أدوات', metaTitle: 'Bosch tools in Kuwait', metaDesc: 'Buy Bosch tools', tags: ['bosch', 'بوش'] });
  await runJob('fill_brands_b1');
  const b = db.read('brands', 'b1'); assert.equal(b.nameAr, 'بوش'); assert.equal(b.metaTitle, 'Bosch tools in Kuwait'); assert.equal(db.read('jobs', 'fill_brands_b1').status, 'done');
});
test('assistant completes a brand sheet and leaves written cells alone', async () => {
  globalThis.fetch = openai({ rows: [{ row: 0, nameAr: 'بوش', description: 'Tools', descriptionAr: 'أدوات', metaTitle: 'Bosch', metaDesc: 'Bosch tools', tags: 'bosch, بوش' }] });
  const r = await assistSheet([['name', 'description'], ['Bosch', 'My own text']], 'brands', { deadline: Date.now() + 40_000 });
  const h = r.rows[0]; const row = r.rows[1];
  assert.equal(row[h.indexOf('description')], 'My own text'); assert.equal(row[h.indexOf('nameAr')], 'بوش'); assert.ok(r.filledCells >= 4);
});
test('popup picture description is kept and trimmed', () => {
  const p: any = sanitizePopup({ title: 'T', image: '/a.webp', imageAlt: ' Drill ', imageAltAr: 'مثقاب' });
  assert.equal(p.imageAlt, 'Drill'); assert.equal(p.imageAltAr, 'مثقاب');
});

test('share links are real web addresses, never localhost, and use /shop/products', () => {
  const keep = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL; assert.equal(buildShareUrl('drill'), 'https://floridakuwait.com/shop/products/drill');
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'; assert.equal(siteBase(), 'https://floridakuwait.com');
  process.env.NEXT_PUBLIC_APP_URL = 'capacitor://localhost'; assert.equal(siteBase(), 'https://floridakuwait.com');
  process.env.NEXT_PUBLIC_APP_URL = 'https://shop.example.com/'; assert.equal(productLink('x', true), 'https://shop.example.com/ar/shop/products/x');
  if (keep === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = keep;
});

test('Arabic SEO: SPECS and products list Arabic meta as missing; the job fills it and keeps what exists', async () => {
  for (const k of ['categories', 'brands', 'flashDeals', 'bundles']) assert.ok(SPECS[k].seo.includes('metaTitleAr') && SPECS[k].seo.includes('metaDescAr'), k);
  const { missingSeo } = await import('../src/lib/jobs');
  const full = { name: 'a', nameAr: 'ا', description: 'd', shortDescription: 's', descriptionAr: 'د', shortDescriptionAr: 'ش', metaTitle: 't', metaDesc: 'm', tags: ['x'] };
  assert.deepEqual(missingSeo(full).sort(), ['metaDescAr', 'metaTitleAr']);
  db.seed('brands', 'b9', { name: 'Hilti', nameAr: 'هيلتي', description: 'd', descriptionAr: 'و', metaTitle: 'Keep', metaDesc: 'Keep', tags: ['a'] });
  db.seed('jobs', 'fill_brands_b9', { type: 'fill', collection: 'brands', status: 'queued', productId: 'b9', productName: 'Hilti', attempts: 0, createdAt: 'x', updatedAt: new Date().toISOString() });
  globalThis.fetch = openai({ metaTitleAr: 'هيلتي أدوات', metaDescAr: 'اشتري أدوات هيلتي', metaTitle: 'OVERWRITE' });
  await runJob('fill_brands_b9');
  const b = db.read('brands', 'b9'); assert.equal(b.metaTitleAr, 'هيلتي أدوات'); assert.equal(b.metaDescAr, 'اشتري أدوات هيلتي'); assert.equal(b.metaTitle, 'Keep');
});
test('share link in a browser uses the address the visitor is on, not localhost', () => {
  const g: any = globalThis; g.window = { location: { origin: 'https://shop.example.com' } };
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  assert.equal(productLink('drill', true), 'https://shop.example.com/ar/shop/products/drill');
  g.window = { location: { origin: 'http://localhost:3000' } }; delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(productLink('drill'), 'https://floridakuwait.com/shop/products/drill');
  delete g.window;
});

test('arabic pages keep links on the Arabic site; private pages are left alone', async () => {
  const { localizePath } = await import('../src/components/ui/LocLink');
  assert.equal(localizePath('/shop/cables', '/ar/shop'), '/ar/shop/cables'); assert.equal(localizePath('/', '/ar'), '/ar');
  assert.equal(localizePath('/search?q=a#x', '/ar/deals'), '/ar/search?q=a#x'); assert.equal(localizePath('/brands/x', '/ar'), '/ar/brands/x');
  assert.equal(localizePath('/checkout', '/ar/shop'), '/checkout'); assert.equal(localizePath('/account/orders', '/ar'), '/account/orders');
  assert.equal(localizePath('/shop/a', '/shop'), '/shop/a'); assert.equal(localizePath('https://x.com', '/ar'), 'https://x.com');
});
test('deals/bundles listing SEO comes from live items', async () => {
  const { listingSeo } = await import('../src/lib/seo');
  const s = listingSeo([{ metaTitle: 'T', metaDesc: 'D', metaTitleAr: 'ع', metaDescAr: 'و', tags: ['a', 'b'] }, { tags: ['b', 'c'] }], 'ar');
  assert.equal(s.title, 'ع'); assert.deepEqual(s.keywords, ['a', 'b', 'c']);
  assert.deepEqual(listingSeo([], 'en'), { title: undefined, description: undefined, keywords: undefined });
});
