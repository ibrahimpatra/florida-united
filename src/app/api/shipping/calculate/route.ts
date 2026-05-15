// src/app/api/shipping/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calculateShipping } from '@/lib/shippingService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept governorate (Kuwait) or legacy zipcode/state fields
    const result = await calculateShipping({
      governorate: body.governorate || body.state,
      area: body.area,
      country: body.country || 'Kuwait',
      lat: body.lat,
      lng: body.lng,
      orderAmount: body.orderAmount,
      orderWeightKg: body.orderWeightKg,
      paymentMethod: body.paymentMethod,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('Shipping calc error:', e);
    return NextResponse.json({ error: 'Failed to calculate shipping' }, { status: 500 });
  }
}
