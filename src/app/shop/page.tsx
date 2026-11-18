import type { Metadata } from 'next';
import { altLinks } from '@/lib/seo';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShopClient } from '@/components/product/ShopClient';
import { ShopHero } from '@/components/layout/PageHero';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse hardware, electrical and safety products. Filter by category, price and more.',
  alternates: altLinks('/shop'),
};

export default function ShopPage({ searchParams }: { searchParams: Record<string,string> }) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main>
        <ShopHero />
        <ShopClient key={JSON.stringify(searchParams)} initialFilters={searchParams} />
      </main>
      <Footer />
    </>
  );
}
