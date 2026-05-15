import { NextRequest, NextResponse } from 'next/server';
import { adminSearchProducts } from '@/lib/firestore-admin';

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') || '';
  try {
    return NextResponse.json(await adminSearchProducts(q, 10));
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
