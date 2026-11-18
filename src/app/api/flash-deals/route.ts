import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetAllFlashDeals, adminGetActiveFlashDeals, adminCreateFlashDeal } from '@/lib/shipping-admin';

async function __GET(req: NextRequest) {
  try {
    const admin = new URL(req.url).searchParams.get('admin') === 'true';
    const session = await getServerSession(authOptions);
    const deals = (admin && session?.user?.role === 'admin') ? await adminGetAllFlashDeals() : await adminGetActiveFlashDeals();
    return NextResponse.json(deals);
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await req.json();
    if (!String(b.title || '').trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    if (!(Number(b.discountValue) > 0) && b.type !== 'bogo' && b.type !== 'bundle') return NextResponse.json({ error: 'Discount value must be greater than 0.' }, { status: 400 });
    if (b.type === 'percentage' && Number(b.discountValue) > 100) return NextResponse.json({ error: 'A percentage discount cannot exceed 100.' }, { status: 400 });
    if (!b.startAt || !b.endAt || new Date(b.endAt) <= new Date(b.startAt)) return NextResponse.json({ error: 'The end time must be after the start time.' }, { status: 400 });
    const id = await adminCreateFlashDeal(b);
    return NextResponse.json({ success: true, id });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const GET = withLog('GET', '/api/flash-deals', __GET);
export const POST = withLog('POST', '/api/flash-deals', __POST);
