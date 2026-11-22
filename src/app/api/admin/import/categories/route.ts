import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { adminCreateCategory, adminUpdateCategory } from '@/lib/firestore-admin';
import { parseUpload, buildSheetXlsx } from '@/lib/import-file';
import { planCategoryImport, CATEGORY_TEMPLATE_ROWS, type CatCtx } from '@/lib/category-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const admin = async () => { const s = await getServerSession(authOptions); return s && String(s.user.role).toLowerCase() === 'admin'; };
const load = async (): Promise<CatCtx[]> => (await getAdminDb().collection('categories').get()).docs.map(d => ({ id: d.id, ...(d.data() as any) }));

/** GET = the Excel template. */
async function __GET() {
  if (!(await admin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const buf = await buildSheetXlsx(CATEGORY_TEMPLATE_ROWS, 'Categories');
  return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="category-import-template.xlsx"' } });
}

/** POST multipart: file, mode = preview | import. Returns the same plan shape as the product import so the page can show both. */
async function __POST(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const fd = await req.formData(); const file = fd.get('file') as File | null; const mode = String(fd.get('mode') || 'preview');
    if (!file) return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'File is larger than 4 MB.' }, { status: 400 });
    let rows: string[][];
    try { rows = await parseUpload(file.name, Buffer.from(await file.arrayBuffer())); } catch (e: any) { return NextResponse.json({ error: e?.message || 'Could not read that file.' }, { status: 400 }); }
    const existing = await load();
    const plan = planCategoryImport(rows, existing);
    if (plan.headerError) return NextResponse.json({ error: plan.headerError }, { status: 400 });
    const shaped = { ...plan, newCategories: [], newUoms: [], rows: plan.rows.map(r => ({ line: r.line, action: r.action, sku: r.parent || '(main category)', name: r.name, message: r.message, changes: r.changes })) };
    if (mode !== 'import') return NextResponse.json({ success: true, preview: true, plan: shaped });
    if (!plan.counts.create && !plan.counts.update) return NextResponse.json({ error: 'Nothing to import. Fix the rows marked as problems.', plan: shaped }, { status: 400 });

    // main categories first so sub-categories can find their parent
    const idByName = new Map<string, string>(existing.filter(c => !c.parentId).map(c => [c.name.toLowerCase(), c.id]));
    const ordered = [...plan.rows].filter(r => r.action !== 'error' && r.data).sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
    let created = 0, updated = 0; const errors: string[] = [];
    for (const r of ordered) {
      try {
        if (r.action === 'update') { if (r.changes?.length) { await adminUpdateCategory(r.id!, r.data as any); updated++; } continue; }
        const parentId = r.parent ? (r.parentId || idByName.get(r.parent.toLowerCase()) || '') : '';
        if (r.parent && !parentId) { errors.push(`Row ${r.line}: parent "${r.parent}" could not be found`); continue; }
        const id = await adminCreateCategory({ ...(r.data as any), ...(parentId ? { parentId } : {}) });
        if (!r.parent) idByName.set(r.name.toLowerCase(), id);
        created++;
      } catch (e: any) { errors.push(`Row ${r.line}: ${e?.message || 'failed'}`); }
    }
    return NextResponse.json({ success: true, created, updated, createdCategories: 0, createdUnits: 0, skipped: errors.length + plan.counts.error, errors: [...plan.rows.filter(r => r.action === 'error').map(r => `Row ${r.line}: ${r.message}`), ...errors].slice(0, 30) });
  } catch (e: any) { return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 }); }
}
export const GET = withLog('GET', '/api/admin/import/categories', __GET);
export const POST = withLog('POST', '/api/admin/import/categories', __POST);
