import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetProducts, adminCreateProduct, ProductError } from '@/lib/firestore-admin';
import type { ProductFilters } from '@/types';

export async function GET(req: NextRequest) {
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
    const result = await adminGetProducts(filters as any);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': isAdmin ? 'no-store' : 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('[GET /api/products]', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
