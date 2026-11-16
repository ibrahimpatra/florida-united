import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { quoteShipping, OrderError } from '@/lib/orders-server';

export const dynamic = 'force-dynamic';

/** Body: { governorate, couponCode?, items: [{ productId, quantity, variantId?, variantName? }] }  — prices/flags are read server-side. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await getServerSession(authOptions);
    const q = await quoteShipping(Array.isArray(body.items) ? body.items : [], body.governorate, session?.user?.id, typeof body.couponCode === 'string' ? body.couponCode : undefined);
    const { lines, ...rest } = q;
    return NextResponse.json(rest);
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error('[POST /api/shipping/calculate]', e);
    return NextResponse.json({ error: 'Could not calculate delivery charges.' }, { status: 500 });
  }
}
