import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetProductReviews, adminAddReview } from '@/lib/firestore-admin';

export async function GET(req: NextRequest) {
  const productId = new URL(req.url).searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
  try {
    return NextResponse.json(await adminGetProductReviews(productId));
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    const id = await adminAddReview({ ...data, userId: session.user.id, userName: session.user.name!, isApproved: true, createdAt: new Date().toISOString() });
    return NextResponse.json({ success: true, id });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
