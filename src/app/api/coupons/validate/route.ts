import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminValidateCoupon } from '@/lib/firestore-admin';

async function __POST(req: NextRequest) {
  try {
    const { code, orderAmount, items } = await req.json();
    const session = await getServerSession(authOptions);
    return NextResponse.json(await adminValidateCoupon(code, orderAmount, session?.user?.id, Array.isArray(items) ? items.map((i: any) => ({ productId: String(i.productId), quantity: Number(i.quantity) || 1, variantId: i.variantId, variantName: i.variantName })) : undefined));
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const POST = withLog('POST', '/api/coupons/validate', __POST);
