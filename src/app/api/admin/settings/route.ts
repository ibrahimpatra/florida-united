import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

const SETTINGS_PATH = 'config/storeSettings';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const snap = await db.doc(SETTINGS_PATH).get();
    return NextResponse.json(snap.exists ? snap.data() : {});
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const db = getAdminDb();
    await db.doc(SETTINGS_PATH).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
