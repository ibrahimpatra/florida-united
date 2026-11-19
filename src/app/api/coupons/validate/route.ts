import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminValidateCoupon } from '@/lib/firestore-admin';

async function __POST(req: NextRequest) {
  try {
    const { code, orderAmount } = await req.json();
    const session = await getServerSession(authOptions);
    return NextResponse.json(await adminValidateCoupon(code, orderAmount, session?.user?.id));
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export const POST = withLog('POST', '/api/coupons/validate', __POST);
