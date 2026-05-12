// src/app/api/orders/returns/route.ts — Smart auto-eligibility returns
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createReturnRequest, getUserReturns, getAllReturns, updateReturnStatus, getOrderById } from '@/lib/firestore';
import { sendReturnRequestEmail } from '@/lib/email';

const RETURN_WINDOW_DAYS = 14;

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role === 'admin') {
    const returns = await getAllReturns();
    return NextResponse.json({ items: returns });
  }
  const returns = await getUserReturns(session.user.id);
  return NextResponse.json({ items: returns });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId, reason, description, images, selectedProductIds } = await req.json();

  const order = await getOrderById(orderId);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Auto-eligibility checks
  if (order.status !== 'delivered') {
    return NextResponse.json({ error: 'Returns can only be requested after delivery', eligible: false }, { status: 400 });
  }

  const daysSinceDelivery = order.deliveredAt ? daysSince(order.deliveredAt) : 0;
  if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
    return NextResponse.json({ error: `Return window expired. Must be within ${RETURN_WINDOW_DAYS} days of delivery.`, eligible: false }, { status: 400 });
  }

  const returnableItems = order.items.filter(i => i.isReturnable);
  if (returnableItems.length === 0) {
    return NextResponse.json({ error: 'No returnable items in this order', eligible: false }, { status: 400 });
  }

  // Calculate refund amount for selected items
  const selectedItems = selectedProductIds?.length > 0
    ? order.items.filter(i => selectedProductIds.includes(i.productId) && i.isReturnable)
    : returnableItems;

  const refundAmount = selectedItems.reduce((sum, i) => sum + i.total, 0);
  const isRefundable = refundAmount > 0;

  // Photos are required for auto-processing
  const hasPhoto = images && images.length > 0;
  const status = hasPhoto ? 'photo_submitted' : 'pending';
  // Auto-approve if photo provided and refund < KWD 5 (small amount, low risk)
  const autoApproved = hasPhoto && refundAmount <= 5;

  const returnId = await createReturnRequest({
    orderId,
    orderNumber: order.orderNumber,
    userId: session.user.id,
    reason,
    description,
    status: autoApproved ? 'approved' : status,
    isRefundable,
    refundAmount,
    images: images || [],
    photoVerified: hasPhoto,
    autoApproved,
    refundMethod: order.paymentMethod === 'cod' ? 'cash' : 'tap_refund',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  sendReturnRequestEmail(order.userEmail, order.userName, order.orderNumber, returnId, reason).catch(console.error);

  return NextResponse.json({
    success: true,
    returnId,
    autoApproved,
    refundAmount,
    message: autoApproved
      ? 'Return auto-approved! Refund will be processed within 3-5 business days.'
      : 'Return request submitted. Our team will review within 24 hours.',
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { returnId, status, refundAmount, adminNote, isRefundable, adminImages, photoVerified } = await req.json();
  await updateReturnStatus(returnId, status, refundAmount, adminNote, isRefundable);

  return NextResponse.json({ success: true });
}
