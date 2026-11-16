import { SITE_CONFIG } from '@/lib/siteConfig';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroBanner } from '@/components/home/HeroBanner';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { NewArrivals } from '@/components/home/NewArrivals';
import { FlashDealsSection } from '@/components/home/FlashDealsSection';
import { BrandsSection } from '@/components/home/BrandsSection';
import { TrustBadges } from '@/components/home/TrustBadges';
import { SectionHeader } from '@/components/home/SectionHeader';
import { getTopBrands } from '@/lib/firestore-admin';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { ProductSkeleton } from '@/components/product/ProductSkeleton';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';

export const metadata: Metadata = {
  title: 'Florida Kuwait | Hardware & Electrical Supplies in Kuwait',
  description: "Shop Kuwait's best selection of hardware, electrical supplies, safety equipment and more. Free shipping on qualifying orders.",
  alternates: { canonical: '/' },
};

export const revalidate = 300;

export default async function HomePage() {
  const brands = await getTopBrands(12).catch(() => [] as string[]);
  return (
    <>
      <AnnouncementBar/>
      <Header/>
      <main>
        <HeroBanner/>
        <TrustBadges/>
        <section className="section bg-gray-50">
          <div className="container-custom">
            <SectionHeader k="shopByCat" href="/shop"/>
            <CategoryGrid/>
          </div>
        </section>
        <FlashDealsSection/>
        <section className="section">
          <div className="container-custom">
            <SectionHeader k="featured" href="/shop?featured=true"/>
            <Suspense fallback={<ProductSkeleton count={8}/>}><FeaturedProducts/></Suspense>
          </div>
        </section>
        <section className="section bg-gray-50">
          <div className="container-custom">
            <SectionHeader k="newArrivals" href="/shop?new=true"/>
            <Suspense fallback={<ProductSkeleton count={4}/>}><NewArrivals/></Suspense>
          </div>
        </section>
        <BrandsSection brands={brands}/>
        <NewsletterSection/>
      </main>
      <Footer/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        '@context':'https://schema.org','@type':'WebSite','name':SITE_CONFIG.fullName,
        'url': process.env.NEXT_PUBLIC_APP_URL,
        'potentialAction':{'@type':'SearchAction','target':{'@type':'EntryPoint','urlTemplate':`${process.env.NEXT_PUBLIC_APP_URL}/search?q={search_term_string}`},'query-input':'required name=search_term_string'}
      })}}/>
    </>
  );
}
