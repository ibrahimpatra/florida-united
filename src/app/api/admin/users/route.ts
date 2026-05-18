import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetAllUsers } from '@/lib/firestore-admin';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const page = parseInt(new URL(req.url).searchParams.get('page') || '1');
    return NextResponse.json(await adminGetAllUsers(page));
  } catch (err) {
    console.error('[GET /api/admin/users]', err);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
