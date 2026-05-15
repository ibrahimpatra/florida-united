import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { ShopClient } from '@/components/product/ShopClient';

export const metadata: Metadata = {
  title: 'Deals & Offers | Up to 40% Off Hardware & Electrical',
  description: 'Shop the best deals on hardware, electrical supplies, safety equipment and tools. Limited time offers with up to 40% off at Florida Kuwait Company.',
  alternates: { canonical: '/deals' },
};

export default function DealsPage() {
  return (
    <><AnnouncementBar/><Header/>
    <main>
      <div className="bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 text-white py-14">
        <div className="container-custom text-center">
          <div className="text-5xl mb-4">🔥</div>
          <h1 className="text-3xl md:text-4xl font-black font-display mb-2">Hot Deals & Offers</h1>
          <p className="text-orange-100 text-lg mb-6">Up to 40% off — Limited time only!</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            {['Free shipping KWD 15+','30-day returns','Verified quality','Price match guarantee'].map(b=>(
              <span key={b} className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full font-medium">✓ {b}</span>
            ))}
          </div>
        </div>
      </div>
      <ShopClient initialFilters={{ sale: 'true' }} />
    </main>
    <Footer/></>
  );
}
