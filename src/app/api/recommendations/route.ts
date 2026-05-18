import { NextRequest, NextResponse } from 'next/server';
import { adminGetProductById, adminGetProducts } from '@/lib/firestore-admin';

export async function GET(req: NextRequest) {
  const productId = new URL(req.url).searchParams.get('productId');
  try {
    if (productId) {
      const product = await adminGetProductById(productId);
      if (!product) return NextResponse.json([]);
      const related = await adminGetProducts({ categoryId: product.categoryId, pageSize: 8 });
      return NextResponse.json(related.items.filter(p => p.id !== productId).slice(0, 6));
    }
    const featured = await adminGetProducts({ isFeatured: true, pageSize: 8 });
    return NextResponse.json(featured.items);
  } catch (e) { return NextResponse.json([]); }
}
