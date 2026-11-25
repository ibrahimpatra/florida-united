import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetProducts } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/** Small list for the bulk photo page: id, SKU, name and current pictures of every product. Served from the shared product list (no extra reads). */
async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r: any = await adminGetProducts({ admin: true, pageSize: 5000, sortBy: 'name_asc' });
  return NextResponse.json(r.items.map((p: any) => ({ id: p.id, sku: p.sku || '', name: p.name || '', images: Array.isArray(p.images) ? p.images : [] })), { headers: { 'Cache-Control': 'no-store' } });
}
export const GET = withLog('GET', '/api/admin/products/skus', __GET);
