import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { FieldValue } from 'firebase-admin/firestore';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { invalidateProductCache } from '@/lib/firestore-admin';
import { ensureBrands } from '@/lib/brands';
import { parseUpload } from '@/lib/import-file';
import { planImport, slugify, type ImportCtx } from '@/lib/product-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const BATCH_SIZE = 400;
const MAX_BYTES = 8 * 1024 * 1024;

async function loadCtx(db: FirebaseFirestore.Firestore): Promise<ImportCtx> {
  const [c, p, u] = await Promise.all([db.collection('categories').get(), db.collection('products').select('sku', 'slug', 'stock').get(), db.collection('uoms').get()]);
  return {
    categories: c.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
    products: p.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
    uoms: u.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
  };
}

/**
 * POST multipart: file (.xlsx / .csv), mode = "preview" | "import".
 * preview: nothing is written; returns what would happen for every row.
 * import : creates missing categories/units, then creates and updates products in batches.
 */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const mode = String(fd.get('mode') || 'preview');
    if (!file) return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is larger than 8 MB. Split it and import in parts.' }, { status: 400 });

    let rows: string[][];
    try { rows = await parseUpload(file.name, Buffer.from(await file.arrayBuffer())); }
    catch (e: any) { return NextResponse.json({ error: e?.message || 'Could not read that file.' }, { status: 400 }); }

    const db = getAdminDb();
    let ctx = await loadCtx(db);
    let plan = planImport(rows, { ...ctx, createMissing: true });
    if (plan.headerError) return NextResponse.json({ error: plan.headerError }, { status: 400 });

    if (mode !== 'import') return NextResponse.json({ success: true, preview: true, plan });
    if (!plan.counts.create && !plan.counts.update) return NextResponse.json({ error: 'Nothing to import. Fix the rows marked as errors and try again.', plan }, { status: 400 });

    // 1. create missing categories (parents first) and units
    const created = { categories: 0, uoms: 0 };
    const idByName = new Map<string, string>();
    for (const nc of plan.newCategories) {
      const parent = nc.parentName ? (idByName.get(nc.parentName.toLowerCase()) || ctx.categories.find(c => !c.parentId && c.name.toLowerCase() === nc.parentName!.toLowerCase())?.id) : undefined;
      const exists = ctx.categories.find(c => c.name.toLowerCase() === nc.name.toLowerCase() && (c.parentId || '') === (parent || ''));
      if (exists) { idByName.set(nc.name.toLowerCase(), exists.id); continue; }
      let slug = slugify(nc.name) || `category-${Date.now().toString(36)}`;
      if (ctx.categories.some(c => c.slug === slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const ref = await db.collection('categories').add({
        name: nc.name, slug, ...(parent ? { parentId: parent, parentName: nc.parentName } : {}),
        isActive: true, showOnHome: false, showOnNav: !parent, sortOrder: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      idByName.set(nc.name.toLowerCase(), ref.id); created.categories++;
      ctx.categories.push({ id: ref.id, name: nc.name, slug, parentId: parent });
    }
    for (const nu of plan.newUoms) {
      if (ctx.uoms.some(u => u.name.toLowerCase() === nu.name.toLowerCase())) continue;
      await db.collection('uoms').add({ name: nu.name, abbreviation: nu.abbreviation, isActive: true, createdAt: FieldValue.serverTimestamp() });
      created.uoms++;
    }

    // 2. plan again with everything in place (no more "pending" lookups), then write
    ctx = await loadCtx(db);
    plan = planImport(rows, { ...ctx, createMissing: false });
    let createdN = 0, updatedN = 0, i = 0;
    const work = plan.rows.filter(r => r.action !== 'error' && r.data && Object.keys(r.data).length);
    while (i < work.length) {
      const batch = db.batch();
      for (const r of work.slice(i, i + BATCH_SIZE)) {
        const data: Record<string, any> = Object.fromEntries(Object.entries(r.data!).filter(([k, v]) => v !== undefined && !k.startsWith('__')));
        if (r.action === 'create') { batch.set(db.collection('products').doc(), { ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); createdN++; }
        else { delete data.sku; delete data.slug; batch.update(db.collection('products').doc(r.id!), { ...data, updatedAt: FieldValue.serverTimestamp() }); updatedN++; }
      }
      await batch.commit();
      i += BATCH_SIZE;
    }
    invalidateProductCache();
    const newBrands = await ensureBrands(work.map(r => String((r.data as any)?.brand || ''))).catch(() => 0);
    const errors = plan.rows.filter(r => r.action === 'error');
    return NextResponse.json({ success: true, created: createdN, updated: updatedN, createdCategories: created.categories, createdUnits: created.uoms, createdBrands: newBrands,
      skipped: errors.length, errors: errors.slice(0, 100).map(e => `Row ${e.line}: ${e.message}`), moreErrors: Math.max(0, errors.length - 100) });
  } catch (err: any) {
    console.error('Bulk import error:', err);
    return NextResponse.json({ error: 'Import failed. Please check the file and try again.' }, { status: 500 });
  }
}

export const POST = withLog('POST', '/api/admin/import', __POST);
