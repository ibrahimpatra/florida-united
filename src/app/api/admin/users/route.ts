import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adminGetAllUsers } from '@/lib/firestore-admin';

async function __GET(req: NextRequest) {
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

export const GET = withLog('GET', '/api/admin/users', __GET);

/** PATCH { id, role: 'customer' | 'admin' | 'superadmin' } - super admin only. Cannot demote the last super admin. */
async function __PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { isSuperSession, ROLES, __resetRolesCache } = await import('@/lib/roles');
  if (!(await isSuperSession(session))) return NextResponse.json({ error: 'Only the super admin can change roles.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || ''), role = String(b.role || '');
  if (!id || !(ROLES as readonly string[]).includes(role)) return NextResponse.json({ error: 'Choose a valid user and role.' }, { status: 400 });
  const { getAdminDb } = await import('@/lib/firebase-admin');
  const db = getAdminDb();
  const ref = db.collection('users').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (snap.data()?.role === 'superadmin' && role !== 'superadmin') {
    const others = (await db.collection('users').where('role', '==', 'superadmin').get()).docs.filter((d: any) => d.id !== id);
    if (!others.length) return NextResponse.json({ error: 'There must be at least one super admin.' }, { status: 400 });
  }
  await ref.update({ role, updatedAt: new Date().toISOString() });
  __resetRolesCache();
  return NextResponse.json({ success: true, note: 'The person must sign out and in again for the new role to apply.' });
}
export const PATCH = withLog('PATCH', '/api/admin/users', __PATCH);
