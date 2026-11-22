/**
 * Fills blank Arabic text and SEO text for everything an admin can create except products (products use product-copy.ts):
 * categories, banners, flash deals, bundles, promo tiles and popups. Only EMPTY fields are filled; what a person wrote is never changed.
 * Used by the background job and by the "Fill with AI" buttons in the admin forms.
 */
import { aiText, parseJsonLoose, type AiJob } from './ai';

export interface EntitySpec {
  col: string; label: string; nameField: string;
  /** [english field, arabic field]: when the English one has text and the Arabic one is empty, it is translated. */
  pairs: [string, string][];
  /** Fields written from scratch when empty. `tags` is an array, everything else text. */
  seo: string[];
  /** Extra English text given to the AI as context. */
  context?: string[];
}

export const SPECS: Record<string, EntitySpec> = {
  categories: { col: 'categories', label: 'Category', nameField: 'name', pairs: [['name', 'nameAr'], ['description', 'descriptionAr']], seo: ['description', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags'], context: ['parentName'] },
  brands:     { col: 'brands', label: 'Brand', nameField: 'name', pairs: [['name', 'nameAr'], ['description', 'descriptionAr']], seo: ['description', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags', 'imageAlt', 'imageAltAr'] },
  banners:    { col: 'banners', label: 'Banner', nameField: 'title', pairs: [['title', 'titleAr'], ['subtitle', 'subtitleAr'], ['buttonText', 'buttonTextAr']], seo: ['imageAlt', 'imageAltAr'] },
  flashDeals: { col: 'flashDeals', label: 'Flash deal', nameField: 'title', pairs: [['title', 'titleAr'], ['subtitle', 'subtitleAr'], ['badgeText', 'badgeTextAr']], seo: ['metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags', 'imageAlt', 'imageAltAr'] },
  bundles:    { col: 'bundles', label: 'Bundle', nameField: 'name', pairs: [['name', 'nameAr'], ['description', 'descriptionAr']], seo: ['description', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags', 'imageAlt', 'imageAltAr'] },
  promoTiles: { col: 'promoTiles', label: 'Promo tile', nameField: 'title', pairs: [['title', 'titleAr'], ['badge', 'badgeAr']], seo: ['imageAlt', 'imageAltAr'] },
  popups:     { col: 'popups', label: 'Popup', nameField: 'title', pairs: [['title', 'titleAr'], ['body', 'bodyAr'], ['ctaText', 'ctaTextAr']], seo: ['imageAlt', 'imageAltAr'] },
};

const blank = (v: any) => (Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim());

/** Which fields of this document are empty and can be filled. Returns [] when there is nothing to do or no name to work from. */
export function missingFields(spec: EntitySpec, doc: any): string[] {
  if (blank(doc?.[spec.nameField])) return [];
  const m: string[] = [];
  for (const [en, ar] of spec.pairs) if (!blank(doc[en]) && blank(doc[ar])) m.push(ar);
  for (const k of spec.seo) {
    if (k === 'imageAlt' || k === 'imageAltAr') { if (blank(doc.image) && blank(doc.images)) continue; }
    if (k === 'imageAltAr') { if (blank(doc.imageAlt) && !m.includes('imageAlt') && !blank(doc.imageAltAr)) continue; }
    if (blank(doc[k]) && !m.includes(k)) m.push(k);
  }
  if (m.includes('imageAlt') && !m.includes('imageAltAr')) m.push('imageAltAr');
  return [...new Set(m)];
}

const clip = (v: any, n = 500) => String(v ?? '').trim().slice(0, n);

export async function fillEntity(spec: EntitySpec, doc: any, keys: string[], opts: { job?: AiJob } = {}): Promise<{ patch: Record<string, any>; provider: string }> {
  const facts = [`Type: ${spec.label} of an online hardware and electrical supplies store in Kuwait`,
    ...[spec.nameField, ...spec.pairs.map(p => p[0]), ...(spec.context || [])].filter((k, i, a) => a.indexOf(k) === i).map(k => !blank(doc[k]) && `${k}: ${clip(doc[k])}`).filter(Boolean),
  ].join('\n');
  const guide: Record<string, string> = {
    description: 'English, 25-60 words, factual, no hype', metaTitle: 'English, max 60 characters', metaDesc: 'English, 140-160 characters', metaTitleAr: 'Arabic version of metaTitle (Modern Standard Arabic, max 60 characters)', metaDescAr: 'Arabic version of metaDesc (Modern Standard Arabic, 140-160 characters)',
    tags: 'array of 5-8 short lowercase search keywords (English plus the Arabic term)', imageAlt: 'English, max 100 characters, describes the picture for screen readers and Google',
    imageAltAr: 'Arabic version of imageAlt',
  };
  const lines = keys.map(k => {
    const pair = spec.pairs.find(p => p[1] === k);
    if (pair && !spec.seo.includes(k)) return `"${k}": natural Modern Standard Arabic translation of "${pair[0]}" (keep brand names, numbers and units like mm, V, W in Latin characters; keep it as short as the English)`;
    if (k === 'imageAltAr') return `"${k}": ${guide[k]}`;
    return `"${k}": ${guide[k] || 'text'}`;
  });
  const { text, provider } = await aiText({
    job: opts.job, json: true, maxTokens: 1800,
    system: `You complete the text of an online hardware store in Kuwait. Use ONLY the facts given; never invent products, prices, discounts or promises. Return a JSON object with exactly these keys:\n${lines.join('\n')}`,
    user: facts,
  });
  const out = parseJsonLoose(text); const patch: Record<string, any> = {};
  for (const k of keys) {
    if (k === 'tags') { const t = Array.isArray(out.tags) ? [...new Set<string>(out.tags.map((x: any) => clip(x, 30).toLowerCase()).filter(Boolean))].slice(0, 10) : []; if (t.length) patch.tags = t; }
    else if (typeof out[k] === 'string' && out[k].trim()) patch[k] = out[k].trim().slice(0, k.startsWith('metaTitle') ? 70 : k.startsWith('metaDesc') ? 170 : k === 'description' ? 600 : 300);
  }
  return { patch, provider };
}
