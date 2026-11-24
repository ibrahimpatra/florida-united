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

export default async function DealsPage({ searchParams }: { searchParams: { deal?: string } }) {
  const dealId = typeof searchParams?.deal === 'string' ? searchParams.deal : '';
  let deal: any = null;
  if (dealId) { try { deal = (await adminGetActiveFlashDeals()).find((d: any) => d.id === dealId) || null; } catch {} }
  return (
    <><AnnouncementBar/><Header/>
    <main>
      <DealsHero />
      {dealId && (
        <div className="container-custom pt-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-2.5 text-sm">
            <span className="font-semibold text-brand-800 truncate">{deal ? (deal.title || 'Offer') : 'This offer has ended'}</span>
            <a href="/deals" className="text-brand-700 font-semibold underline shrink-0">All deals</a>
          </div>
        </div>
      )}
      <ShopClient key={dealId} initialFilters={{ sale: 'true', ...(dealId ? { deal: dealId } : {}) }} />
    </main>
    <Footer/></>
  );
}
