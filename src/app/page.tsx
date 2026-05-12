import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroBanner } from '@/components/home/HeroBanner';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { NewArrivals } from '@/components/home/NewArrivals';
import { OffersBanner } from '@/components/home/OffersBanner';
import { FlashDealsSection } from '@/components/home/FlashDealsSection';
import { BrandsSection } from '@/components/home/BrandsSection';
import { TrustBadges } from '@/components/home/TrustBadges';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { ProductSkeleton } from '@/components/product/ProductSkeleton';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';

export const metadata: Metadata = {
  title: 'Florida United Company | #1 Hardware & Electrical Supplies in Florida',
  description: "Shop Florida's best selection of hardware, electrical supplies, safety equipment and more. Trusted by contractors since 2005. Free shipping on orders over $99.",
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <AnnouncementBar/>
      <Header/>
      <main>
        <HeroBanner/>
        <TrustBadges/>
        <section className="section bg-gray-50">
          <div className="container-custom">
            <div className="flex items-center justify-between mb-8">
              <div><h2 className="section-title">Shop by Category</h2><p className="section-subtitle">Find exactly what you need</p></div>
              <a href="/shop" className="text-brand-500 font-semibold hover:text-brand-700 text-sm">View All →</a>
            </div>
            <CategoryGrid/>
          </div>
        </section>
        <FlashDealsSection/>
        <OffersBanner/>
        <section className="section">
          <div className="container-custom">
            <div className="flex items-center justify-between mb-8">
              <div><h2 className="section-title">Featured Products</h2><p className="section-subtitle">Top picks from our catalog</p></div>
              <a href="/shop?featured=true" className="text-brand-500 font-semibold hover:text-brand-700 text-sm">View All →</a>
            </div>
            <Suspense fallback={<ProductSkeleton count={8}/>}><FeaturedProducts/></Suspense>
          </div>
        </section>
        <section className="section bg-gray-50">
          <div className="container-custom">
            <div className="flex items-center justify-between mb-8">
              <div><h2 className="section-title">New Arrivals</h2><p className="section-subtitle">Fresh stock just landed</p></div>
              <a href="/shop?new=true" className="text-brand-500 font-semibold hover:text-brand-700 text-sm">View All →</a>
            </div>
            <Suspense fallback={<ProductSkeleton count={4}/>}><NewArrivals/></Suspense>
          </div>
        </section>
        <BrandsSection/>
        <TestimonialsSection/>
        <NewsletterSection/>
      </main>
      <Footer/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        '@context':'https://schema.org','@type':'WebSite','name':'Florida United Company',
        'url': process.env.NEXT_PUBLIC_APP_URL,
        'potentialAction':{'@type':'SearchAction','target':{'@type':'EntryPoint','urlTemplate':`${process.env.NEXT_PUBLIC_APP_URL}/search?q={search_term_string}`},'query-input':'required name=search_term_string'}
      })}}/>
    </>
  );
}
