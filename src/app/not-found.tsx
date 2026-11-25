'use client';
import Link from '@/components/ui/LocLink';
import { SearchX } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

export default function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <><Header />
    <main className="bg-gray-50 min-h-[60vh] flex items-center justify-center px-4 py-6">
      <div className="text-center max-w-md">
        <SearchX className="w-14 h-14 text-gray-300 mx-auto mb-5" />
        <h1 className="text-6xl font-black text-brand-700 mb-2 font-display">404</h1>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('c1_err.nfTitle')}</h2>
        <p className="text-gray-500 mb-5">{t('c1_err.nfBody')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary py-3 px-8">{t('c1_err.home')}</Link>
          <Link href="/shop" className="btn-secondary py-3 px-8">{t('c1_err.browse')}</Link>
        </div>
      </div>
    </main>
    <Footer /></>
  );
}
