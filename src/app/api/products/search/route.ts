import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/firestore';
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') || '';
  const limit = parseInt(new URL(req.url).searchParams.get('limit') || '10');
  if (!q.trim()) return NextResponse.json([]);
  return NextResponse.json(await searchProducts(q, limit));
}
