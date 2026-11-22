import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { aiConfigured, explainAi } from '@/lib/ai';
import { parseUpload, buildSheetXlsx } from '@/lib/import-file';
import { assistSheet, type AssistKind } from '@/lib/import-assist';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST multipart: file (.xlsx / .csv), kind = products | categories | brands.
 * Returns a completed .xlsx (blank cells written by AI; yours untouched) with headers X-Assist-Filled / X-Assist-Done / X-Assist-Left.
 * Nothing is saved to the shop: the person checks the sheet and imports it with the normal preview.
 */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: 'The assistant needs GEMINI_API_KEY or OPENAI_API_KEY in the server environment.' }, { status: 503 });
  const deadline = Date.now() + 52_000;
  try {
    const fd = await req.formData(); const file = fd.get('file') as File | null; const kk = String(fd.get('kind')); const kind: AssistKind = kk === 'categories' ? 'categories' : kk === 'brands' ? 'brands' : 'products';
    if (!file) return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'File is larger than 4 MB. Split it and complete it in parts.' }, { status: 400 });
    let rows: string[][];
    try { rows = await parseUpload(file.name, Buffer.from(await file.arrayBuffer())); } catch (e: any) { return NextResponse.json({ error: e?.message || 'Could not read that file.' }, { status: 400 }); }
    if (rows.length < 2) return NextResponse.json({ error: 'No data rows found. The first row must be the column names.' }, { status: 400 });
    if (rows.length > 301) return NextResponse.json({ error: 'The assistant completes up to 300 rows at a time. Split the file.' }, { status: 400 });
    const cats = (await getAdminDb().collection('categories').get()).docs.map(d => d.data() as any);
    const r = await assistSheet(rows, kind, { deadline, categories: cats.map(c => ({ name: c.name, parentName: c.parentName })) });
    if (!r.filledCells && r.error) return NextResponse.json({ error: explainAi(new Error(r.error)) }, { status: 502 });
    const buf = await buildSheetXlsx(r.rows, kind === 'products' ? 'Products' : kind === 'brands' ? 'Brands' : 'Categories');
    return new NextResponse(new Uint8Array(buf), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="completed-sheet.xlsx"',
      'X-Assist-Filled': String(r.filledCells), 'X-Assist-Done': String(r.rowsDone), 'X-Assist-Total': String(r.rowsTotal), 'X-Assist-Left': String(r.rowsLeft),
      'Access-Control-Expose-Headers': 'X-Assist-Filled, X-Assist-Done, X-Assist-Total, X-Assist-Left',
    } });
  } catch (e: any) { return NextResponse.json({ error: explainAi(e) }, { status: 502 }); }
}
export const POST = withLog('POST', '/api/admin/import/assist', __POST);
