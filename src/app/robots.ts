import { MetadataRoute } from 'next';
const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://floridakuwait.com';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/account/', '/checkout', '/cart', '/auth/'] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
