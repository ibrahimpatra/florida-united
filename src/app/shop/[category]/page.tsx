import { altLinks, siteUrl } from '@/lib/seo';
import { JsonLd, breadcrumb } from '@/components/seo/JsonLd';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { ShopClient } from '@/components/product/ShopClient';
import { adminGetCategories } from '@/lib/firestore-admin';
import { CategoryHero } from '@/components/layout/PageHero';
import { notFound } from 'next/navigation';

interface Props { params: { category: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let cat = null;
  try { const cats = await adminGetCategories(false);
    cat = cats.find(c => c.slug === params.category) || null; } catch {}
  if (!cat) return { title: 'Category Not Found' };
  return {
    title: cat.metaTitle || cat.name,
    description: cat.metaDesc || `Shop ${cat.name}. Best prices on hardware and electrical supplies in Kuwait.`,
    alternates: altLinks(`/shop/${cat.slug}`),
  };
}

export default async function CategoryPage({ params }: Props) {
  let cat = null;
  try { const cats = await adminGetCategories(false);
    cat = cats.find(c => c.slug === params.category) || null; } catch {}

  // Allow known static slugs even if not in DB yet
  const knownSlugs = ['electrical','hardware','safety','lighting','plumbing','industrial','fasteners','conduit'];
  if (!cat && !knownSlugs.includes(params.category)) notFound();

  const catName = cat?.name || params.category.replace(/-/g,' ').replace(/\b\w/g,l=>l.toUpperCase());

  return (
    <><AnnouncementBar/><Header/>
    <main>
      <CategoryHero cat={cat ? JSON.parse(JSON.stringify(cat)) : null} fallbackName={catName} />
      <ShopClient key={params.category} initialFilters={{ categoryId: cat?.id || params.category, categorySlug: params.category }} />
    </main>
    <Footer/>
    <JsonLd data={breadcrumb(siteUrl(), [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: catName, path: `/shop/${params.category}` }])} /></>
  );
}
