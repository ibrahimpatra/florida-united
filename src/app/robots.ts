import { siteBase } from '@/lib/site-url';
import { MetadataRoute } from 'next';
const BASE = siteBase();
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/account/', '/checkout', '/cart', '/auth/', '/search?', '/order-tracking'] },
    ],
    sitemap: [`${BASE}/sitemap.xml`, `${BASE}/image-sitemap.xml`],
    host: BASE,
  };
}
