/**
 * Copies a picture that lives on someone else's website onto our own image storage (WebP, shrunk), so it cannot disappear,
 * change or be blocked later, and so it is served from our own domain.
 *
 * The address comes from an uploaded spreadsheet, so it is treated as untrusted: only http(s), never private/internal addresses
 * (checked again after every redirect and after DNS lookup), a time limit, a size limit, and it must really be an image.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import sharp from 'sharp';
import { fixImageUrl } from './image-url';
import { r2Enabled, uploadToR2 } from './r2';

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/** True for a link to a picture on another site (not one of ours: "/media/...", a relative path, or an old storage link we already serve). */
export function isExternalImage(u: unknown): boolean {
  if (typeof u !== 'string') return false;
  const f = fixImageUrl(u.trim());
  return typeof f === 'string' && /^https?:\/\//i.test(f);
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb')) return true;
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l); if (m) return isPrivateAddress(m[1]);
    return false;
  }
  return true;   // not an address we understand
}

async function assertPublicHost(host: string) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('That address is not allowed.');
  if (net.isIP(h)) { if (isPrivateAddress(h)) throw new Error('That address is not allowed.'); return; }
  const addrs = await dns.lookup(h, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateAddress(a.address))) throw new Error('That address is not allowed.');
}

async function download(start: string): Promise<{ buf: Buffer; type: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) picture links are supported.');
    await assertPublicHost(u.hostname);
    const res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImageImporter/1.0)', Accept: 'image/*' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location')!, u).toString(); continue; }
    if (!res.ok) throw new Error(`The other site answered ${res.status}.`);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!/^image\//.test(type)) throw new Error('That link is not a picture.');
    if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('The picture is too large (max 8 MB).');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('The picture is too large (max 8 MB).');
    return { buf, type };
  }
  throw new Error('Too many redirects.');
}

let override: null | ((url: string, hint: string) => Promise<string>) = null;
export function __setIngestForTests(f: typeof override) { override = f; }

/** Downloads `url`, shrinks it to WebP and stores it. Returns our own "/media/products/..." link. Throws a readable message on failure. */
export async function ingestImage(url: string, hint = ''): Promise<string> {
  if (override) return override(url, hint);
  if (!r2Enabled()) throw new Error('Image storage is not set up (R2), so the picture was left as a link.');
  const { buf } = await download(fixImageUrl(url.trim()));
  let out: Buffer;
  try { out = await sharp(buf).rotate().resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toBuffer(); }
  catch { throw new Error('The picture could not be read.'); }
  const slug = hint.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return uploadToR2(`products/${slug ? slug + '-' : ''}${Math.random().toString(36).slice(2, 8)}.webp`, out, 'image/webp');
}
