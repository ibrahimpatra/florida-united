/**
 * Picture links. New uploads are stored as "/media/<folder>/<file>" (served from your own domain by app/media).
 * Older products hold full storage addresses (r2.dev, a placeholder like img.yourdomain.com, or a link without https://);
 * fixImageUrl turns every one of those into the same-domain link, so nothing has to be migrated by hand.
 */
const KEY_PATH = /^\/(products|categories|banners|bundles|uploads|brand|brands|returns)\/([A-Za-z0-9._-]+\.(?:webp|jpe?g|png|gif))$/i;

function ownStorageHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h.endsWith('.r2.dev') || h.endsWith('.r2.cloudflarestorage.com') || h === 'img.yourdomain.com' || h.endsWith('.yourdomain.com')) return true;
  const env = (typeof process !== 'undefined' && process.env?.R2_PUBLIC_URL) || '';
  if (env) { try { return new URL(/^https?:\/\//i.test(env) ? env : `https://${env}`).hostname.toLowerCase() === h; } catch { /* ignore */ } }
  return false;
}

export function fixImageUrl(u: any): any {
  if (typeof u !== 'string') return u;
  const s = u.trim();
  if (!s || s.startsWith('/') || s.startsWith('data:')) return s;
  const withScheme = /^https?:\/\//i.test(s) ? s : /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?\//i.test(s) ? `https://${s}` : s;
  if (withScheme === s && !/^https?:\/\//i.test(s)) return s;
  try {
    const url = new URL(withScheme);
    const m = KEY_PATH.exec(url.pathname);
    if (m && ownStorageHost(url.hostname)) return `/media/${m[1].toLowerCase()}/${m[2]}`;
  } catch { /* not a URL */ }
  return withScheme;
}

/** Kept for older imports. */
export function publicBase(raw: string | undefined): string {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(s) ? s : s ? `https://${s}` : '';
}
