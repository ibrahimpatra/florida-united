'use client';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';
import { pickLocalized } from '@/lib/i18n/localize';

type Language = 'en' | 'ar';
type Vars = Record<string, string | number>;

interface LanguageContextType {
  lang: Language;
  dir: 'ltr' | 'rtl';
  isArabic: boolean;
  /** t('group.key') or t('group.key', { n: 3 }) → replaces {n} */
  t: (key: string, vars?: Vars) => string;
  /** L(product, 'name') → nameAr when Arabic is active and filled in, else name */
  L: (obj: any, field: string) => string;
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en', dir: 'ltr', isArabic: false,
  t: (k) => k, L: (o, f) => pickLocalized(o, f, 'en'), setLang: () => {},
});

// The admin panel is English / LTR only.
const isAdminPath = (p?: string | null) => !!p && p.startsWith('/admin');

function applyLang(l: Language) {
  const el = document.documentElement;
  el.lang = l;
  el.dir = l === 'ar' ? 'rtl' : 'ltr';
  el.classList.toggle('arabic-active', l === 'ar');
}

function lookup(dict: unknown, key: string): string | undefined {
  let val: any = dict;
  for (const p of key.split('.')) {
    if (val && typeof val === 'object') val = val[p]; else return undefined;
  }
  return typeof val === 'string' ? val : undefined;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start with 'en' so server HTML and first client render match; sync from storage in an effect.
  const [lang, setLangState] = useState<Language>('en');
  const pathname = usePathname();
  const admin = isAdminPath(pathname);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fk-lang');
      if (saved === 'ar') setLangState('ar');
    } catch { /* storage blocked */ }
  }, []);

  const effective: Language = admin ? 'en' : lang;
  useEffect(() => { applyLang(effective); }, [effective]);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem('fk-lang', l); } catch { /* ignore */ }
  }, []);

  const value = useMemo<LanguageContextType>(() => ({
    lang: effective,
    dir: effective === 'ar' ? 'rtl' : 'ltr',
    isArabic: effective === 'ar',
    t: (key, vars) => {
      let s = lookup(effective === 'ar' ? ar : en, key) ?? lookup(en, key) ?? key; // Arabic gaps fall back to English
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    L: (obj, field) => pickLocalized(obj, field, effective),
    setLang,
  }), [effective, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
