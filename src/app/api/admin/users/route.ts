import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetAllUsers } from '@/lib/firestore-admin';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sp   = new URL(req.url).searchParams;
    const page = parseInt(sp.get('page') || '1');
    const search = sp.get('search') || undefined;
    const role   = sp.get('role')   || undefined;
    return NextResponse.json(await adminGetAllUsers({ page, search, role }));
  } catch (err) {
    console.error('[GET /api/admin/users]', err);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
