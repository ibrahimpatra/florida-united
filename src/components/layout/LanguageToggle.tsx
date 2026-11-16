'use client';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function LanguageToggle() {
  const { setLang, isArabic } = useLanguage();
  return (
    <button
      onClick={() => setLang(isArabic ? 'en' : 'ar')}
      className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-all text-xs font-bold text-gray-700 hover:text-brand-700 select-none"
      title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
      aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Languages className="w-4 h-4" />
      <span className="font-extrabold tracking-wide">{isArabic ? 'EN' : 'عربي'}</span>
    </button>
  );
}
