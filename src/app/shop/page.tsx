import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShopClient } from '@/components/product/ShopClient';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse 50,000+ hardware and electrical products. Filter by category, price, brand and more.',
};

export default function ShopPage({ searchParams }: { searchParams: Record<string,string> }) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main>
        <div className="page-hero">
          <div className="container-custom">
            <nav className="text-sm text-gray-500 mb-3" aria-label="Breadcrumb">
              <a href="/" className="hover:text-brand-600">Home</a> <span className="mx-2">/</span>
              <span className="text-gray-800 font-medium">Shop</span>
            </nav>
            <h1 className="text-3xl font-bold text-gray-900 font-display">All Products</h1>
            <p className="text-gray-500 mt-1">50,000+ hardware & electrical products</p>
          </div>
        </div>
        <ShopClient initialFilters={searchParams} />
      </main>
      <Footer />
    </>
  );
}
