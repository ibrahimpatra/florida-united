import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProducts, createProduct } from '@/lib/firestore';
import type { ProductFilters } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const filters: ProductFilters = {
      categoryId: searchParams.get('categoryId') || undefined,
      categorySlug: searchParams.get('categorySlug') || undefined,
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      brand: searchParams.get('brand') || undefined,
      inStock: searchParams.get('inStock') === 'true',
      isFeatured: searchParams.get('featured') === 'true' ? true : undefined,
      isNewArrival: searchParams.get('new') === 'true' ? true : undefined,
      isOnSale: searchParams.get('sale') === 'true' ? true : undefined,
      search: searchParams.get('q') || undefined,
      sortBy: (searchParams.get('sort') as ProductFilters['sortBy']) || 'newest',
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('limit') || '24'),
    };

    const result = await getProducts(filters);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const id = await createProduct(data);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
