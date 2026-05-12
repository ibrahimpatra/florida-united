import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCategories, createCategory } from '@/lib/firestore';
export async function GET() {
  const cats = await getCategories(false);
  return NextResponse.json(cats);
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await req.json();
  const id = await createCategory(data);
  return NextResponse.json({ success: true, id });
}
