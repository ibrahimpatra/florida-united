import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { loadShippingSettings } from '@/lib/orders-server';
import { computeShipping, type PricedLine } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

/** Admin-only "what would checkout charge?" using the SAME pure function as real orders. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await req.json();
    const paid = Math.max(0, Number(b.paidSubtotal) || 0), free = Math.max(0, Number(b.freeSubtotal) || 0);
    if (paid + free <= 0) return NextResponse.json({ error: 'Enter a cart amount greater than 0.' }, { status: 400 });
    const line = (total: number, freeShipping: boolean, id: string): PricedLine => ({
      productId: id, name: id, sku: '', price: total, quantity: 1, total, freeShipping, isReturnable: true,
    });
    const lines = [...(paid > 0 ? [line(paid, false, 'paid-shipping item')] : []), ...(free > 0 ? [line(free, true, 'free-shipping item')] : [])];
    const { zones, settings } = await loadShippingSettings(getAdminDb());
    return NextResponse.json(computeShipping({ governorate: b.governorate, lines, zones, settings }));
  } catch (e) {
    console.error('[shipping/test]', e);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}
