/** AI-written product copy + SEO. Shared by the "Write with AI" button and the background SEO job. */
import { aiText, parseJsonLoose, type AiJob } from './ai';

export const COPY_FIELDS = ['nameAr', 'description', 'shortDescription', 'descriptionAr', 'shortDescriptionAr', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr'] as const;

export interface CopyInput { name: string; nameAr?: string; brand?: string; category?: string; sku?: string; specs?: string; tags?: string[]; existing?: string }
const str = (v: any, n = 600) => String(v ?? '').trim().slice(0, n);

export function factsOf(b: CopyInput): string {
  return [
    `Name: ${str(b.name, 200)}`, b.nameAr && `Arabic name: ${str(b.nameAr, 200)}`, b.brand && `Brand: ${str(b.brand, 80)}`, b.category && `Category: ${str(b.category, 120)}`,
    b.sku && `SKU: ${str(b.sku, 60)}`, b.specs && `Specifications / notes from the owner: ${str(b.specs, 1500)}`,
    Array.isArray(b.tags) && b.tags.length && `Tags: ${b.tags.slice(0, 15).map(t => str(t, 30)).join(', ')}`,
    b.existing && `Current description (improve it, keep the facts): ${str(b.existing, 1500)}`,
  ].filter(Boolean).join('\n');
}

export async function writeProductCopy(b: CopyInput, opts: { job?: AiJob; deadline?: number } = {}) {
  const { text, provider } = await aiText({
    job: opts.job, deadline: opts.deadline,
    system:
      `You write product pages and SEO for an online hardware and electrical supplies store in Kuwait (prices in KWD). ` +
      `Use ONLY the facts provided. Never invent specifications, certifications, warranty, dimensions or numbers; if something is not given, leave it out. ` +
      `Style: clear, practical and honest, aimed at contractors and home owners; no hype, no emojis, no ALL CAPS. ` +
      `Return a JSON object with these keys: ` +
      `"nameAr" (the product name in Arabic; keep brand names, model numbers and units in Latin characters), ` +
      `"shortDescription" (English, one line under 110 characters), "description" (English, 60-120 words, simple HTML allowed: <p>, <ul><li>, <strong>), ` +
      `"shortDescriptionAr" and "descriptionAr" (the same in natural Modern Standard Arabic with trade terms Kuwaiti customers use; keep brand names, model numbers, sizes and units like mm, V, A, W in Latin characters), ` +
      `"metaTitle" (English, max 60 characters, include the product name and brand), "metaDesc" (English, 140-160 characters, ends with a reason to buy), ` +
      `"metaTitleAr" and "metaDescAr" (the same two in Modern Standard Arabic, same length limits, for Arabic Google results), ` +
      `"tags" (array of 6-10 short lowercase search keywords: English terms, the Arabic name of the product type, common spellings and the brand).`,
    user: factsOf(b), json: true, maxTokens: 2500,
  });
  const out = parseJsonLoose(text);
  const fields: Record<string, string> = {};
  for (const k of COPY_FIELDS) if (typeof out[k] === 'string' && out[k].trim()) fields[k] = out[k].trim();
  if (fields.metaTitle) fields.metaTitle = fields.metaTitle.slice(0, 70);
  if (fields.metaDesc) fields.metaDesc = fields.metaDesc.slice(0, 170);
  if (fields.metaTitleAr) fields.metaTitleAr = fields.metaTitleAr.slice(0, 70);
  if (fields.metaDescAr) fields.metaDescAr = fields.metaDescAr.slice(0, 170);
  const tags: string[] = Array.isArray(out.tags) ? [...new Set<string>(out.tags.map((t: any) => str(t, 30).toLowerCase()).filter(Boolean))].slice(0, 10) : [];
  return { fields, tags, provider, raw: text };
}
