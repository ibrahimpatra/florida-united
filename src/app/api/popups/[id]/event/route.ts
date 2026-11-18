import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { popupEvent } from '@/lib/popups';

export const dynamic = 'force-dynamic';

/** Anonymous view/click counter for the admin's numbers. Best effort: errors are swallowed. */
async function __POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { type } = await req.json().catch(() => ({}));
  if (type === 'view' || type === 'click') { try { await popupEvent(params.id, type); } catch {} }
  return NextResponse.json({ ok: true });
}
export const POST = withLog('POST', '/api/popups/[id]/event', __POST);
