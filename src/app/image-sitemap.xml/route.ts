import { siteBase } from '@/lib/site-url';
import { adminGetProducts } from '@/lib/firestore-admin';
import { fixImageUrl } from '@/lib/image-url';

/**
 * Image sitemap for Google Images: every product page with its pictures, titles and captions.
 * Pictures are served from this site's own /media address (indexable JPEG/WebP files), so they qualify for Google Images.
 * Built from the shared in-memory product list (no extra database reads) and cached for an hour.
 */
export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  const BASE = siteBase();
  const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : `${BASE}${u.startsWith('/') ? '' : '/'}${u}`);
  let rows = '';
  try {
    const { items } = await adminGetProducts({ pageSize: 5000 });
    for (const p of items as any[]) {
      const imgs = (p.images || []).map((u: string) => fixImageUrl(u)).filter(Boolean).slice(0, 8);
      if (!imgs.length) continue;
      rows += `<url><loc>${esc(`${BASE}/shop/products/${p.slug}`)}</loc>` +
        imgs.map((u: string, i: number) => `<image:image><image:loc>${esc(abs(u))}</image:loc><image:title>${esc(String(p.name || ''))}${i ? ` - ${i + 1}` : ''}</image:title>${p.brand ? `<image:caption>${esc(`${p.brand} ${p.name}`)}</image:caption>` : ''}</image:image>`).join('') + '</url>';
    }
  } catch { /* an empty sitemap is better than an error */ }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${rows}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
