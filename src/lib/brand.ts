/**
 * Brand = everything a different client would change: name, tagline, contact details, logo, theme colours.
 * Defaults come from siteConfig.ts; whatever is saved in Admin > Settings (config/storeSettings) overrides them.
 * This file is safe to import from the browser. The Firestore read lives in brand-server.ts.
 */
import { SITE_CONFIG } from './siteConfig';

type Widen<T> = { -readonly [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : T[K] };
export type Brand = Widen<typeof SITE_CONFIG> & { logoUrl: string; faviconUrl: string; brandColor: string; accentColor: string };

export const DEFAULT_BRAND_COLOR = '#234b63';   // brand-600
export const DEFAULT_ACCENT_COLOR = '#f5b800';  // accent-500

export const DEFAULT_BRAND: Brand = { ...(SITE_CONFIG as any), logoUrl: '/logo.svg', faviconUrl: '', brandColor: DEFAULT_BRAND_COLOR, accentColor: DEFAULT_ACCENT_COLOR };

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHex = (v: any): v is string => typeof v === 'string' && HEX.test(v);
const s = (v: any) => (typeof v === 'string' ? v.trim() : '');

/** Applies saved settings over the defaults. Blank saved values keep the default. */
export function mergeBrand(st: Record<string, any> | null | undefined): Brand {
  const x = st || {};
  const b: Brand = { ...DEFAULT_BRAND };
  const name = s(x.storeName);
  if (name) {
    b.name = name; b.fullName = name;
    b.logoText = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || b.logoText;
  }
  if (s(x.storeNameAr)) b.fullNameAr = s(x.storeNameAr);
  if (s(x.tagline)) b.tagline = s(x.tagline);
  if (s(x.taglineAr)) b.taglineAr = s(x.taglineAr);
  if (s(x.phone)) { b.phone = s(x.phone); b.phoneTel = s(x.phone).replace(/[^\d+]/g, ''); }
  if (s(x.whatsapp)) b.whatsapp = s(x.whatsapp).replace(/\D/g, '');
  if (s(x.email)) b.email = s(x.email);
  if (s(x.emailOrders)) b.emailOrders = s(x.emailOrders);
  if (s(x.address)) { b.addressFull = s(x.address); b.addressLine2 = s(x.address); }
  // Arabic address: its own setting; if only the English one was changed, show that rather than the stale default
  if (s(x.addressAr)) b.addressFullAr = s(x.addressAr); else if (s(x.address)) b.addressFullAr = s(x.address);
  if (s(x.hoursWeekdays)) b.hoursWeekdays = s(x.hoursWeekdays);
  if (s(x.hoursSaturday)) b.hoursSaturday = s(x.hoursSaturday);
  if (s(x.logoUrl)) b.logoUrl = s(x.logoUrl);
  if (s(x.faviconUrl)) b.faviconUrl = s(x.faviconUrl);
  if (isHex(x.brandColor)) b.brandColor = x.brandColor;
  if (isHex(x.accentColor)) b.accentColor = x.accentColor;
  return b;
}

// ── colour scales ─────────────────────────────────────────────
const toRgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as any;
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as any;
const hex = (c: number[]) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const WHITE: [number, number, number] = [255, 255, 255], BLACK: [number, number, number] = [0, 0, 0];

/** One picked colour -> 50..950. `anchor` is the shade the picked colour becomes (600 for brand, 500 for accent). */
export function colourScale(base: string, anchor: 500 | 600 = 600): Record<number, string> {
  const c = toRgb(base);
  const lighter: Record<number, number> = anchor === 600 ? { 500: 0.12, 400: 0.35, 300: 0.55, 200: 0.72, 100: 0.86, 50: 0.93 } : { 400: 0.2, 300: 0.4, 200: 0.6, 100: 0.8, 50: 0.9 };
  const darker: Record<number, number> = anchor === 600 ? { 700: 0.2, 800: 0.36, 900: 0.5, 950: 0.62 } : { 600: 0.15, 700: 0.35, 800: 0.5, 900: 0.65 };
  const out: Record<number, string> = { [anchor]: base.toLowerCase() };
  for (const [k, t] of Object.entries(lighter)) out[+k] = hex(mix(c, WHITE, t));
  for (const [k, t] of Object.entries(darker)) out[+k] = hex(mix(c, BLACK, t));
  return out;
}

/** CSS custom properties (space separated "R G B" so Tailwind opacity modifiers keep working). */
export function themeCss(brandColor: string, accentColor: string): string {
  if (brandColor.toLowerCase() === DEFAULT_BRAND_COLOR && accentColor.toLowerCase() === DEFAULT_ACCENT_COLOR) return '';
  const lines: string[] = [];
  for (const [k, v] of Object.entries(colourScale(brandColor, 600))) lines.push(`--brand-${k}:${toRgb(v).join(' ')}`);
  for (const [k, v] of Object.entries(colourScale(accentColor, 500))) lines.push(`--accent-${k}:${toRgb(v).join(' ')}`);
  return `:root{${lines.join(';')}}`;
}

/** Theme file other clients can import: only the look and the identity, nothing private. */
export const THEME_KEYS = ['storeName', 'storeNameAr', 'tagline', 'taglineAr', 'logoUrl', 'faviconUrl', 'brandColor', 'accentColor'] as const;
