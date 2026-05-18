import { NextRequest, NextResponse } from 'next/server';
import { adminCalculateShipping } from '@/lib/shipping-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await adminCalculateShipping({
      governorate: body.governorate || body.state,
      area: body.area,
      country: body.country || 'Kuwait',
      orderAmount: body.orderAmount,
      orderWeightKg: body.orderWeightKg,
      paymentMethod: body.paymentMethod,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to calculate shipping' }, { status: 500 });
  }
}
