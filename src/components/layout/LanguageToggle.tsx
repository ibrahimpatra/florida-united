'use client';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function LanguageToggle({ onDark = false }: { onDark?: boolean }) {
  const { setLang, isArabic } = useLanguage();
  return (
    <button
      onClick={() => setLang(isArabic ? 'en' : 'ar')}
      className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border transition-colors text-xs font-bold select-none ${onDark ? 'border-white/40 text-white hover:bg-white/15 hover:border-white' : 'border-gray-200 text-gray-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700'}`}
      title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
      aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Languages className="w-4 h-4" />
      <span className="font-extrabold tracking-wide">{isArabic ? 'EN' : 'عربي'}</span>
    </button>
  );
}
