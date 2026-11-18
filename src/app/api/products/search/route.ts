import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { adminSearchProducts } from '@/lib/firestore-admin';
import { withLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const slim = (p: any) => ({
  id: p.id, name: p.name, nameAr: p.nameAr || undefined, sku: p.sku, price: p.price, stock: p.stock,
  image: p.images?.[0] || undefined, categoryId: p.categoryId, categoryName: p.categoryName, isActive: p.isActive !== false,
});

/** Admin-only product finder used by the search selector. ?q=text (name, Arabic name, SKU) or ?ids=a,b,c to resolve saved ids. */
async function __GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  try {
    const ids = (sp.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 100);
    if (ids.length) {
      const db = getAdminDb();
      const snaps = await db.getAll(...ids.map(id => db.collection('products').doc(id)));
      return NextResponse.json(snaps.filter(s => s.exists).map(s => slim({ id: s.id, ...s.data() })));
    }
    const lim = Math.min(25, Math.max(1, Number(sp.get('limit')) || 12));
    return NextResponse.json((await adminSearchProducts(sp.get('q') || '', lim)).map(slim));
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const GET = withLog('GET', '/api/products/search', __GET);
