/**
 * Spreadsheet import for categories and sub-categories (pure planner: no database here).
 * Columns: name (required), nameAr, parent (blank = main category), description, descriptionAr, image, metaTitle, metaDesc, tags, sortOrder, showOnHome, showOnNav, isActive.
 * A row is matched by name + parent: found = update (only the filled cells), not found = create. A parent may be an existing category or another row of the file.
 */
import { normHeader, slugify } from './product-import';

export const CATEGORY_COLUMNS = ['name', 'nameAr', 'parent', 'description', 'descriptionAr', 'image', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags', 'sortOrder', 'showOnHome', 'showOnNav', 'isActive'] as const;
export const MAX_CATEGORY_ROWS = 600;
export interface CatCtx { id: string; name: string; nameAr?: string; slug?: string; parentId?: string }
export interface CatPlanRow { line: number; action: 'create' | 'update' | 'error'; name: string; parent: string; id?: string; parentId?: string; message?: string; changes?: string[]; data?: Record<string, any> }
export interface CatPlan { headerError?: string; unknownColumns: string[]; rows: CatPlanRow[]; counts: { create: number; update: number; error: number } }

const KNOWN = new Set<string>(CATEGORY_COLUMNS.map(normHeader));
const lc = (s: any) => String(s ?? '').trim().toLowerCase();
const boolOrUndef = (v: any) => { const s = lc(v); return s === '' ? undefined : ['true', '1', 'yes', 'y', 'نعم'].includes(s); };

export function planCategoryImport(rows: string[][], existing: CatCtx[]): CatPlan {
  const plan: CatPlan = { unknownColumns: [], rows: [], counts: { create: 0, update: 0, error: 0 } };
  if (!Array.isArray(rows) || rows.length < 2) { plan.headerError = 'No data rows found. The first row must be the column names.'; return plan; }
  if (rows.length - 1 > MAX_CATEGORY_ROWS) { plan.headerError = `Too many rows (max ${MAX_CATEGORY_ROWS} per file).`; return plan; }
  const headers = rows[0].map(normHeader);
  if (!headers.includes('name')) { plan.headerError = 'Missing required column: name'; return plan; }
  plan.unknownColumns = rows[0].filter((h, i) => String(h).trim() && !KNOWN.has(headers[i])).map(String);
  const get = (row: string[], h: string) => { const i = headers.indexOf(normHeader(h)); return i < 0 ? '' : String(row[i] ?? '').trim(); };

  // names of main categories defined by the file itself (so a sub-category may come before its parent)
  const fileTop = new Set<string>();
  for (const r of rows.slice(1)) if (get(r, 'name') && !get(r, 'parent')) fileTop.add(lc(get(r, 'name')));
  const topExisting = (n: string) => existing.find(c => !c.parentId && (lc(c.name) === n || lc(c.nameAr) === n || lc(c.slug) === n));
  const seen = new Set<string>();

  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2; const name = get(r, 'name'); const parent = get(r, 'parent');
    const row: CatPlanRow = { line, action: 'error', name, parent };
    const fail = (m: string) => { row.message = m; plan.rows.push(row); plan.counts.error++; };
    if (r.every(c => !String(c ?? '').trim())) return;
    if (!name) return fail('name is empty');
    if (name.length > 80) return fail('name is longer than 80 characters');
    let parentId = '';
    if (parent) {
      const p = topExisting(lc(parent));
      if (p) parentId = p.id; else if (!fileTop.has(lc(parent))) return fail(`parent "${parent}" does not exist and is not a main category in this file`);
      if (lc(parent) === lc(name)) return fail('a category cannot be its own parent');
    }
    const key = `${lc(parent)}>${lc(name)}`;
    if (seen.has(key)) return fail('the same category appears twice in the file');
    seen.add(key);

    const data: Record<string, any> = {};
    const put = (k: string, v: any) => { if (v !== undefined && v !== '') data[k] = v; };
    put('name', name); put('nameAr', get(r, 'nameAr')); put('description', get(r, 'description')); put('descriptionAr', get(r, 'descriptionAr'));
    const img = get(r, 'image'); if (img) { if (!/^(https?:\/\/|\/)/i.test(img)) return fail('image must be a link starting with https:// or /'); data.image = img; }
    put('metaTitle', get(r, 'metaTitle').slice(0, 70)); put('metaDesc', get(r, 'metaDesc').slice(0, 170)); put('metaTitleAr', get(r, 'metaTitleAr').slice(0, 70)); put('metaDescAr', get(r, 'metaDescAr').slice(0, 170));
    const tags = get(r, 'tags'); if (tags) data.tags = [...new Set(tags.split(/[,;|]/).map(t => t.trim().toLowerCase()).filter(Boolean))].slice(0, 15);
    const so = get(r, 'sortOrder'); if (so) { const n = Number(so); if (!Number.isFinite(n)) return fail('sortOrder must be a number'); data.sortOrder = n; }
    for (const k of ['showOnHome', 'showOnNav', 'isActive'] as const) { const b = boolOrUndef(get(r, k)); if (b !== undefined) data[k] = b; }

    const match = existing.find(c => lc(c.name) === lc(name) && (c.parentId || '') === parentId);
    row.parentId = parentId;
    if (match) { row.action = 'update'; row.id = match.id; delete data.name; row.changes = Object.keys(data); if (!row.changes.length) row.message = 'already exists, nothing to change'; plan.counts.update++; }
    else { row.action = 'create'; plan.counts.create++; }
    row.data = data; plan.rows.push(row);
  });
  return plan;
}

export const CATEGORY_TEMPLATE_ROWS: string[][] = [
  [...CATEGORY_COLUMNS],
  ['Electrical', 'كهربائيات', '', 'Cables, switches, sockets and breakers', '', '', '', '', 'electrical, cables', '1', 'yes', 'yes', 'yes'],
  ['Cables', 'كيابل', 'Electrical', 'Copper and aluminium cables', '', '', '', '', '', '1', '', '', ''],
  ['Switches & Sockets', '', 'Electrical', '', '', '', '', '', '', '2', '', '', ''],
  ['Hand Tools', '', '', '', '', '', '', '', '', '2', '', '', ''],
];
export const slug = slugify;
