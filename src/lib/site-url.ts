/**
 * The public address of the shop, safe on server and browser. Never returns localhost or an app-shell address (capacitor://),
 * so links shared from a phone, copied from a card, sent by WhatsApp or e-mailed always open the real website.
 * In the browser: the address the visitor is on (exactly what the product page's share button always used) > NEXT_PUBLIC_APP_URL > floridakuwait.com.
 * On the server: NEXT_PUBLIC_APP_URL (if it is a real address) > floridakuwait.com.
 */
export const FALLBACK_SITE_URL = 'https://floridakuwait.com';
const isLocal = (u: string) => !/^https?:\/\//i.test(u) || /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.)/i.test(u);

export function siteBase(): string {
  if (typeof window !== 'undefined') { const o = window.location.origin; if (o && !isLocal(o)) return o; }
  const env = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (env && !isLocal(env)) return env;
  return FALLBACK_SITE_URL;
}

/** Full link to a product page (the language prefix is kept when the visitor is on the Arabic site). */
export function productLink(slug: string, ar = false): string {
  return `${siteBase()}${ar ? '/ar' : ''}/shop/products/${slug}`;
}

/** Opens the phone's share sheet, or copies the link. Never throws. Returns what happened so the caller can show a message. */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).share) { await (navigator as any).share({ title, url }); return 'shared'; }
  } catch (e: any) { if (e?.name === 'AbortError') return 'shared'; }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { /* old browsers / blocked clipboard */ }
  try {
    const t = document.createElement('textarea'); t.value = url; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy'); document.body.removeChild(t); return ok ? 'copied' : 'failed';
  } catch { return 'failed'; }
}
