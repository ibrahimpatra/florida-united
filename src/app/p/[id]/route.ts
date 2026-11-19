import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Short link to a product from anywhere that only knows its id (order lines, returns, admin tables).
 *   /p/<productId>  ->  /shop/products/<slug>      /p/bundle:<id>  ->  /bundles      (gone -> /shop)
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id || '');
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url), 307);
  if (id.startsWith('bundle:')) return to('/bundles');
  try {
    const snap = await getAdminDb().collection('products').doc(id).get();
    const slug = (snap.data() as any)?.slug;
    if (snap.exists && slug) return to(`/shop/products/${encodeURIComponent(slug)}`);
  } catch { /* fall through */ }
  return to('/shop');
}
