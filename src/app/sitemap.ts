import { MetadataRoute } from 'next';
import { getCategories, getProducts } from '@/lib/firestore';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://floridaunited.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/shop`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/deals`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/order-tracking`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/auth/login`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/auth/register`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  let categoryPages: MetadataRoute.Sitemap = [];
  let productPages: MetadataRoute.Sitemap = [];

  try {
    const cats = await getCategories(true);
    categoryPages = cats.map(c => ({
      url: `${BASE}/shop/${c.slug}`,
      lastModified: new Date(c.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch {}

  try {
    const { items: products } = await getProducts({ pageSize: 500 });
    productPages = products.map(p => ({
      url: `${BASE}/shop/products/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {}

  return [...staticPages, ...categoryPages, ...productPages];
}
