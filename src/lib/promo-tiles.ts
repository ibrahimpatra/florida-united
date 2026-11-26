import { queueFill } from './bg';
import { getAdminDb } from './firebase-admin';
import { cfgMemo, dropCfg } from './memo';

export interface PromoTile {
  id: string; title: string; titleAr?: string; badge?: string; badgeAr?: string; link: string; image?: string;
  color: string; isActive: boolean; sortOrder: number;
}

const str = (v: any, n: number) => String(v ?? '').trim().slice(0, n);

/** Whitelist + validate. Throws Error with a message the admin can read. */
export function cleanTile(b: any, partial = false): Record<string, any> {
  const o: Record<string, any> = {};
  if (!partial || 'title' in b) { o.title = str(b.title, 60); if (!o.title) throw new Error('Give the tile a title, for example "Clearance sale".'); }
  for (const k of ['titleAr']) if (k in b) o[k] = str(b[k], 60);
  for (const k of ['badge', 'badgeAr']) if (k in b) o[k] = str(b[k], 20);
  if (!partial || 'link' in b) {
    const l = str(b.link, 300) || '/shop';
    if (!/^(\/|https?:\/\/)/.test(l)) throw new Error('The link must start with "/" or "https://".');
    o.link = l;
  }
  if ('image' in b) o.image = str(b.image, 600);
  for (const k of ['imageAlt', 'imageAltAr']) if (k in b) o[k] = str(b[k], 120);
  if ('color' in b) o.color = /^#[0-9a-fA-F]{6}$/.test(str(b.color, 7)) ? str(b.color, 7) : '#b91c1c';
  if ('isActive' in b) o.isActive = !!b.isActive;
  if ('sortOrder' in b) o.sortOrder = Number(b.sortOrder) || 0;
  if (!partial) { o.color ??= '#b91c1c'; if (!('isActive' in o)) o.isActive = true; o.sortOrder ??= 0; }
  return o;
}

export async function listTiles(activeOnly: boolean): Promise<PromoTile[]> {
  const docs = await cfgMemo(getAdminDb(), 'promo-tiles', 10 * 60_000, async () => (await getAdminDb().collection('promoTiles').get()).docs);
  return docs.map((d: any) => ({ id: d.id, ...d.data() } as PromoTile))
    .filter(t => !activeOnly || t.isActive).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}
export async function createTile(b: any) { dropCfg(); const r = await getAdminDb().collection('promoTiles').add({ ...cleanTile(b), createdAt: new Date().toISOString() }); queueFill('promoTiles', r.id); return r.id; }
export async function updateTile(id: string, b: any) { dropCfg(); await getAdminDb().collection('promoTiles').doc(id).update(cleanTile(b, true)); queueFill('promoTiles', id); }
export async function deleteTile(id: string) { dropCfg(); await getAdminDb().collection('promoTiles').doc(id).delete(); }
