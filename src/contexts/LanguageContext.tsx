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

function applyLang(l: Language) {
  document.documentElement.lang = l;
  document.documentElement.dir  = l === 'ar' ? 'rtl' : 'ltr';
  if (l === 'ar') {
    document.documentElement.classList.add('arabic-active');
  } else {
    document.documentElement.classList.remove('arabic-active');
  }
}

// Dot-notation resolver: 'nav.signIn' → translations.nav.signIn
function resolve(key: string, lang: Language): string {
  const dict: Translations = lang === 'ar' ? ar : en;
  const parts = key.split('.');
  let val: unknown = dict;
  for (const p of parts) {
    if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
    else return key;
  }
  return typeof val === 'string' ? val : key;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start with 'en' on server so hydration matches.
  // useEffect immediately syncs to the saved localStorage value on the client.
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    const saved = (localStorage.getItem('fk-lang') as Language) || 'en';
    if (saved !== 'en') {
      setLangState(saved);
    }
    applyLang(saved);
  }, []);

  function setLang(newLang: Language) {
    setLangState(newLang);
    localStorage.setItem('fk-lang', newLang);
    applyLang(newLang);
  }

  return (
    <LanguageContext.Provider value={{
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      isArabic: lang === 'ar',
      t: (key) => resolve(key, lang),
      setLang,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
