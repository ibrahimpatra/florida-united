'use client';
import { useState, useEffect } from 'react';

export function LanguageToggle() {
  const [isArabic, setIsArabic] = useState(false);
  const [loading, setLoading]   = useState(false);

  // Sync state from localStorage on mount
  useEffect(() => {
    setIsArabic(localStorage.getItem('fk-lang') === 'ar');
  }, []);

  const toggle = () => {
    if (loading) return;
    setLoading(true);

    const goArabic = !isArabic;
    setIsArabic(goArabic);

    if (goArabic) {
      window.switchToArabic?.();
    } else {
      window.switchToEnglish?.();
    }

    // Remove loading state after transition
    setTimeout(() => setLoading(false), 900);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-all text-xs font-bold text-gray-700 hover:text-brand-700 select-none disabled:opacity-60"
      title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <span className="text-base leading-none">{isArabic ? '🇺🇸' : '🇰🇼'}</span>
          <span className="font-extrabold tracking-wide">{isArabic ? 'EN' : 'عربي'}</span>
        </>
      )}
    </button>
  );
}

// Extend window type so TypeScript doesn't complain
declare global {
  interface Window {
    switchToArabic?: () => void;
    switchToEnglish?: () => void;
  }
}
