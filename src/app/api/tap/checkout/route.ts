// src/app/api/tap/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SITE_CONFIG } from '@/lib/siteConfig';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { total, orderId, orderNumber, shippingAddress } = await req.json();

    const tapPayload = {
      amount: parseFloat(total.toFixed(3)),
      currency: 'KWD',
      threeDSecure: true,
      save_card: false,
      description: `${SITE_CONFIG.fullName} - Order ${orderNumber}`,
      statement_descriptor: 'FLORIDA UNITED KW',
      metadata: { orderId, orderNumber, userId: session.user.id },
      reference: { transaction: orderNumber, order: orderId },
      receipt: { email: true, sms: true },
      customer: {
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        email: session.user.email,
        phone: {
          country_code: '965',
          number: (shippingAddress.phone || '').replace(/\D/g, '').replace(/^965/, ''),
        },
      },
      merchant: { id: process.env.TAP_MERCHANT_ID },
      source: { id: 'src_all' },
      post: { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tap/webhook` },
      redirect: { url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?orderId=${orderId}` },
    };

    const tapRes = await fetch('https://api.tap.company/v2/charges', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tapPayload),
    });

    const tapData = await tapRes.json();
    if (!tapRes.ok) {
      console.error('TAP error:', tapData);
      return NextResponse.json({ error: tapData.message || 'TAP payment failed' }, { status: 400 });
    }

    return NextResponse.json({
      chargeId: tapData.id,
      redirectUrl: tapData.transaction?.url || tapData.redirect?.url,
      status: tapData.status,
    });
  } catch (err) {
    console.error('TAP checkout error:', err);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
