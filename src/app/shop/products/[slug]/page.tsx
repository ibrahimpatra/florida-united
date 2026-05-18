import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { adminGetProductBySlug, adminGetProducts } from '@/lib/firestore-admin';

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let product: import("@/types").Product | null = null;
  try { product = await adminGetProductBySlug(params.slug); } catch {}
  if (!product) return { title: 'Product Not Found' };
  return {
    title: product.metaTitle || product.name,
    description: product.metaDesc || product.shortDescription || product.description?.slice(0,160),
    keywords: (product as any).metaKeywords || product.tags?.join(', '),
    openGraph: {
      title: product.name,
      description: product.shortDescription || product.description?.slice(0,160) || '',
      images: product.images?.length ? [{ url: product.images[0], alt: product.name }] : [],
      type: 'website',
    },
    alternates: { canonical: `/shop/products/${product.slug}` },
  };
}

export default async function ProductPage({ params }: Props) {
  let product: import("@/types").Product | null = null;
  let related: any[] = [];
  try {
    product = await adminGetProductBySlug(params.slug);
    if (product) { const pid = product.id; related = await adminGetProducts({ categoryId: product.categoryId, pageSize: 7 }).then(r => r.items.filter(p => p.id !== pid).slice(0,6)).catch(() => []); }
  } catch {}
  if (!product) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://floridakuwait.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    image: product.images,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'KWD',
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${siteUrl}/shop/products/${product.slug}`,
      seller: { '@type': 'Organization', name: 'Florida Kuwait Company' },
    },
    aggregateRating: product.totalReviews > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.avgRating,
      reviewCount: product.totalReviews,
    } : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <AnnouncementBar />
      <Header />
      <main>
        <ProductDetailClient product={product} relatedProducts={related} />
      </main>
      <Footer />
    </>
  );
}
