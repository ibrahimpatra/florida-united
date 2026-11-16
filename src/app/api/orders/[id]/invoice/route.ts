import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetOrderById } from '@/lib/firestore-admin';
import { buildInvoicePdf } from '@/lib/invoice-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
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
    console.error('[invoice]', e);
    return NextResponse.json({ error: 'Could not generate invoice' }, { status: 500 });
  }
}
