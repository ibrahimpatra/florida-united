import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { JsonLd, breadcrumb } from '@/components/seo/JsonLd';
import { BundleDetailClient } from '@/components/product/BundleDetailClient';
import { getStorefrontBundle } from '@/lib/firestore-admin';
import { bundleIdFromSlug, bundlePath } from '@/lib/bundle-path';
import { altLinks } from '@/lib/seo';
import { siteBase } from '@/lib/site-url';
import { getBrand } from '@/lib/brand-server';
import { stripHtml } from '@/lib/sanitize-html';

export const revalidate = 3600;   // long cache; stock changes refresh it (catalog-sync.ts)
export async function generateStaticParams() { return []; }
interface Props { params: { slug: string } }

const load = async (slug: string) => { try { return await getStorefrontBundle(bundleIdFromSlug(slug)); } catch { return null; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b: any = await load(params.slug);
  if (!b) return { title: 'Bundle not found' };
  const desc = b.metaDesc || stripHtml(b.description || '').slice(0, 160) || `${b.name}: ${(b.items || []).map((i: any) => `${i.quantity} x ${i.productName}`).join(', ')}`.slice(0, 160);
  const img = b.image || b.items?.[0]?.image;
  return {
    title: b.metaTitle || b.name, description: desc, keywords: (b.tags || []).join(', ') || undefined,
    openGraph: { title: b.name, description: desc, type: 'website', siteName: 'Florida Kuwait', images: img ? [{ url: `${siteBase()}/share-image/bundle-${b.id}`, width: 1200, height: 630, type: 'image/jpeg', alt: b.name }] : [] },
    twitter: { card: 'summary_large_image', title: b.name, images: img ? [`${siteBase()}/share-image/bundle-${b.id}`] : undefined },
    alternates: altLinks(bundlePath(b)),
  };
}

export default async function BundlePage({ params }: Props) {
  const b: any = await load(params.slug);
  if (!b) notFound();
  const base = siteBase();
  const abs = (u: string) => (u && u.startsWith('/') ? `${base}${u}` : u);
  const images = [b.image, ...(b.items || []).map((i: any) => i.image)].filter(Boolean);
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: b.name, description: stripHtml(b.description || '') || undefined,
    sku: `BUNDLE-${String(b.id).slice(0, 6).toUpperCase()}`, image: [...new Set(images)].map(abs),
    offers: { '@type': 'Offer', price: b.bundlePrice, priceCurrency: 'KWD', availability: b.available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `${base}${bundlePath(b)}`, seller: { '@type': 'Organization', name: (await getBrand()).fullName } },
  };
  return (
    <>
      <JsonLd data={[jsonLd, breadcrumb(base, [{ name: 'Home', path: '/' }, { name: 'Bundles', path: '/bundles' }, { name: b.name, path: bundlePath(b) }])]} />
      <AnnouncementBar /><Header />
      <main><BundleDetailClient bundle={b} /></main>
      <Footer />
    </>
  );
}
