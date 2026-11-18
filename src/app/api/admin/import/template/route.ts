import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildTemplateXlsx } from '@/lib/import-file';
import { TEMPLATE_ROWS } from '@/lib/product-import';

export const dynamic = 'force-dynamic';

async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const buf = await buildTemplateXlsx(TEMPLATE_ROWS);
  return new NextResponse(new Uint8Array(buf), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="product-import-template.xlsx"',
  } });
}
export const GET = withLog('GET', '/api/admin/import/template', __GET);
