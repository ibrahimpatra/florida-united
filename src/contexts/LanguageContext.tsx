'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from '@/lib/i18n/en';
import { ar } from '@/lib/i18n/ar';
import type { Translations } from '@/lib/i18n/en';

type Language = 'en' | 'ar';

interface LanguageContextType {
  lang: Language;
  dir: 'ltr' | 'rtl';
  t: (key: string) => string;
  setLang: (lang: Language) => void;
  isArabic: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en', dir: 'ltr',
  t: (k) => k, setLang: () => {}, isArabic: false,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem('fk-lang') as Language;
    if (saved === 'ar' || saved === 'en') {
      setLangState(saved);
      document.documentElement.lang = saved;
      document.documentElement.dir  = saved === 'ar' ? 'rtl' : 'ltr';
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('fk-lang', newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir  = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  // Dot-notation key resolver: 'orders.title' → translations.orders.title
  const t = (key: string): string => {
    const dict: Translations = lang === 'ar' ? ar : en;
    const parts = key.split('.');
    let val: unknown = dict;
    for (const part of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[part];
      else return key;
    }
    return typeof val === 'string' ? val : key;
  };

  return (
    <LanguageContext.Provider value={{
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      t,
      setLang,
      isArabic: lang === 'ar',
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
