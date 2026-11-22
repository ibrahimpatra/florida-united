/**
 * Spreadsheet import for brands (pure planner: no database here).
 * Columns: name (required), nameAr, description, descriptionAr, image (logo link), imageAlt, imageAltAr, website, metaTitle, metaDesc, tags, sortOrder, showOnHome, isActive.
 * A row is matched by name: found = update (only the filled cells), not found = create.
 */
import { normHeader } from './product-import';

export const BRAND_COLUMNS = ['name', 'nameAr', 'description', 'descriptionAr', 'image', 'imageAlt', 'imageAltAr', 'website', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags', 'sortOrder', 'showOnHome', 'isActive'] as const;
export const MAX_BRAND_ROWS = 600;
export interface BrandCtx { id: string; name: string; nameAr?: string; slug?: string }
export interface BrandPlanRow { line: number; action: 'create' | 'update' | 'error'; name: string; id?: string; message?: string; changes?: string[]; data?: Record<string, any> }
export interface BrandPlan { headerError?: string; unknownColumns: string[]; rows: BrandPlanRow[]; counts: { create: number; update: number; error: number } }

const KNOWN = new Set<string>(BRAND_COLUMNS.map(normHeader));
const lc = (s: any) => String(s ?? '').trim().toLowerCase();
const boolOrUndef = (v: any) => { const s = lc(v); return s === '' ? undefined : ['true', '1', 'yes', 'y', 'نعم'].includes(s); };

export function planBrandImport(rows: string[][], existing: BrandCtx[]): BrandPlan {
  const plan: BrandPlan = { unknownColumns: [], rows: [], counts: { create: 0, update: 0, error: 0 } };
  if (!Array.isArray(rows) || rows.length < 2) { plan.headerError = 'No data rows found. The first row must be the column names.'; return plan; }
  if (rows.length - 1 > MAX_BRAND_ROWS) { plan.headerError = `Too many rows (max ${MAX_BRAND_ROWS} per file).`; return plan; }
  const headers = rows[0].map(normHeader);
  if (!headers.includes('name')) { plan.headerError = 'Missing required column: name'; return plan; }
  plan.unknownColumns = rows[0].filter((h, i) => String(h).trim() && !KNOWN.has(headers[i])).map(String);
  const get = (row: string[], h: string) => { const i = headers.indexOf(normHeader(h)); return i < 0 ? '' : String(row[i] ?? '').trim(); };
  const seen = new Set<string>();

  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2; const name = get(r, 'name');
    const row: BrandPlanRow = { line, action: 'error', name };
    const fail = (m: string) => { row.message = m; plan.rows.push(row); plan.counts.error++; };
    if (r.every(c => !String(c ?? '').trim())) return;
    if (!name) return fail('name is empty');
    if (name.length > 80) return fail('name is longer than 80 characters');
    if (seen.has(lc(name))) return fail('the same brand appears twice in the file');
    seen.add(lc(name));
    const data: Record<string, any> = {};
    const put = (k: string, v: any) => { if (v !== undefined && v !== '') data[k] = v; };
    put('name', name); put('nameAr', get(r, 'nameAr')); put('description', get(r, 'description')); put('descriptionAr', get(r, 'descriptionAr'));
    put('imageAlt', get(r, 'imageAlt').slice(0, 120)); put('imageAltAr', get(r, 'imageAltAr').slice(0, 120));
    const img = get(r, 'image'); if (img) { if (!/^(https?:\/\/|\/)/i.test(img)) return fail('image must be a link starting with https:// or /'); data.image = img; }
    const web = get(r, 'website'); if (web) { if (!/^https?:\/\//i.test(web)) return fail('website must start with https://'); data.website = web; }
    put('metaTitle', get(r, 'metaTitle').slice(0, 70)); put('metaDesc', get(r, 'metaDesc').slice(0, 170)); put('metaTitleAr', get(r, 'metaTitleAr').slice(0, 70)); put('metaDescAr', get(r, 'metaDescAr').slice(0, 170));
    const tags = get(r, 'tags'); if (tags) data.tags = [...new Set(tags.split(/[,;|]/).map(t => t.trim().toLowerCase()).filter(Boolean))].slice(0, 15);
    const so = get(r, 'sortOrder'); if (so) { const n = Number(so); if (!Number.isFinite(n)) return fail('sortOrder must be a number'); data.sortOrder = n; }
    for (const k of ['showOnHome', 'isActive'] as const) { const b = boolOrUndef(get(r, k)); if (b !== undefined) data[k] = b; }
    const match = existing.find(b => lc(b.name) === lc(name) || (lc(b.nameAr) && lc(b.nameAr) === lc(name)));
    if (match) { row.action = 'update'; row.id = match.id; delete data.name; row.changes = Object.keys(data); if (!row.changes.length) row.message = 'already exists, nothing to change'; plan.counts.update++; }
    else { row.action = 'create'; plan.counts.create++; }
    row.data = data; plan.rows.push(row);
  });
  return plan;
}

export const BRAND_TEMPLATE_ROWS: string[][] = [
  [...BRAND_COLUMNS],
  ['Siemens', 'سيمنز', 'German maker of electrical and automation equipment', '', '', '', '', 'https://www.siemens.com', '', '', 'siemens, electrical', '1', 'yes', 'yes'],
  ['Bosch', '', '', '', '', '', '', '', '', '', '', '2', '', ''],
  ['Makita', '', '', '', '', '', '', '', '', '', '', '3', '', ''],
];
