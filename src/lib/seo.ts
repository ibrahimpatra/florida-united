import type { Metadata } from 'next';
import { siteBase } from './site-url';
import { toAr, stripAr } from './locale-path';

export const siteUrl = () => siteBase();

/** canonical + hreflang pairs for a page. `path` is the English path (/shop/x). */
export function altLinks(path: string, locale: 'en' | 'ar' = 'en'): NonNullable<Metadata['alternates']> {
  const en = stripAr(path), ar = toAr(en);
  return { canonical: locale === 'ar' ? ar : en, languages: { en, ar, 'x-default': en } };
}

/** Turns an English page's metadata into the Arabic twin's: own canonical, hreflang, Arabic locale, optional Arabic title/description. */
export function arabicMeta(m: Metadata, path: string, ar?: { title?: string; description?: string }): Metadata {
  const title = ar?.title ? { absolute: ar.title } : m.title;
  const description = ar?.description || m.description;
  return { ...m, title, description, alternates: altLinks(path, 'ar'),
    openGraph: { ...(m.openGraph as any || {}), title: (ar?.title ?? (m.openGraph as any)?.title), description, locale: 'ar_KW', url: toAr(path) } };
}

const uniq = (a: string[]) => [...new Set(a.map(x => String(x || '').trim()).filter(Boolean))];
/** Page meta for the Deals and Bundles listing pages, taken from the SEO fields of what is live right now (one live item: its own title and text; several: shared keywords). */
export function listingSeo(items: any[], lang: 'en' | 'ar'): { title?: string; description?: string; keywords?: string[] } {
  const t = lang === 'ar' ? 'metaTitleAr' : 'metaTitle', d = lang === 'ar' ? 'metaDescAr' : 'metaDesc';
  const live = items.filter(Boolean);
  const keywords = uniq(live.flatMap(i => Array.isArray(i.tags) ? i.tags : [])).slice(0, 25);
  const one = live.length === 1 ? live[0] : live.find(i => i[t] && i[d]);
  return { title: one?.[t] || undefined, description: one?.[d] || undefined, keywords: keywords.length ? keywords : undefined };
}
