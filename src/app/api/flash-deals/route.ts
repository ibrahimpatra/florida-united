import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetAllFlashDeals, adminGetActiveFlashDeals, adminCreateFlashDeal } from '@/lib/shipping-admin';

export async function GET(req: NextRequest) {
  try {
    const admin = new URL(req.url).searchParams.get('admin') === 'true';
    const session = await getServerSession(authOptions);
    const deals = (admin && session?.user.role === 'admin') ? await adminGetAllFlashDeals() : await adminGetActiveFlashDeals();
    return NextResponse.json(deals);
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const id = await adminCreateFlashDeal(await req.json());
    return NextResponse.json({ success: true, id });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
