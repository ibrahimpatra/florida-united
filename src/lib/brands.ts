/**
 * Brands: a managed list (logo, Arabic name, description, SEO) that products point to by NAME (product.brand stays a plain string,
 * so old products, imports and the AI keep working). Saving a brand queues the background fill for blank Arabic/SEO text.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { queueFill } from './bg';
import type { Brand } from '@/types';

export class BrandError extends Error { constructor(public status: number, m: string) { super(m); } }
const COL = 'brands';
export const brandSlug = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const iso = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);
const shape = (id: string, d: any): Brand => ({ id, ...d, createdAt: iso(d.createdAt) || '', updatedAt: iso(d.updatedAt) || '' });

const FIELDS = ['name', 'nameAr', 'slug', 'description', 'descriptionAr', 'image', 'imageAlt', 'imageAltAr', 'website', 'isActive', 'showOnHome', 'sortOrder', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr', 'tags'];
function pick(data: any): Record<string, any> {
  const o: Record<string, any> = {};
  for (const k of FIELDS) if (data && data[k] !== undefined) o[k] = data[k];
  for (const k of ['name', 'nameAr', 'description', 'descriptionAr', 'image', 'imageAlt', 'imageAltAr', 'website', 'metaTitle', 'metaDesc', 'metaTitleAr', 'metaDescAr'])
    if (typeof o[k] === 'string') o[k] = o[k].trim();
  if (o.metaTitle) o.metaTitle = String(o.metaTitle).slice(0, 70);
  if (o.metaDesc) o.metaDesc = String(o.metaDesc).slice(0, 170);
  if (o.metaTitleAr) o.metaTitleAr = String(o.metaTitleAr).slice(0, 70);
  if (o.metaDescAr) o.metaDescAr = String(o.metaDescAr).slice(0, 170);
  if (o.sortOrder !== undefined) o.sortOrder = Number(o.sortOrder) || 0;
  if (o.tags !== undefined) o.tags = Array.isArray(o.tags) ? [...new Set(o.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 15) : [];
  if (o.website && !/^https?:\/\//i.test(o.website)) throw new BrandError(400, 'Website must start with https://');
  return o;
}

export async function getBrands(activeOnly = true): Promise<Brand[]> {
  const snap = await getAdminDb().collection(COL).get();
  let list = snap.docs.map(d => shape(d.id, d.data()));
  if (activeOnly) list = list.filter(b => b.isActive !== false);
  return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const snap = await getAdminDb().collection(COL).where('slug', '==', slug).limit(1).get();
  return snap.empty ? null : shape(snap.docs[0].id, snap.docs[0].data());
}

export async function createBrand(data: any): Promise<string> {
  const db = getAdminDb(); const clean = pick(data);
  if (!clean.name) throw new BrandError(400, 'Brand name is required.');
  const all = (await db.collection(COL).get()).docs.map(d => d.data() as any);
  if (all.some(b => String(b.name || '').toLowerCase() === clean.name.toLowerCase())) throw new BrandError(409, `A brand called "${clean.name}" already exists.`);
  let slug = brandSlug(clean.slug || clean.name) || `brand-${Date.now().toString(36)}`;
  if (all.some(b => b.slug === slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const ref = await db.collection(COL).add({ isActive: true, showOnHome: true, sortOrder: 0, ...clean, slug, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  queueFill(COL, ref.id);
  return ref.id;
}

export async function updateBrand(id: string, data: any): Promise<void> {
  const db = getAdminDb(); const clean = pick(data); delete clean.slug;
  const cur = await db.collection(COL).doc(id).get();
  if (!cur.exists) throw new BrandError(404, 'Brand not found.');
  const old = cur.data() as any;
  if ('name' in clean) {
    if (!clean.name) throw new BrandError(400, 'Brand name is required.');
    const all = (await db.collection(COL).get()).docs.filter(d => d.id !== id).map(d => d.data() as any);
    if (all.some(b => String(b.name || '').toLowerCase() === clean.name.toLowerCase())) throw new BrandError(409, `A brand called "${clean.name}" already exists.`);
  }
  await db.collection(COL).doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
  queueFill(COL, id);
  // products keep the brand NAME: a rename must follow
  if (clean.name && clean.name !== old.name) {
    const ps = await db.collection('products').where('brand', '==', old.name).get();
    for (let i = 0; i < ps.docs.length; i += 400) {
      const b = db.batch(); ps.docs.slice(i, i + 400).forEach(d => b.update(d.ref, { brand: clean.name })); await b.commit();
    }
    const { invalidateProductCache } = await import('./firestore-admin'); invalidateProductCache();
  }
}

export async function deleteBrand(id: string): Promise<void> {
  const db = getAdminDb(); await db.collection(COL).doc(id).delete();   // products keep their brand text; it simply has no brand page any more
}

/** Creates a brand record for every brand NAME that has none yet (used by product save and import). Returns how many were created. */
export async function ensureBrands(names: string[]): Promise<number> {
  const want = new Map<string, string>();
  for (const n of names) { const t = String(n || '').trim(); if (t && !want.has(t.toLowerCase())) want.set(t.toLowerCase(), t); }
  if (!want.size) return 0;
  const db = getAdminDb();
  const have = new Set((await db.collection(COL).get()).docs.map(d => String((d.data() as any).name || '').toLowerCase()));
  let n = 0;
  for (const [k, name] of want) { if (have.has(k)) continue; try { await createBrand({ name }); n++; } catch { /* a parallel save made it first */ } }
  return n;
}

/** Brand strip for the home page: managed brands flagged showOnHome (with logos); if none exist yet, the most used product brands. */
export async function getHomeBrands(limit = 12): Promise<Pick<Brand, 'name' | 'nameAr' | 'slug' | 'image' | 'imageAlt' | 'imageAltAr'>[]> {
  const managed = (await getBrands(true)).filter(b => b.showOnHome !== false);
  if (managed.length) return managed.slice(0, limit).map(b => ({ name: b.name, nameAr: b.nameAr, slug: b.slug, image: b.image, imageAlt: b.imageAlt, imageAltAr: b.imageAltAr }));
  const { getTopBrands } = await import('./firestore-admin');
  return (await getTopBrands(limit)).map(n => ({ name: n, slug: brandSlug(n) }));
}
