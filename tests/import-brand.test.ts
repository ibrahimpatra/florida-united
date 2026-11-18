import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planImport, parseUnits, IMPORT_COLUMNS, TEMPLATE_ROWS } from '../src/lib/product-import';
import { parseCsv, parseXlsx, buildTemplateXlsx } from '../src/lib/import-file';
import { mergeBrand, colourScale, themeCss, isHex, DEFAULT_BRAND } from '../src/lib/brand';

const ctx = () => ({
  categories: [{ id: 'c1', name: 'Lighting', slug: 'lighting' }, { id: 'c2', name: 'Outdoor', slug: 'outdoor', parentId: 'c1' }],
  products: [{ id: 'p1', sku: 'OLD-1', slug: 'old-1', stock: 5 }],
  uoms: [{ id: 'u1', name: 'Pieces', abbreviation: 'pcs' }],
});
const H = ['sku', 'name', 'price', 'stock', 'category', 'subcategory', 'uom'];

test('creates a new product with defaults and category path', () => {
  const p = planImport([H, ['N-1', 'Lamp', '2.5', '10', 'Lighting', 'Outdoor', 'pcs']], ctx());
  assert.equal(p.counts.create, 1);
  const d = p.rows[0].data!;
  assert.equal(d.categoryId, 'c2'); assert.deepEqual(d.categoryPath, ['c1', 'c2']); assert.equal(d.uomId, 'u1');
  assert.equal(d.isActive, true); assert.equal(d.slug, 'lamp');
  assert.ok(!Object.values(d).includes(undefined));
});
test('existing SKU updates only filled columns and reports stock change', () => {
  const p = planImport([['sku', 'price', 'stock', 'name'], ['old-1', '', '9', '']], ctx());
  assert.equal(p.rows[0].action, 'update'); assert.equal(p.rows[0].id, 'p1');
  assert.deepEqual(Object.keys(p.rows[0].data!), ['stock']); assert.ok(p.rows[0].changes![0].includes('5 → 9'));
});
test('rows with problems are reported, not thrown', () => {
  const p = planImport([H, ['', 'x', '1', '1', 'Lighting', '', ''], ['A', 'x', 'abc', '1', 'Lighting', '', ''], ['B', 'x', '-1', '1', 'Lighting', '', ''],
    ['C', '', '1', '1', 'Lighting', '', ''], ['D', 'x', '1', '', 'Lighting', '', ''], ['E', 'x', '1', '1', '', '', ''], ['F', 'x', '1', '1', 'Lighting', '', ''], ['f', 'x', '1', '1', 'Lighting', '', '']], ctx());
  assert.equal(p.counts.error, 7); assert.equal(p.counts.create, 1);
});
test('missing categories and units are queued when createMissing, errors otherwise', () => {
  const rows = [H, ['N-2', 'Pipe', '1', '1', 'Plumbing', 'PVC', 'metre']];
  const a = planImport(rows, { ...ctx(), createMissing: true });
  assert.equal(a.counts.create, 1); assert.deepEqual(a.newCategories.map(c => c.name), ['Plumbing', 'PVC']); assert.equal(a.newUoms[0].name, 'metre');
  assert.equal(planImport(rows, ctx()).counts.error, 1);
});
test('units column parses and rejects bad entries', () => {
  assert.equal(parseUnits('Box of 12|12|45; Carton|48|170').units.length, 2);
  assert.ok(parseUnits('Box|1|5').error);
});
test('header problems', () => {
  assert.ok(planImport([['name'], ['x']], ctx()).headerError);
  assert.ok(planImport([['sku']], ctx()).headerError);
});
test('csv with semicolons, quotes and BOM', () => {
  const r = parseCsv('﻿sku;name\r\nA;"Hello; ""World"""\r\n');
  assert.deepEqual(r, [['sku', 'name'], ['A', 'Hello; "World"']]);
});
test('template xlsx round-trips and plans cleanly', async () => {
  const buf = await buildTemplateXlsx(TEMPLATE_ROWS);
  const rows = await parseXlsx(buf);
  assert.deepEqual(rows[0], [...IMPORT_COLUMNS]);
  const p = planImport(rows, { ...ctx(), createMissing: true });
  assert.equal(p.counts.error, 0); assert.equal(p.counts.create, 1);
});

test('brand: defaults, overrides and ignoring bad colours', () => {
  assert.equal(mergeBrand({}).name, DEFAULT_BRAND.name);
  const b = mergeBrand({ storeName: 'Acme Tools', brandColor: '#112233', accentColor: 'red', logoUrl: ' x.png ' });
  assert.equal(b.name, 'Acme Tools'); assert.equal(b.fullName, 'Acme Tools'); assert.equal(b.logoText, 'AT');
  assert.equal(b.brandColor, '#112233'); assert.equal(b.accentColor, DEFAULT_BRAND.accentColor); assert.equal(b.logoUrl, 'x.png');
});
test('brand: colour scale and css', () => {
  const s = colourScale('#234b63', 600);
  assert.equal(s[600], '#234b63'); assert.ok(isHex(s[50]) && isHex(s[950]));
  assert.equal(themeCss('#234b63', '#f5b800'), '');
  assert.match(themeCss('#112233', '#f5b800'), /--brand-600:17 34 51/);
});
