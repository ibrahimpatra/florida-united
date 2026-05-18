'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export function LanguageToggle() {
  const { lang, setLang, isArabic } = useLanguage();

  return (
    <button
      onClick={() => setLang(isArabic ? 'en' : 'ar')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-all text-xs font-bold text-gray-700 hover:text-brand-700 select-none"
      title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <span className="text-base leading-none">{isArabic ? '🇺🇸' : '🇰🇼'}</span>
      <span className="font-extrabold tracking-wide">{isArabic ? 'EN' : 'عربي'}</span>
    </button>
  );
}
