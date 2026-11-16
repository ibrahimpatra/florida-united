/**
 * Bilingual content helpers. Every admin-entered text field has an English value
 * (`name`) and an optional Arabic value (`nameAr`). Customer pages show the Arabic
 * value when the site language is Arabic AND it has been filled in; otherwise they
 * fall back to English so nothing is ever blank.
 */
export function pickLocalized(obj: any, field: string, lang: 'en' | 'ar'): string {
  if (!obj) return '';
  const en = obj[field];
  if (lang === 'ar') {
    const ar = obj[`${field}Ar`];
    if (typeof ar === 'string' && ar.trim()) return ar;
  }
  return typeof en === 'string' ? en : '';
}

/** Server/PDF use: both languages when both exist, e.g. for invoices. */
export function bilingual(obj: any, field: string): { en: string; ar: string } {
  const en = typeof obj?.[field] === 'string' ? obj[field] : '';
  const ar = typeof obj?.[`${field}Ar`] === 'string' ? obj[`${field}Ar`].trim() : '';
  return { en, ar };
}

export const hasArabic = (s?: string) => !!s && /[؀-ۿ]/.test(s);
