import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetProducts, searchBundles, adminCreateProduct, ProductError } from '@/lib/firestore-admin';
import { adminGetActiveFlashDeals } from '@/lib/shipping-admin';
import { dealIsLive, dealCoversProduct } from '@/lib/pricing';
import type { ProductFilters } from '@/types';

async function __GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // admin=true exposes inactive/draft products → only honour it for a real admin session.
    let isAdmin = false;
    if (searchParams.get('admin') === 'true') {
      const session = await getServerSession(authOptions);
      isAdmin = session?.user?.role === 'admin';
    }
    const stock = searchParams.get('stock');
    const filters: ProductFilters & { admin?: boolean } = {
      categoryId:   searchParams.get('categoryId')  || undefined,
      categorySlug: searchParams.get('categorySlug')|| undefined,
      minPrice:     searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice:     searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      brand:        searchParams.get('brand')        || undefined,
      inStock:      searchParams.get('inStock')     === 'true',
      stockStatus:  stock === 'out' || stock === 'low' ? stock : undefined,
      isFeatured:   searchParams.get('featured')    === 'true' ? true : undefined,
      isNewArrival: searchParams.get('new')         === 'true' ? true : undefined,
      isOnSale:     searchParams.get('sale')        === 'true' ? true : undefined,
      search:       searchParams.get('q')            || undefined,
      sortBy:       (searchParams.get('sort') as ProductFilters['sortBy']) || 'newest',
      page:         parseInt(searchParams.get('page')  || '1'),
      pageSize:     parseInt(searchParams.get('limit') || '24'),
      admin:        isAdmin,
    };
    let result: any;
    const onlyDeal = searchParams.get('deal');
    if ((searchParams.get('sale') === 'true' || onlyDeal) && !isAdmin) {
      // "On sale" = marked on sale OR covered by a deal that is running right now
      let deals = (await adminGetActiveFlashDeals().catch(() => [])).filter((d: any) => dealIsLive(d));
      if (onlyDeal) deals = deals.filter((d: any) => d.id === onlyDeal);   // /deals?deal=ID: only what that offer covers (nothing once it has ended)
      const page = filters.page || 1, size = filters.pageSize || 24;
      const all: any = await adminGetProducts({ ...filters, isOnSale: undefined, page: 1, pageSize: 5000 } as any);
      const hit = all.items.filter((p: any) => (!onlyDeal && p.isOnSale) || deals.some((d: any) => dealCoversProduct(d, p.id, p.categoryId)));
      result = { items: hit.slice((page - 1) * size, page * size), total: hit.length, page, pageSize: size, hasMore: page * size < hit.length };
    } else result = await adminGetProducts(filters as any);
    // searching also finds bundles (public: active bundles only)
    if (filters.search && !isAdmin && (filters.page || 1) === 1) {
      const found = await searchBundles(filters.search, 6).catch(() => []);
      result = { ...result, bundles: found.map((b: any) => ({ id: b.id, name: b.name, nameAr: b.nameAr, image: b.image || b.items?.[0]?.image || '', price: Number(b.bundlePrice), comparePrice: b.comparePrice || undefined, itemCount: (b.items || []).length })) };
    }
    return NextResponse.json(result, {
      headers: { 'Cache-Control': isAdmin ? 'no-store' : 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('[GET /api/products]', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    const id = await adminCreateProduct(data);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    if (err instanceof ProductError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[POST /api/products]', err);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/products', __GET);
export const POST = withLog('POST', '/api/products', __POST);
