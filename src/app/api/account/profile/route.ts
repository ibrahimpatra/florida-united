import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminUpdateUser } from '@/lib/firestore-admin';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await adminUpdateUser(session.user.id, await req.json());
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
