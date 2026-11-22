/**
 * "Complete my sheet": reads an incomplete spreadsheet and writes the blank cells with AI, then hands back a finished sheet to import.
 * Only BLANK cells are written; every cell the person filled is left exactly as it was. Nothing is saved to the shop here.
 * Products: Arabic name, short + long descriptions (English and Arabic), tags, and category / subcategory (chosen from the shop's own categories when one fits).
 * Categories: Arabic name, descriptions, meta title/description, keywords.
 */
import { aiText, parseJsonLoose } from './ai';
import { IMPORT_COLUMNS, normHeader } from './product-import';
import { CATEGORY_COLUMNS } from './category-import';
import { BRAND_COLUMNS } from './brand-import';

export type AssistKind = 'products' | 'categories' | 'brands';
const FILL: Record<AssistKind, string[]> = {
  products: ['nameAr', 'shortDescription', 'shortDescriptionAr', 'description', 'descriptionAr', 'tags', 'category', 'subcategory'],
  categories: ['nameAr', 'description', 'descriptionAr', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags'],
  brands: ['nameAr', 'description', 'descriptionAr', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags'],
};
const FACTS: Record<AssistKind, string[]> = {
  products: ['name', 'brand', 'category', 'subcategory', 'sku', 'uom', 'shortDescription', 'description'],
  categories: ['name', 'parent', 'description'],
  brands: ['name', 'description', 'website'],
};
const BATCH = 8;

export interface AssistResult { rows: string[][]; filledCells: number; rowsDone: number; rowsTotal: number; rowsLeft: number; error?: string }

export async function assistSheet(rows: string[][], kind: AssistKind, opts: { categories?: { name: string; parentName?: string }[]; deadline: number }): Promise<AssistResult> {
  const canon = (kind === 'products' ? IMPORT_COLUMNS : kind === 'brands' ? BRAND_COLUMNS : CATEGORY_COLUMNS) as readonly string[];
  const header = rows[0].map(h => { const c = canon.find(x => normHeader(x) === normHeader(h)); return c || String(h); });
  const out = rows.map(r => r.slice());
  out[0] = header.slice();
  const col = (name: string) => { let i = header.indexOf(name); if (i < 0) { i = header.length; header.push(name); out[0].push(name); } return i; };
  const idx = Object.fromEntries(FILL[kind].map(k => [k, col(k)])) as Record<string, number>;
  const data = out.slice(1);
  for (const r of data) while (r.length < header.length) r.push('');
  const val = (r: string[], k: string) => { const i = header.indexOf(k); return i < 0 ? '' : String(r[i] ?? '').trim(); };

  const todo: { i: number; blanks: string[] }[] = [];
  data.forEach((r, i) => {
    if (!val(r, 'name')) return;
    const blanks = FILL[kind].filter(k => !val(r, k));
    // a long description needs something to describe: with only a name the AI writes it from the name, which is fine; category is only guessed when blank
    if (blanks.length) todo.push({ i, blanks });
  });

  const catList = (opts.categories || []).map(c => (c.parentName ? `${c.parentName} > ${c.name}` : c.name)).slice(0, 150);
  const batches: typeof todo[] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  let filled = 0, done = 0; let error: string | undefined;

  const run = async (batch: typeof todo) => {
    if (Date.now() > opts.deadline - 14_000) return;
    const items = batch.map(({ i, blanks }) => ({ row: i, fill: blanks, facts: Object.fromEntries(FACTS[kind].map(k => [k, val(data[i], k)]).filter(([, v]) => v)) }));
    const rules = kind === 'products'
      ? `You complete rows of a product spreadsheet for an online hardware and electrical supplies store in Kuwait (KWD). For each row write ONLY the keys listed in "fill".
Rules: use only the facts given, never invent specifications, brands, certifications or numbers. "nameAr": Arabic product name (brand, model, sizes and units stay in Latin characters). "shortDescription"/"shortDescriptionAr": one line under 110 characters. "description"/"descriptionAr": 40-90 words, simple HTML allowed (<p>, <ul><li>, <strong>). "tags": comma separated, 5-8 lowercase search keywords including the Arabic product type. "category" and "subcategory": pick from this list when one fits ("Parent > Child" means category=Parent, subcategory=Child); if none fits propose a short sensible name; leave subcategory empty if unsure.\nCategories: ${catList.join(' | ') || '(none yet)'}`
      : kind === 'brands'
      ? `You complete rows of a brand spreadsheet for an online hardware and electrical supplies store in Kuwait. For each row write ONLY the keys listed in "fill". Use only well-known, general facts about the brand; if you do not know the brand, describe only the products the store sells under it in neutral words and never invent history, countries or claims. "nameAr": the brand name as Arabic readers know it (transliteration). "description": English, 20-40 words. "descriptionAr": the same in Arabic. "metaTitle": max 60 characters. "metaDesc": 140-160 characters. "metaTitleAr" and "metaDescAr": the same two in Modern Standard Arabic. "tags": comma separated, 5-8 lowercase keywords (English plus Arabic).`
      : `You complete rows of a category spreadsheet for an online hardware and electrical supplies store in Kuwait. For each row write ONLY the keys listed in "fill". "nameAr": Arabic name. "description": English, 20-40 words, factual. "descriptionAr": the same in Arabic. "metaTitle": max 60 characters. "metaDesc": 140-160 characters. "metaTitleAr" and "metaDescAr": the same two in Modern Standard Arabic. "tags": comma separated, 5-8 lowercase keywords (English plus Arabic).`;
    try {
      const { text } = await aiText({ job: 'bulk', json: true, maxTokens: 3500, deadline: opts.deadline,
        system: `${rules}\nReturn JSON: {"rows":[{"row":<number>, "<key>":"<text>", ...}]} with exactly the requested keys for every row.`, user: JSON.stringify(items) });
      const res = parseJsonLoose(text); const list: any[] = Array.isArray(res.rows) ? res.rows : [];
      for (const it of list) {
        const t = todo.find(x => x.i === Number(it.row)); if (!t) continue;
        for (const k of t.blanks) {
          let v = it[k]; if (Array.isArray(v)) v = v.join(', ');
          if (typeof v !== 'string' || !v.trim()) continue;
          v = v.trim().slice(0, k.startsWith('metaTitle') ? 70 : k.startsWith('metaDesc') ? 170 : k.startsWith('description') ? 1500 : 300);
          data[t.i][idx[k]] = v; filled++;
        }
      }
      done += batch.length;
    } catch (e: any) { error = String(e?.message || e).slice(0, 200); }
  };

  const queue = [...batches];
  await Promise.all([0, 1, 2].map(async () => { for (let b = queue.shift(); b; b = queue.shift()) { if (error && !done) return; await run(b); } }));
  return { rows: [out[0], ...data], filledCells: filled, rowsDone: Math.min(done, todo.length), rowsTotal: todo.length, rowsLeft: Math.max(0, todo.length - done), error };
}
