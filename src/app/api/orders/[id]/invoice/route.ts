import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetOrderById } from '@/lib/firestore-admin';
import { buildInvoicePdf } from '@/lib/invoice-pdf';
import { log } from '@/lib/logger';
import { failJson } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function __GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const o: any = await adminGetOrderById(params.id);
    if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String(session.user.role).toLowerCase() !== 'admin' && o.userId !== session.user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const pdf = await buildInvoicePdf(o);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${String(o.orderNumber || 'order').replace(/[^A-Za-z0-9-]/g, '')}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    log.error('invoice', 'could not build the invoice PDF', { order: params.id, error: (e as any)?.message, stack: String((e as any)?.stack || '').split('\n').slice(0, 5) });
    return failJson(session, 500, 'Could not generate the invoice. Please try again in a moment.', e);
  }
}

export const GET = withLog('GET', '/api/orders/[id]/invoice', __GET);
