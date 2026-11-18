/**
 * Pure planner for the product spreadsheet import (no Firestore here, so it is easy to test).
 * Input: rows (first row = headers) + what already exists. Output: what would be created / updated / rejected.
 * Rules:
 *  - SKU is the key. A new SKU creates a product; an existing SKU updates it (only the columns that are filled in).
 *  - Categories and units that do not exist yet are listed in `newCategories` / `newUoms` (the route creates them on import).
 *  - Nothing here ever touches costPrice visibility, ratings, sales counters or images that were not in the file.
 */
export const IMPORT_COLUMNS = [
  'sku', 'name', 'nameAr', 'price', 'comparePrice', 'costPrice', 'stock', 'lowStockAlert',
  'category', 'subcategory', 'brand', 'uom', 'units',
  'description', 'descriptionAr', 'shortDescription', 'shortDescriptionAr',
  'image', 'tags', 'weight', 'barcode',
  'freeShipping', 'isFeatured', 'isNewArrival', 'isOnSale', 'isActive', 'isReturnable', 'returnDays',
] as const;

export const MAX_IMPORT_ROWS = 5000;

export interface ImportCtx {
  categories: { id: string; name: string; nameAr?: string; slug?: string; parentId?: string }[];
  products: { id: string; sku: string; slug?: string; stock?: number }[];
  uoms: { id: string; name: string; nameAr?: string; abbreviation?: string; abbreviationAr?: string }[];
  createMissing?: boolean;
}
export interface PlanRow { line: number; action: 'create' | 'update' | 'error'; sku: string; name: string; id?: string; message?: string; changes?: string[]; data?: Record<string, any> }
export interface NewCategory { name: string; parentName?: string }
export interface NewUom { name: string; abbreviation: string }
export interface ImportPlan {
  headerError?: string; unknownColumns: string[]; rows: PlanRow[]; newCategories: NewCategory[]; newUoms: NewUom[];
  counts: { create: number; update: number; error: number };
}

export const normHeader = (h: any) => String(h ?? '').replace(/^﻿/, '').toLowerCase().replace(/[\s_\-]+/g, '');
const KNOWN = new Set<string>([...IMPORT_COLUMNS.map(normHeader), 'categoryid', 'unit', 'uomar', 'categoryar', 'subcategoryar']);
const lc = (s: any) => String(s ?? '').trim().toLowerCase();
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const numOrUndef = (v: any): number | undefined | null => { // undefined = blank, null = invalid
  const s = String(v ?? '').trim(); if (!s) return undefined;
  const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) ? n : null;
};
const boolOrUndef = (v: any): boolean | undefined => { const s = lc(v); return s === '' ? undefined : ['true', '1', 'yes', 'y', 'نعم'].includes(s); };

/** "Box of 12|12|45.000; Carton|48|170" -> units. Returns an error string on a bad entry. */
export function parseUnits(text: string): { units: { id: string; name: string; factor: number; price: number }[]; error?: string } {
  const units: any[] = [];
  for (const part of String(text || '').split(/;|\n/).map(s => s.trim()).filter(Boolean)) {
    const [name, factor, price] = part.split(/[|:]/).map(s => s.trim());
    const f = Number(factor), p = Number(price);
    if (!name || !Number.isFinite(f) || f <= 1 || !Number.isFinite(p) || p < 0) return { units: [], error: `unit "${part}" must look like Name|how many base units|price` };
    units.push({ id: `u${slugify(name)}`, name, factor: f, price: p });
  }
  return { units };
}

export function planImport(rows: string[][], ctx: ImportCtx): ImportPlan {
  const plan: ImportPlan = { unknownColumns: [], rows: [], newCategories: [], newUoms: [], counts: { create: 0, update: 0, error: 0 } };
  if (!Array.isArray(rows) || rows.length < 2) { plan.headerError = 'No data rows found. The first row must be the column names.'; return plan; }
  if (rows.length - 1 > MAX_IMPORT_ROWS) { plan.headerError = `Too many rows (max ${MAX_IMPORT_ROWS} per file). Split the file and import in parts.`; return plan; }

  const headers = rows[0].map(normHeader);
  const has = (h: string) => headers.includes(normHeader(h));
  if (!has('sku')) { plan.headerError = 'Missing required column: sku'; return plan; }
  plan.unknownColumns = rows[0].filter((h, i) => String(h).trim() && !KNOWN.has(headers[i])).map(String);
  const get = (row: string[], h: string) => { const i = headers.indexOf(normHeader(h)); return i < 0 ? '' : String(row[i] ?? '').trim(); };

  const cats = ctx.categories.slice();
  const byId = new Map(cats.map(c => [c.id, c]));
  const findCat = (ref: string, parentId?: string | null) => cats.find(c =>
    (parentId === undefined ? true : (parentId ? c.parentId === parentId : !c.parentId)) &&
    (c.id === ref || lc(c.slug) === lc(ref) || lc(c.name) === lc(ref) || (c.nameAr && lc(c.nameAr) === lc(ref))));
  const findUom = (ref: string) => ctx.uoms.find(u => lc(u.name) === lc(ref) || lc(u.abbreviation) === lc(ref) || (u.nameAr && lc(u.nameAr) === lc(ref)) || (u.abbreviationAr && lc(u.abbreviationAr) === lc(ref)));
  const bySku = new Map(ctx.products.map(p => [lc(p.sku), p]));
  const slugs = new Set(ctx.products.map(p => String(p.slug || '')));
  const seen = new Set<string>();
  const pendingCats = new Map<string, NewCategory>();
  const pendingUoms = new Map<string, NewUom>();

  rows.slice(1).forEach((row, idx) => {
    if (!row.some(c => String(c ?? '').trim())) return;
    const line = idx + 2;
    const sku = get(row, 'sku'), name = get(row, 'name');
    const err = (message: string) => { plan.rows.push({ line, action: 'error', sku, name, message }); plan.counts.error++; };
    if (!sku) return err('SKU is empty');
    if (seen.has(lc(sku))) return err(`SKU "${sku}" appears twice in this file (first one wins)`);
    seen.add(lc(sku));

    const existing = bySku.get(lc(sku));
    const d: Record<string, any> = {};
    const changes: string[] = [];

    // numbers
    const price = numOrUndef(get(row, 'price')), stock = numOrUndef(get(row, 'stock'));
    for (const [k, v] of [['price', price], ['stock', stock], ['comparePrice', numOrUndef(get(row, 'comparePrice'))], ['costPrice', numOrUndef(get(row, 'costPrice'))],
      ['lowStockAlert', numOrUndef(get(row, 'lowStockAlert'))], ['weight', numOrUndef(get(row, 'weight'))], ['returnDays', numOrUndef(get(row, 'returnDays'))]] as const) {
      if (v === null) return err(`"${k}" is not a number`);
      if (v !== undefined) {
        if (v < 0) return err(`"${k}" cannot be negative`);
        d[k] = k === 'stock' || k === 'lowStockAlert' || k === 'returnDays' ? Math.round(v) : v;
      }
    }
    if (d.price !== undefined && d.price <= 0) return err('price must be more than 0');

    if (!existing) {
      if (!name) return err(`name is empty for SKU "${sku}"`);
      if (d.price === undefined) return err(`price is missing for "${name}"`);
      if (d.stock === undefined) return err(`stock is missing for "${name}" (use 0 if none)`);
    }

    // text
    const txt: [string, string][] = [['name', 'name'], ['nameAr', 'nameAr'], ['description', 'description'], ['descriptionAr', 'descriptionAr'],
      ['shortDescription', 'shortDescription'], ['shortDescriptionAr', 'shortDescriptionAr'], ['brand', 'brand'], ['barcode', 'barcode']];
    for (const [k, col] of txt) { const v = get(row, col); if (v) d[k] = v; }
    const img = get(row, 'image'); if (img) d.images = img.split(/[;|\n]/).map(s => s.trim()).filter(Boolean);
    const tags = get(row, 'tags'); if (tags) d.tags = tags.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    for (const k of ['freeShipping', 'isFeatured', 'isNewArrival', 'isOnSale', 'isActive', 'isReturnable']) { const b = boolOrUndef(get(row, k)); if (b !== undefined) d[k] = b; }

    // category
    let catRef = get(row, 'category') || get(row, 'categoryId'), subRef = get(row, 'subcategory');
    if (!subRef && catRef.includes('>')) { const [a, b] = catRef.split('>'); catRef = a.trim(); subRef = (b || '').trim(); }
    if (catRef) {
      const top = findCat(catRef, null) || findCat(catRef);
      let leaf: any = top;
      if (top && subRef) { leaf = findCat(subRef, top.id); }
      if (top && (!subRef || leaf)) {
        d.categoryId = leaf.id; d.categoryName = leaf.name; if (leaf.nameAr) d.categoryNameAr = leaf.nameAr;
        const parent: any = leaf.parentId ? byId.get(leaf.parentId) : null;
        d.categoryPath = parent ? [parent.id, leaf.id] : [leaf.id];
      } else if (ctx.createMissing) {
        if (!top) pendingCats.set(lc(catRef), { name: catRef });
        if (subRef) pendingCats.set(`${lc(catRef)}>${lc(subRef)}`, { name: subRef, parentName: catRef });
        d.__pendingCategory = true;
      } else {
        return err(top ? `subcategory "${subRef}" not found under "${top.name}"` : `category "${catRef}" not found`);
      }
    } else if (!existing) return err(`category is missing for "${name}"`);

    // unit of measure
    const uomRef = get(row, 'uom') || get(row, 'unit');
    if (uomRef) {
      const u = findUom(uomRef);
      if (u) { d.uomId = u.id; d.uomName = u.name; d.uomAbbr = u.abbreviation || ''; if (u.nameAr) d.uomNameAr = u.nameAr; if (u.abbreviationAr) d.uomAbbrAr = u.abbreviationAr; }
      else if (ctx.createMissing) { pendingUoms.set(lc(uomRef), { name: uomRef, abbreviation: uomRef.length <= 4 ? uomRef : uomRef.slice(0, 3) }); d.__pendingUom = true; }
      else return err(`unit "${uomRef}" not found`);
    }
    const unitsText = get(row, 'units');
    if (unitsText) { const u = parseUnits(unitsText); if (u.error) return err(u.error); d.units = u.units; }

    // slug + defaults for new products
    if (!existing) {
      let slug = slugify(name) || slugify(sku) || 'product';
      if (slugs.has(slug)) slug = `${slug}-${slugify(sku)}`;
      slugs.add(slug);
      Object.assign(d, {
        slug, sku, description: d.description || name, shortDescription: d.shortDescription || '', barcode: d.barcode || '', brand: d.brand || '',
        images: d.images || [], tags: d.tags || [], lowStockAlert: d.lowStockAlert ?? 5,
        isFeatured: d.isFeatured ?? false, isNewArrival: d.isNewArrival ?? false, isOnSale: d.isOnSale ?? false, isActive: d.isActive ?? true,
        freeShipping: d.freeShipping ?? false, isReturnable: d.isReturnable ?? true, returnDays: d.returnDays ?? 14,
        metaTitle: name, metaDesc: d.description || '', avgRating: 0, totalReviews: 0, totalSold: 0, totalRevenue: 0,
      });
      plan.rows.push({ line, action: 'create', sku, name, data: d });
      plan.counts.create++;
    } else {
      const keys = Object.keys(d).filter(k => !k.startsWith('__'));
      if (d.stock !== undefined && d.stock !== existing.stock) changes.push(`stock ${existing.stock ?? 0} → ${d.stock}`);
      for (const k of keys) if (k !== 'stock') changes.push(k);
      plan.rows.push({ line, action: 'update', sku, name: name || sku, id: existing.id, changes, data: d,
        ...(keys.length ? {} : { message: 'nothing to change' }) });
      plan.counts.update++;
    }
  });

  // parents before children
  plan.newCategories = [...pendingCats.values()].sort((a, b) => Number(!!a.parentName) - Number(!!b.parentName));
  plan.newUoms = [...pendingUoms.values()];
  return plan;
}

/** Sample file content for the downloadable template. */
export const TEMPLATE_ROWS: string[][] = [
  [...IMPORT_COLUMNS],
  ['LED-FL-50W', 'LED Flood Light 50W', 'كشاف ليد خارجي 50 واط', '8.500', '12.000', '5.000', '100', '10', 'Lighting', 'Outdoor', 'Philips', 'pcs', 'Box of 6|6|45.000',
    'High-efficiency 50W LED flood light for outdoor use', 'كشاف ليد عالي الكفاءة للاستخدام الخارجي', '50W LED flood light', 'كشاف ليد 50 واط',
    'https://example.com/image.jpg', 'led,flood,outdoor', '0.8', '', 'false', 'false', 'true', 'false', 'true', 'true', '14'],
];
