import { siteBase } from '@/lib/site-url';
import { MetadataRoute } from 'next';
import { adminGetCategories, adminGetProducts } from '@/lib/firestore-admin';

const BASE = siteBase();

type Entry = MetadataRoute.Sitemap[number];
/** One entry per language, each pointing at the other (hreflang), so Google serves the right one. */
const both = (path: string, e: Omit<Entry, 'url' | 'alternates'>): Entry[] => {
  const en = `${BASE}${path === '/' ? '' : path}`, ar = `${BASE}/ar${path === '/' ? '' : path}`;
  const alternates = { languages: { en, ar } };
  return [{ url: en, alternates, ...e }, { url: ar, alternates, ...e }];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    ...both('/', { lastModified: new Date(), changeFrequency: 'daily', priority: 1 }),
    ...both('/shop', { lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 }),
    ...both('/deals', { lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 }),
    ...both('/contact', { lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 }),
    ...both('/about', { lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 }),
    ...both('/terms', { lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 }),
    ...both('/privacy', { lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 }),
    ...both('/shipping-info', { lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 }),
    ...both('/returns-policy', { lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 }),
    ...both('/bundles', { lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 }),
  ];

  let categoryPages: MetadataRoute.Sitemap = [];
  let productPages: MetadataRoute.Sitemap = [];
  let brandPages: MetadataRoute.Sitemap = [];

  try {
    const categories = await adminGetCategories(true);
    categoryPages = categories.flatMap(c => both(`/shop/${c.slug}`, { lastModified: new Date(c.updatedAt || c.createdAt), changeFrequency: 'weekly', priority: 0.8 }));
  } catch {}

  try {
    const { getBrands } = await import('@/lib/brands');
    brandPages = (await getBrands(true)).flatMap(b => both(`/brands/${b.slug}`, { lastModified: new Date(b.updatedAt || b.createdAt || Date.now()), changeFrequency: 'weekly', priority: 0.6 }));
  } catch {}

  try {
    const { items } = await adminGetProducts({ pageSize: 5000 });
    productPages = items.flatMap(p => both(`/shop/products/${p.slug}`, {
      lastModified: new Date(p.updatedAt || p.createdAt), changeFrequency: 'weekly', priority: 0.7,
    }));
  } catch {}

  return [...staticPages, ...categoryPages, ...brandPages, ...productPages];
}
