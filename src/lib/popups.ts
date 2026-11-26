/**
 * Dynamic popups: the admin creates them, shoppers see them according to page, audience, timing and frequency rules.
 * Pure helpers live here so they can be tested; Firestore access is at the bottom.
 */
import { queueFill } from './bg';
import { cfgMemo, dropCfg } from './memo';
import { getAdminDb } from './firebase-admin';

export const POPUP_TRIGGERS = ['delay', 'exit', 'scroll'] as const;
export const POPUP_AUDIENCES = ['everyone', 'guests', 'customers'] as const;
export const POPUP_FREQUENCIES = ['once', 'session', 'daily', 'always'] as const;
export const POPUP_PAGES = ['home', 'shop', 'product', 'cart', 'deals'] as const;   // empty list = every public page
export const POPUP_STYLES = ['light', 'brand', 'accent'] as const;
export const POPUP_LAYOUTS = ['center', 'corner', 'bar'] as const;

export interface Popup {
  id: string; name: string; isActive: boolean; priority: number;
  title: string; titleAr: string; body: string; bodyAr: string; image: string; imageAlt?: string; imageAltAr?: string;
  ctaText: string; ctaTextAr: string; ctaLink: string; couponCode: string;
  layout: typeof POPUP_LAYOUTS[number]; style: typeof POPUP_STYLES[number];
  trigger: typeof POPUP_TRIGGERS[number]; delaySeconds: number; scrollPercent: number;
  audience: typeof POPUP_AUDIENCES[number]; pages: string[]; frequency: typeof POPUP_FREQUENCIES[number];
  startsAt: string; endsAt: string; views: number; clicks: number;
}

const str = (v: any, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = <T extends readonly string[]>(v: any, list: T, d: T[number]): T[number] => (list.includes(v) ? v : d);
const num = (v: any, d: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const dateStr = (v: any) => { if (!v) return ''; const t = new Date(v); return isNaN(t.getTime()) ? '' : t.toISOString(); };
const linkOk = (v: string) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v);

/** Cleans admin input into a storable popup. Throws Error(message) for things the admin must fix. Never returns undefined fields. */
export function sanitizePopup(raw: any): Omit<Popup, 'id' | 'views' | 'clicks'> {
  const o = raw || {};
  const p = {
    name: str(o.name, 80), isActive: o.isActive !== false, priority: Math.round(num(o.priority, 0, 0, 999)),
    title: str(o.title, 120), titleAr: str(o.titleAr, 120), body: str(o.body, 400), bodyAr: str(o.bodyAr, 400), image: str(o.image, 600), imageAlt: str(o.imageAlt, 120), imageAltAr: str(o.imageAltAr, 120),
    ctaText: str(o.ctaText, 40), ctaTextAr: str(o.ctaTextAr, 40), ctaLink: str(o.ctaLink, 300), couponCode: str(o.couponCode, 30).toUpperCase().replace(/\s/g, ''),
    layout: pick(o.layout, POPUP_LAYOUTS, 'center'), style: pick(o.style, POPUP_STYLES, 'light'),
    trigger: pick(o.trigger, POPUP_TRIGGERS, 'delay'), delaySeconds: Math.round(num(o.delaySeconds, 6, 0, 120)), scrollPercent: Math.round(num(o.scrollPercent, 40, 5, 95)),
    audience: pick(o.audience, POPUP_AUDIENCES, 'everyone'), pages: Array.isArray(o.pages) ? o.pages.filter((x: any) => (POPUP_PAGES as readonly string[]).includes(x)) : [],
    frequency: pick(o.frequency, POPUP_FREQUENCIES, 'once'), startsAt: dateStr(o.startsAt), endsAt: dateStr(o.endsAt),
  };
  if (!p.title) throw new Error('Add a headline for the popup.');
  if (!linkOk(p.ctaLink)) throw new Error('The button link must start with / (a page on your site) or https://');
  if (p.startsAt && p.endsAt && p.endsAt <= p.startsAt) throw new Error('The end date must be after the start date.');
  if (!p.name) p.name = p.title.slice(0, 60);
  return p;
}

export const popupIsLive = (p: Pick<Popup, 'isActive' | 'startsAt' | 'endsAt'>, now = new Date()) =>
  p.isActive && (!p.startsAt || new Date(p.startsAt) <= now) && (!p.endsAt || new Date(p.endsAt) > now);

/** What shoppers receive: no stats, no internal name. */
export const publicPopup = ({ views, clicks, name, isActive, ...rest }: Popup) => rest;

// ── Firestore ────────────────────────────────────────────────
const col = () => getAdminDb().collection('popups');
const shape = (d: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Popup => ({ views: 0, clicks: 0, ...(d.data() as any), id: d.id });

export async function listPopups(onlyLive: boolean): Promise<Popup[]> {
  const docs = await cfgMemo(getAdminDb(), 'popups', 10 * 60_000, async () => (await col().get()).docs);
  const all = docs.map(shape).sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  return onlyLive ? all.filter(p => popupIsLive(p)) : all;
}
export async function createPopup(raw: any): Promise<string> { dropCfg();
  const ref = await col().add({ ...sanitizePopup(raw), views: 0, clicks: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  queueFill('popups', ref.id);
  return ref.id;
}
export async function updatePopup(id: string, raw: any) { dropCfg();
  const ref = col().doc(id); const cur = await ref.get();
  if (!cur.exists) throw new Error('Popup not found.');
  await ref.update({ ...sanitizePopup({ ...cur.data(), ...raw }), updatedAt: new Date().toISOString() });
  queueFill('popups', id);
}
export const deletePopup = async (id: string) => { await col().doc(id).delete(); dropCfg(); };
export async function popupEvent(id: string, type: 'view' | 'click') {
  const { FieldValue } = await import('firebase-admin/firestore');
  const ref = col().doc(id); if (!(await ref.get()).exists) return;
  await ref.update({ [type === 'view' ? 'views' : 'clicks']: FieldValue.increment(1) });
}
