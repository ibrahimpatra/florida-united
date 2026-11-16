import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { DealsHero } from '@/components/layout/PageHero';
import { ShopClient } from '@/components/product/ShopClient';

export const metadata: Metadata = {
  title: 'Deals & Offers',
  description: 'Shop the best deals on hardware, electrical supplies, safety equipment and tools. Current offers at Florida Kuwait Company.',
  alternates: { canonical: '/deals' },
};

export default function DealsPage() {
  return (
    <><AnnouncementBar/><Header/>
    <main>
      <DealsHero />
      <ShopClient initialFilters={{ sale: 'true' }} />
    </main>
    <Footer/></>
  );
}
