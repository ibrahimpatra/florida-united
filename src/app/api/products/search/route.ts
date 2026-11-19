import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { adminSearchProducts, searchBundles } from '@/lib/firestore-admin';
import { withLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const slim = (p: any) => ({
  id: p.id, name: p.name, nameAr: p.nameAr || undefined, sku: p.sku, price: p.price, stock: p.stock,
  image: p.images?.[0] || undefined, categoryId: p.categoryId, categoryName: p.categoryName, isActive: p.isActive !== false,
});

const slimBundle = (b: any) => ({
  id: `bundle:${b.id}`, name: b.name, nameAr: b.nameAr || undefined, sku: 'Bundle', price: Number(b.bundlePrice) || 0, stock: undefined,
  image: b.image || b.items?.[0]?.image || undefined, isBundle: true, isActive: b.isActive !== false,
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
      const pIds = ids.filter(i => !i.startsWith('bundle:')), bIds = ids.filter(i => i.startsWith('bundle:')).map(i => i.slice(7));
      const snaps = pIds.length ? await db.getAll(...pIds.map(id => db.collection('products').doc(id))) : [];
      const bSnaps = bIds.length ? await db.getAll(...bIds.map(id => db.collection('bundles').doc(id))) : [];
      return NextResponse.json([...snaps.filter(s => s.exists).map(s => slim({ id: s.id, ...s.data() })), ...bSnaps.filter(s => s.exists).map(s => slimBundle({ id: s.id, ...s.data() }))]);
    }
    const lim = Math.min(25, Math.max(1, Number(sp.get('limit')) || 12));
    const q = sp.get('q') || '';
    const withBundles = sp.get('bundles') === '1';
    const [prods, bundles] = await Promise.all([adminSearchProducts(q, lim), withBundles ? searchBundles(q || ' ', lim, true) : Promise.resolve([])]);
    // an empty search box lists the newest bundles too
    const bl = withBundles && !q.trim() ? (await import('@/lib/firestore-admin').then(m => m.adminGetBundles(false))).slice(0, 6) : bundles;
    return NextResponse.json([...bl.map(slimBundle), ...prods.map(slim)]);
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const GET = withLog('GET', '/api/products/search', __GET);
