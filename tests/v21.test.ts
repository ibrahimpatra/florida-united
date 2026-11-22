import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { FakeDb } from './fakeFirestore';
import { __setAdminDbForTests } from '../src/lib/firebase-admin';
import { sanitizeHtml, renderDescription, stripHtml } from '../src/lib/sanitize-html';
import { SPECS, missingFields } from '../src/lib/entity-fill';
import { planCategoryImport } from '../src/lib/category-import';
import { assistSheet } from '../src/lib/import-assist';
import { runJob, enqueueFill } from '../src/lib/jobs';

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const openai = (content: any) => (async () => json({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] })) as any;
let db: FakeDb;
beforeEach(() => { db = new FakeDb(); __setAdminDbForTests(db); process.env.OPENAI_API_KEY = 'k'; delete process.env.GEMINI_API_KEY; });

// ── descriptions are HTML-safe ────────────────────────────────
test('sanitizer keeps simple formatting and removes anything that can run code', () => {
  assert.equal(sanitizeHtml('<p>Hi <strong>there</strong></p><ul><li>a</li></ul>'), '<p>Hi <strong>there</strong></p><ul><li>a</li></ul>');
  const bad = '<p onclick="x()">a</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a><iframe src="//e.com"></iframe><svg onload=1></svg><style>*{}</style>';
  const out = sanitizeHtml(bad);
  assert.ok(!/script|onerror|onclick|onload|javascript:|iframe|<style|<svg/i.test(out), out);
  assert.match(sanitizeHtml('<a href="https://ok.com/x" onclick="y">go</a>'), /^<a href="https:\/\/ok\.com\/x" rel="noopener noreferrer nofollow" target="_blank">go<\/a>$/);
  assert.ok(!sanitizeHtml('<a href=" JaVa\nScript:alert(1)">x</a>').includes('href='));
  assert.ok(!sanitizeHtml('<img src="//evil.com/x.png">').includes('src='));
  assert.equal(sanitizeHtml('<p>unclosed <b>bold'), '<p>unclosed <b>bold</b></p>');
  assert.equal(sanitizeHtml('1 < 2 and 3 > 2'), '1 &lt; 2 and 3 &gt; 2');
});
test('old plain-text descriptions become paragraphs; meta text is stripped of tags', () => {
  assert.equal(renderDescription('Line one\nline two\n\nSecond para'), '<p>Line one<br>line two</p><p>Second para</p>');
  assert.equal(renderDescription('Plain <script>x</script>text').includes('script'), false);
  assert.equal(stripHtml('<p>Hello&nbsp;<b>world</b></p><script>x()</script>'), 'Hello world');
});

// ── what is missing ───────────────────────────────────────────
test('missingFields: translates only when English exists, writes SEO only when empty, needs a name', () => {
  const c = SPECS.categories;
  assert.deepEqual(missingFields(c, { name: 'Cables', description: 'Copper cables', nameAr: 'كيابل', descriptionAr: 'x', metaTitle: 'a', metaDesc: 'b', metaTitleAr: 'أ', metaDescAr: 'ب', tags: ['t'] }), []);
  assert.deepEqual(missingFields(c, { name: 'Cables' }).sort(), ['description', 'metaDesc', 'metaDescAr', 'metaTitle', 'metaTitleAr', 'nameAr', 'tags']);
  assert.deepEqual(missingFields(c, { description: 'no name' }), []);
  const b = SPECS.banners;
  assert.deepEqual(missingFields(b, { title: 'Sale', image: '/media/banners/a.webp' }).sort(), ['imageAlt', 'imageAltAr', 'titleAr']);
  assert.deepEqual(missingFields(b, { title: 'Sale' }), ['titleAr']);                               // no picture: no alt text needed
});

// ── background fill job for non-product items ─────────────────
test('fill job writes blank Arabic + SEO for a category and keeps what was written', async () => {
  db.seed('categories', 'c1', { name: 'Cables', description: 'Hand written', slug: 'cables' });
  db.seed('jobs', 'fill_categories_c1', { type: 'fill', collection: 'categories', status: 'queued', productId: 'c1', productName: 'Cables', attempts: 0, createdAt: 'x', updatedAt: new Date().toISOString() });
  globalThis.fetch = openai({ nameAr: 'كيابل', descriptionAr: 'كيابل نحاس', metaTitle: 'Cables | Florida', metaDesc: 'Buy cables', tags: ['Cables', 'كيابل'], description: 'AI TEXT' });
  await runJob('fill_categories_c1');
  const c = db.read('categories', 'c1'); const j = db.read('jobs', 'fill_categories_c1');
  assert.equal(c.description, 'Hand written'); assert.equal(c.nameAr, 'كيابل'); assert.equal(c.metaTitle, 'Cables | Florida'); assert.deepEqual(c.tags, ['cables', 'كيابل']);
  assert.equal(j.status, 'done', JSON.stringify(j)); assert.ok(!j.result.filled.includes('description'));
});
test('saving an item with blanks queues a fill job; nothing is queued when complete or without an AI key', async () => {
  db.seed('banners', 'b1', { title: 'Sale', image: '/media/banners/a.webp' });
  delete process.env.OPENAI_API_KEY; await enqueueFill('banners', 'b1'); assert.equal(db.read('jobs', 'fill_banners_b1'), undefined);
  process.env.OPENAI_API_KEY = 'k'; globalThis.fetch = (async () => json({ error: {} }, 500)) as any;
  await enqueueFill('banners', 'b1'); await new Promise(r => setTimeout(r, 30));
  assert.ok(db.read('jobs', 'fill_banners_b1'));
  db.seed('banners', 'b2', { title: 'Sale', titleAr: 'تخفيض', imageAlt: 'a', imageAltAr: 'ب', image: '/x.webp' });
  await enqueueFill('banners', 'b2'); assert.equal(db.read('jobs', 'fill_banners_b2'), undefined);
});

// ── category spreadsheet ──────────────────────────────────────
const existing = [{ id: 'e1', name: 'Electrical', slug: 'electrical' }, { id: 'e2', name: 'Cables', slug: 'cables', parentId: 'e1' }];
test('category import: creates, updates, resolves parents inside the file and rejects bad rows', () => {
  const rows = [
    ['name', 'nameAr', 'parent', 'sortOrder', 'tags', 'isActive'],
    ['Switches', '', 'Electrical', '2', 'switch, socket', 'yes'],     // new sub of an existing main category
    ['Plumbing', 'سباكة', '', '', '', ''],                            // new main
    ['Pipes', '', 'Plumbing', '', '', ''],                            // sub of a main category defined in the same file
    ['Cables', 'كيابل', 'Electrical', '', '', ''],                    // existing: update
    ['Ghost', '', 'Nowhere', '', '', ''],                             // bad parent
    ['', '', '', '', '', ''],                                         // blank line: ignored
    ['Bad', '', '', 'abc', '', ''],                                   // bad number
    ['Pipes', '', 'Plumbing', '', '', ''],                            // duplicate
  ];
  const p = planCategoryImport(rows, existing);
  assert.deepEqual(p.counts, { create: 3, update: 1, error: 3 });
  const by = (n: string, l?: number) => p.rows.find(r => r.name === n && (l === undefined || r.line === l))!;
  assert.equal(by('Switches').action, 'create'); assert.equal(by('Switches').parentId, 'e1'); assert.deepEqual(by('Switches').data!.tags, ['switch', 'socket']);
  assert.equal(by('Pipes', 4).action, 'create'); assert.equal(by('Cables').action, 'update'); assert.equal(by('Cables').id, 'e2'); assert.deepEqual(by('Cables').changes, ['nameAr']);
  assert.match(by('Ghost').message!, /parent/); assert.match(by('Bad').message!, /sortOrder/); assert.match(by('Pipes', 9).message!, /twice/);
});
test('category import: header problems are explained', () => {
  assert.match(planCategoryImport([['title'], ['x']], []).headerError!, /name/);
  assert.match(planCategoryImport([['name']], []).headerError!, /No data/);
});

// ── "complete my sheet" ───────────────────────────────────────
test('assistant writes only blank cells, keeps filled ones, adds missing columns and fixes header case', async () => {
  globalThis.fetch = (async (_u: any, init: any) => {
    const items = JSON.parse(JSON.parse(init.body).messages.at(-1).content);
    return json({ choices: [{ message: { content: JSON.stringify({ rows: items.map((it: any) => ({ row: it.row, nameAr: 'اسم', shortDescription: 'Short', shortDescriptionAr: 'قصير', description: '<p>Long</p>', descriptionAr: 'طويل', tags: ['a', 'b'], category: 'Electrical', subcategory: 'Cables' })) }) } }] });
  }) as any;
  const rows = [['SKU', 'Name', 'Price', 'nameAr', 'Category'], ['S1', 'Cable 2.5mm', '5', 'كيبل كتبته أنا', ''], ['S2', 'Switch', '1', '', 'Electrical'], ['S3', '', '1', '', '']];
  const r = await assistSheet(rows, 'products', { deadline: Date.now() + 40_000, categories: [{ name: 'Electrical' }, { name: 'Cables', parentName: 'Electrical' }] });
  const h = r.rows[0]; const cell = (row: number, k: string) => r.rows[row][h.indexOf(k)];
  assert.ok(h.includes('sku') && h.includes('name') && h.includes('shortDescription') && h.includes('tags'));
  assert.equal(cell(1, 'nameAr'), 'كيبل كتبته أنا');                         // never overwritten
  assert.equal(cell(2, 'category'), 'Electrical'); assert.equal(cell(2, 'nameAr'), 'اسم'); assert.equal(cell(1, 'category'), 'Electrical');
  assert.equal(cell(1, 'tags'), 'a, b'); assert.equal(cell(3, 'nameAr'), '');   // a row without a name is skipped
  assert.equal(r.rowsLeft, 0); assert.ok(r.filledCells >= 10);
});
test('assistant reports rows it could not reach instead of failing the whole sheet', async () => {
  globalThis.fetch = (async () => json({ error: { message: 'busy' } }, 500)) as any;
  const r = await assistSheet([['name'], ['A'], ['B']], 'categories', { deadline: Date.now() + 40_000 });
  assert.equal(r.filledCells, 0); assert.equal(r.rowsLeft, 2); assert.ok(r.error);
});
