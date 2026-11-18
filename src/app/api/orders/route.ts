import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { adminGetAllOrders } from '@/lib/firestore-admin';
import { placeOrderHandler } from '@/lib/place-order-handler';

export const dynamic = 'force-dynamic';

const convert = (v: unknown): unknown =>
  v && typeof v === 'object' && 'toDate' in (v as object) ? (v as { toDate: () => Date }).toDate().toISOString()
  : Array.isArray(v) ? v.map(convert)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, convert(x)]))
  : v;

async function __GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sp = new URL(req.url).searchParams;
    // Everyone (admins included) gets ONLY their own orders by default. The all-orders list needs ?scope=all AND the admin role.
    if (sp.get('scope') === 'all' && String(session.user.role).toLowerCase() === 'admin') {
      return NextResponse.json(await adminGetAllOrders({
        status: sp.get('status') || 'all', page: parseInt(sp.get('page') || '1'), search: sp.get('q') || undefined,
      }));
    }
    // Customer: single-field query (no composite index needed) → sort in memory.
    const snap = await getAdminDb().collection('orders').where('userId', '==', session.user.id).limit(500).get();
    const items = snap.docs.map(d => ({ id: d.id, ...(convert(d.data()) as Record<string, unknown>) }))
      .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[GET /api/orders]', err);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// Legacy endpoint kept for compatibility; now uses the same atomic, server-priced engine.
async function __POST(req: NextRequest) { return placeOrderHandler(req); }

export const GET = withLog('GET', '/api/orders', __GET);
export const POST = withLog('POST', '/api/orders', __POST);
