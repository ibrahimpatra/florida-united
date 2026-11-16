import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { FieldValue } from 'firebase-admin/firestore';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { invalidateProductCache } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';
const BATCH_SIZE = 400;
const MAX_ROWS = 5000;

const norm = (h: string) => String(h || '').replace(/^﻿/, '').toLowerCase().replace(/[\s_-]+/g, '');
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const num = (v: any): number | undefined => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : undefined; };
const bool = (v: any, dflt: boolean) => { const s = String(v ?? '').trim().toLowerCase(); return s === '' ? dflt : ['true', '1', 'yes', 'y'].includes(s); };
/** Firestore rejects `undefined`; drop those keys. */
const defined = <T extends Record<string, any>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { rows } = await req.json() as { rows: string[][] };
    if (!Array.isArray(rows) || rows.length < 2) return NextResponse.json({ error: 'No data rows found.' }, { status: 400 });
    if (rows.length - 1 > MAX_ROWS) return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS} per file). Split the file and import in parts.` }, { status: 400 });

    const headers = rows[0].map(norm);
    const has = (h: string) => headers.includes(h);
    const missing = ['name', 'sku', 'price', 'stock'].filter(h => !has(h));
    if (!has('category') && !has('categoryid')) missing.push('category');
    if (missing.length) return NextResponse.json({ error: `Missing required column(s): ${missing.join(', ')}` }, { status: 400 });
    const get = (row: string[], h: string) => { const i = headers.indexOf(h); return i < 0 ? '' : String(row[i] ?? '').trim(); };

    const db = getAdminDb();
    const [catSnap, prodSnap] = await Promise.all([db.collection('categories').get(), db.collection('products').select('sku', 'slug').get()]);
    const cats = catSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    const byId = new Map(cats.map((c: any) => [c.id, c]));
    const lc = (s: any) => String(s || '').trim().toLowerCase();
    const findCat = (ref: string, parentId?: string) =>
      cats.find((c: any) => (!parentId || c.parentId === parentId) && (c.id === ref || lc(c.slug) === lc(ref) || lc(c.name) === lc(ref) || (c.nameAr && lc(c.nameAr) === lc(ref))));

    const skus = new Set(prodSnap.docs.map(d => lc((d.data() as any).sku)));
    const slugs = new Set(prodSnap.docs.map(d => String((d.data() as any).slug || '')));

    let created = 0, skipped = 0;
    const errors: string[] = [];
    const ready: Array<Record<string, any>> = [];

    rows.slice(1).forEach((row, idx) => {
      if (!row.some(c => String(c).trim())) return;
      const line = idx + 2; // spreadsheet row number (header is row 1)
      const name = get(row, 'name'), sku = get(row, 'sku');
      const fail = (m: string) => { errors.push(`Row ${line}: ${m}`); skipped++; };
      if (!name) return fail('name is empty');
      if (!sku) return fail(`SKU is empty for "${name}"`);
      if (skus.has(lc(sku))) return fail(`SKU "${sku}" already exists (or is repeated in this file)`);
      const price = num(get(row, 'price'));
      if (price === undefined || price <= 0) return fail(`invalid price for "${name}"`);
      const stock = num(get(row, 'stock'));
      if (stock === undefined || stock < 0) return fail(`invalid stock for "${name}"`);

      // category: name, slug (or id) in the "category" column, optional "subcategory" column, or a "Parent > Child" path
      let catRef = get(row, 'category') || get(row, 'categoryid'), subRef = get(row, 'subcategory');
      if (!subRef && catRef.includes('>')) { const [a, b] = catRef.split('>'); catRef = a.trim(); subRef = (b || '').trim(); }
      const top = findCat(catRef);
      if (!top) return fail(`category "${catRef}" not found - create it first under Categories`);
      let leaf: any = top;
      if (subRef) {
        leaf = findCat(subRef, top.id);
        if (!leaf) return fail(`subcategory "${subRef}" not found under "${top.name}"`);
      }
      const parent: any = leaf.parentId ? byId.get(leaf.parentId) : null;

      let slug = slugify(name) || slugify(sku) || 'product';
      if (slugs.has(slug)) slug = `${slug}-${slugify(sku)}`;
      slugs.add(slug); skus.add(lc(sku));

      const img = get(row, 'image');
      ready.push(defined({
        name, nameAr: get(row, 'namear') || undefined, slug,
        description: get(row, 'description') || name, descriptionAr: get(row, 'descriptionar') || undefined,
        shortDescription: get(row, 'shortdescription') || '', shortDescriptionAr: get(row, 'shortdescriptionar') || undefined,
        sku, barcode: get(row, 'barcode') || '',
        price, comparePrice: num(get(row, 'compareprice')), costPrice: num(get(row, 'costprice')),
        stock: Math.round(stock), lowStockAlert: Math.round(num(get(row, 'lowstockalert')) ?? 5),
        weight: num(get(row, 'weight')),
        categoryId: leaf.id, categoryName: leaf.name || '', categoryNameAr: leaf.nameAr || undefined,
        categoryPath: parent ? [parent.id, leaf.id] : [leaf.id],
        brand: get(row, 'brand'), images: img ? img.split(/[;|]/).map(s => s.trim()).filter(Boolean) : [],
        tags: get(row, 'tags') ? get(row, 'tags').split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [],
        isFeatured: bool(get(row, 'isfeatured'), false), isNewArrival: bool(get(row, 'isnewarrival'), false),
        isOnSale: bool(get(row, 'isonsale'), false), isActive: bool(get(row, 'isactive'), true),
        freeShipping: bool(get(row, 'freeshipping'), false),
        isReturnable: bool(get(row, 'isreturnable'), true), returnDays: Math.round(num(get(row, 'returndays')) ?? 14),
        metaTitle: get(row, 'metatitle') || name, metaDesc: get(row, 'metadesc') || get(row, 'description') || '',
        avgRating: 0, totalReviews: 0, totalSold: 0, totalRevenue: 0,
      }));
    });

    for (let i = 0; i < ready.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const p of ready.slice(i, i + BATCH_SIZE)) {
        batch.set(db.collection('products').doc(), { ...p, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        created++;
      }
      await batch.commit();
    }
    if (created) invalidateProductCache();

    return NextResponse.json({ success: true, created, skipped, errors: errors.slice(0, 50), moreErrors: Math.max(0, errors.length - 50) });
  } catch (err) {
    console.error('Bulk import error:', err);
    return NextResponse.json({ error: 'Import failed. Check your CSV format and try again.' }, { status: 500 });
  }
}
