import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { quoteShipping, OrderError } from '@/lib/orders-server';

export const dynamic = 'force-dynamic';

/** Body: { governorate, couponCode?, items: [{ productId, quantity, variantId?, variantName? }] }  — prices/flags are read server-side. */
async function __POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await getServerSession(authOptions);
    const q = await quoteShipping(Array.isArray(body.items) ? body.items : [], body.governorate, session?.user?.id, typeof body.couponCode === 'string' ? body.couponCode : undefined);
    const { lines, ...rest } = q;
    // slim per-line prices so checkout can show the offer price and the struck-through list price
    const slim = lines.map((l: any) => ({ productId: l.productId, variantId: l.variantId, price: l.price, listPrice: l.listPrice ?? l.price, total: l.total, dealTitle: l.dealTitle, dealTitleAr: l.dealTitleAr }));
    return NextResponse.json({ ...rest, lines: slim });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error('[POST /api/shipping/calculate]', e);
    return NextResponse.json({ error: 'Could not calculate delivery charges.' }, { status: 500 });
  }
}

export const POST = withLog('POST', '/api/shipping/calculate', __POST);
