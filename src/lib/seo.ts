import type { Metadata } from 'next';
import { toAr, stripAr } from './locale-path';

export const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://floridakuwait.com').replace(/\/$/, '');

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
