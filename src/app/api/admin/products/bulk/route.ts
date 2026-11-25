import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminBulkProducts, ProductError } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/** POST { ids: string[], action: 'activate' | 'deactivate' | 'archive' | 'feature' | 'unfeature' | 'outOfStock' | 'delete' | 'category' | 'brand' | 'price' | 'stock', ...value } (admin only, up to 500 ids) */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { ids, ...action } = await req.json();
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids must be a list.' }, { status: 400 });
    return NextResponse.json({ success: true, ...(await adminBulkProducts(ids.map(String), action as any)) });
  } catch (e: any) {
    if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[POST /api/admin/products/bulk]', e);
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
  }
}
export const POST = withLog('POST', '/api/admin/products/bulk', __POST);
