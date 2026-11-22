import { listingSeo } from '@/lib/seo';
import { adminGetActiveFlashDeals } from '@/lib/shipping-admin';
import { baseMeta as BM } from '@/lib/listing-meta';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { DealsHero } from '@/components/layout/PageHero';
import { ShopClient } from '@/components/product/ShopClient';

export const revalidate = 300;
const baseMeta = BM.deals;
export async function generateMetadata(): Promise<Metadata> {
  let s: ReturnType<typeof listingSeo> = {};
  try { s = listingSeo(await adminGetActiveFlashDeals(), 'en'); } catch {}
  return { ...baseMeta, title: s.title || baseMeta.title, description: s.description || baseMeta.description, keywords: s.keywords };
}

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
