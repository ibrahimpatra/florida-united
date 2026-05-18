import { NextRequest, NextResponse } from 'next/server';
import { adminValidateCoupon } from '@/lib/firestore-admin';

export async function POST(req: NextRequest) {
  try {
    const { code, orderAmount } = await req.json();
    return NextResponse.json(await adminValidateCoupon(code, orderAmount));
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
