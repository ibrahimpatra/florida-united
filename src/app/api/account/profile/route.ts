import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const snap = await getAdminDb().collection('users').doc(session.user.id).get();
  const d = (snap.data() || {}) as any;
  return NextResponse.json({ name: d.name || session.user.name || '', phone: d.phone || '' });
}

/** Customers may change ONLY their name and phone. Never pass the request body through (role, email, etc.). */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const update: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Name must be 2-80 characters.' }, { status: 400 });
      update.name = name;
    }
    if (typeof body.phone === 'string') {
      const phone = body.phone.trim();
      if (phone && !/^[+\d][\d\s-]{5,19}$/.test(phone)) return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 });
      update.phone = phone;
    }
    await getAdminDb().collection('users').doc(session.user.id).update(update);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('profile update', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
