import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { ShopClient } from '@/components/product/ShopClient';
import { adminGetCategories } from '@/lib/firestore-admin';
import { notFound } from 'next/navigation';

interface Props { params: { category: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let cat = null;
  try { const cats = await adminGetCategories(false);
    cat = cats.find(c => c.slug === params.category) || null; } catch {}
  if (!cat) return { title: 'Category Not Found' };
  return {
    title: cat.metaTitle || `${cat.name} — Florida Kuwait Company`,
    description: cat.metaDesc || `Shop ${cat.name} at Florida Kuwait Company. Best prices on hardware and electrical supplies in Florida.`,
    alternates: { canonical: `/shop/${cat.slug}` },
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
      <div className="page-hero">
        <div className="container-custom">
          <nav className="text-sm text-gray-500 mb-3" aria-label="Breadcrumb">
            <a href="/" className="hover:text-brand-600">Home</a> <span className="mx-2">/</span>
            <a href="/shop" className="hover:text-brand-600">Shop</a> <span className="mx-2">/</span>
            <span className="text-gray-800 font-medium">{catName}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 font-display">{catName}</h1>
          {cat?.description && <p className="text-gray-500 mt-1">{cat.description}</p>}
        </div>
      </div>
      <ShopClient initialFilters={{ categoryId: cat?.id || params.category, categorySlug: params.category }} />
    </main>
    <Footer/></>
  );
}
