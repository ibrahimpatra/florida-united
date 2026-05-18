'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';
import type { Translations } from '@/lib/i18n/en';

type Language = 'en' | 'ar';

interface LanguageContextType {
  lang: Language;
  dir: 'ltr' | 'rtl';
  isArabic: boolean;
  t: (key: string) => string;
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en', dir: 'ltr', isArabic: false,
  t: (k) => k, setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem('fk-lang') as Language) || 'en';
    setLangState(saved);
    applyLang(saved);
    setMounted(true);
  }, []);

  function applyLang(l: Language) {
    document.documentElement.lang = l;
    document.documentElement.dir  = l === 'ar' ? 'rtl' : 'ltr';
    if (l === 'ar') document.documentElement.classList.add('arabic-active');
    else document.documentElement.classList.remove('arabic-active');
  }

  function setLang(newLang: Language) {
    setLangState(newLang);
    localStorage.setItem('fk-lang', newLang);
    applyLang(newLang);
  }

  // Dot-notation resolver: 'nav.signIn' → translations.nav.signIn
  function t(key: string): string {
    const dict: Translations = lang === 'ar' ? ar : en;
    const parts = key.split('.');
    let val: unknown = dict;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return key;
    }
    return typeof val === 'string' ? val : key;
  }

  return (
    <LanguageContext.Provider value={{
      lang, dir: lang === 'ar' ? 'rtl' : 'ltr',
      isArabic: lang === 'ar', t, setLang,
    }}>
      {/* Prevent flash of wrong direction on first paint */}
      {mounted ? children : (
        <div style={{ visibility: 'hidden' }}>{children}</div>
      )}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
