import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createOrder, getOrderById } from '@/lib/firestore';
import { sendOrderConfirmation, sendAdminNewOrderNotification } from '@/lib/email';
import { generateOrderNumber } from '@/lib/utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === 'paid') {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const metadata = session.metadata || {};

          const items = lineItems.data
            .filter(item => item.description !== 'Shipping & Handling')
            .map(item => ({
              productId: '',
              productName: item.description || '',
              productSku: '',
              price: (item.amount_total || 0) / 100 / (item.quantity || 1),
              quantity: item.quantity || 1,
              total: (item.amount_total || 0) / 100,
              isReturnable: true,
            }));

          const shippingItem = lineItems.data.find(i => i.description === 'Shipping & Handling');

          const order = {
            orderNumber: generateOrderNumber(),
            userId: metadata.userId,
            userEmail: session.customer_email || '',
            userName: session.shipping_details?.name || '',
            shippingAddress: {
              id: 'stripe',
              label: 'Shipping',
              firstName: session.shipping_details?.name?.split(' ')[0] || '',
              lastName: session.shipping_details?.name?.split(' ').slice(1).join(' ') || '',
              address1: session.shipping_details?.address?.line1 || '',
              address2: session.shipping_details?.address?.line2 || '',
              city: session.shipping_details?.address?.city || '',
              governorate: '',
              country: session.shipping_details?.address?.country || 'Kuwait',
              isDefault: false,
            },
            status: 'confirmed' as const,
            paymentStatus: 'paid' as const,
            paymentMethod: 'tap' as const,
            currency: 'KWD',
            stripePaymentId: session.payment_intent as string,
            stripeSessionId: session.id,
            items,
            subtotal: (session.amount_subtotal || 0) / 100,
            discount: (session.total_details?.amount_discount || 0) / 100,
            shippingCost: shippingItem ? (shippingItem.amount_total || 0) / 100 : 0,
            tax: (session.total_details?.amount_tax || 0) / 100,
            total: (session.amount_total || 0) / 100,
            couponCode: metadata.couponCode || undefined,
            notes: undefined,
            trackingNumber: undefined,
            shippingCarrier: undefined,
            statusHistory: [
              { status: 'pending' as const, note: 'Order placed', createdAt: new Date().toISOString() },
              { status: 'confirmed' as const, note: 'Payment confirmed via Stripe', createdAt: new Date().toISOString() },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const orderId = await createOrder(order);
          const fullOrder = { ...order, id: orderId };

          sendOrderConfirmation(fullOrder as any).catch(console.error);
          sendAdminNewOrderNotification(fullOrder as any).catch(console.error);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        console.log('Payment failed:', event.data.object);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
