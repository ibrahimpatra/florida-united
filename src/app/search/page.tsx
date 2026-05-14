import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShopClient } from '@/components/product/ShopClient';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';

export function generateMetadata({ searchParams }: { searchParams: { q?: string } }): Metadata {
  const q = searchParams.q || '';
  return {
    title: q ? `Search results for "${q}"` : 'Search Products',
    description: `Search results for ${q} — Florida Kuwait Company hardware and electrical supplies.`,
    robots: { index: false },
  };
}

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || '';
  return (
    <>
      <AnnouncementBar/>
      <Header/>
      <main>
        <div className="page-hero">
          <div className="container-custom">
            <h1 className="text-2xl font-bold text-gray-900 font-display">
              {q ? <>Search results for "<span className="text-brand-600">{q}</span>"</> : 'Search Products'}
            </h1>
          </div>
        </div>
        <ShopClient initialFilters={{ q }} />
      </main>
      <Footer/>
    </>
  );
}
