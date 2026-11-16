import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetUserAddresses, adminSaveAddress } from '@/lib/firestore-admin';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const addresses = await adminGetUserAddresses(session.user.id);
    return NextResponse.json(addresses);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load addresses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const id = await adminSaveAddress(session.user.id, body);
    return NextResponse.json({ success: true, id });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save address' }, { status: 500 });
  }
}
