import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProductReviews, addReview } from '@/lib/firestore';
export async function GET(req: NextRequest) {
  const pid = new URL(req.url).searchParams.get('productId');
  if (!pid) return NextResponse.json({ error: 'productId required' }, { status: 400 });
  return NextResponse.json(await getProductReviews(pid));
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { productId, rating, title, comment, images } = await req.json();
  const id = await addReview({ productId, userId: session.user.id, userName: session.user.name!, rating, title, comment, images: images||[], isVerified: false, isApproved: true, createdAt: new Date().toISOString() });
  return NextResponse.json({ success: true, id });
}
