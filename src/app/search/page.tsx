import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SearchHero } from '@/components/layout/PageHero';
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
        <SearchHero q={q} />
        <ShopClient initialFilters={{ q }} />
      </main>
      <Footer/>
    </>
  );
}
