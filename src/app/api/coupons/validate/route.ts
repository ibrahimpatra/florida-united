import { NextRequest, NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/firestore';

export async function POST(req: NextRequest) {
  const { code, orderAmount } = await req.json();
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });
  const result = await validateCoupon(code, orderAmount);
  return NextResponse.json(result);
}
