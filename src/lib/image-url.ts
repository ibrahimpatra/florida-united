/**
 * Image links saved without "https://" (for example R2_PUBLIC_URL set to "img.example.com") become relative links
 * and open as /shop/products/img.example.com/... (404). This repairs them wherever they are read or written.
 */
export function fixImageUrl(u: any): any {
  if (typeof u !== 'string') return u;
  const s = u.trim();
  if (!s || s.startsWith('/') || s.startsWith('data:') || /^https?:\/\//i.test(s)) return s;
  // "host.tld/path" (first segment looks like a domain) -> https://host.tld/path
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?\//i.test(s)) return `https://${s}`;
  return s;
}

/** R2_PUBLIC_URL with scheme and no trailing slash. */
export function publicBase(raw: string | undefined): string {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(s) ? s : s ? `https://${s}` : '';
}
