import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { items, shippingAddress, couponCode, discount, tax, shippingCost } = await req.json();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: {
      name: string; image?: string; price: number; quantity: number; variantName?: string;
    }) => ({
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.name + (item.variantName ? ` - ${item.variantName}` : ''),
          images: item.image ? [item.image] : [],
        },
      },
      quantity: item.quantity,
    }));

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card', 'us_bank_account'],
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ['US'] },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
      customer_email: session.user.email!,
      metadata: {
        userId: session.user.id,
        couponCode: couponCode || '',
      },
      allow_promotion_codes: true,
    };

    // Add shipping as line item if applicable
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(shippingCost * 100),
          product_data: { name: 'Shipping & Handling' },
        },
        quantity: 1,
      });
    }

    // Tax
    if (tax > 0) {
      sessionParams.automatic_tax = { enabled: false };
    }

    // Apply discount as coupon
    if (discount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(discount * 100),
        currency: 'usd',
        name: couponCode || 'Discount',
        duration: 'once',
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (err) {
    console.error('Stripe error:', err);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
