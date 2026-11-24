import { altLinks, siteUrl } from '@/lib/seo';
import { JsonLd, organization } from '@/components/seo/JsonLd';
import { getBrand } from '@/lib/brand-server';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroBanner } from '@/components/home/HeroBanner';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { DealsProducts } from '@/components/home/DealsProducts';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { NewArrivals } from '@/components/home/NewArrivals';
import { FlashDealsSection } from '@/components/home/FlashDealsSection';
import { BrandsSection } from '@/components/home/BrandsSection';
import { TrustBadges } from '@/components/home/TrustBadges';
import { PromoTiles } from '@/components/home/PromoTiles';
import { RecentlyViewed } from '@/components/product/RecentlyViewed';
import { SectionHeader } from '@/components/home/SectionHeader';
import { getHomeBrands } from '@/lib/brands';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { ProductSkeleton } from '@/components/product/ProductSkeleton';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return {
    title: { absolute: `${b.name} | Hardware & Electrical Supplies in Kuwait` },
    description: "Shop Kuwait's best selection of hardware, electrical supplies, safety equipment and more. Free shipping on qualifying orders.",
    alternates: altLinks('/'),
  };
}

export const revalidate = 300;

export default async function HomePage() {
  const SITE_CONFIG = await getBrand();
  const brands = await getHomeBrands(12).catch(() => []);
  return (
    <>
      <AnnouncementBar/>
      <Header/>
      <main>
        <HeroBanner/>
        <FlashDealsSection/>
        <PromoTiles/>
        <DealsProducts/>
        <TrustBadges/>
        <section className="section bg-gray-50">
          <div className="container-custom">
            <SectionHeader k="shopByCat" href="/shop"/>
            <CategoryGrid/>
          </div>
        </section>
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
        <div className="container-custom"><RecentlyViewed/></div>
        <BrandsSection brands={brands}/>
        <NewsletterSection/>
      </main>
      <Footer/>
      <JsonLd data={[
        organization(SITE_CONFIG, siteUrl()),
        { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_CONFIG.fullName, url: siteUrl(),
          potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl()}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
      ]} />
    </>
  );
}
