import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminSaveAddress, adminDeleteAddress } from '@/lib/firestore-admin';

async function __PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    await adminSaveAddress(session.user.id, { ...body, id: params.id });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
  }
}

async function __DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminDeleteAddress(session.user.id, params.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}

export const PUT = withLog('PUT', '/api/account/addresses/[id]', __PUT);
export const DELETE = withLog('DELETE', '/api/account/addresses/[id]', __DELETE);
