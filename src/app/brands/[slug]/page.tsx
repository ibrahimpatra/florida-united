import { altLinks, siteUrl } from '@/lib/seo';
import { JsonLd, breadcrumb } from '@/components/seo/JsonLd';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { ShopClient } from '@/components/product/ShopClient';
import { BrandHero } from '@/components/layout/PageHero';
import { getBrandBySlug } from '@/lib/brands';
import { notFound } from 'next/navigation';

interface Props { params: { slug: string } }
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBrandBySlug(params.slug).catch(() => null);
  if (!b || b.isActive === false) return { title: 'Brand not found' };
  return {
    title: b.metaTitle || `${b.name} products in Kuwait`,
    description: b.metaDesc || b.description || `Shop ${b.name} hardware and electrical supplies in Kuwait.`,
    keywords: b.tags?.length ? b.tags : undefined,
    alternates: altLinks(`/brands/${b.slug}`),
    openGraph: b.image ? { images: [b.image] } : undefined,
  };
}

export default async function BrandPage({ params }: Props) {
  const b = await getBrandBySlug(params.slug).catch(() => null);
  if (!b || b.isActive === false) notFound();
  return (
    <><AnnouncementBar /><Header />
      <main>
        <BrandHero brand={JSON.parse(JSON.stringify(b))} />
        <ShopClient key={b.slug} initialFilters={{ brand: b.name }} />
      </main>
      <Footer />
      <JsonLd data={breadcrumb(siteUrl(), [{ name: 'Home', path: '/' }, { name: b.name, path: `/brands/${b.slug}` }])} />
    </>
  );
}
