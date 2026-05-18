import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { getAdminDb } from '@/lib/firebase-admin';
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const { currentPassword, newPassword } = await req.json();
  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(session.user.id).get();
  if (!userDoc.exists) return NextResponse.json({ error:'User not found' }, { status:404 });
  const userData = userDoc.data()!;
  if (userData.password) {
    const valid = await bcrypt.compare(currentPassword, userData.password);
    if (!valid) return NextResponse.json({ error:'Current password is incorrect' }, { status:400 });
  }
  const hashed = await bcrypt.hash(newPassword, 12);
  await db.collection('users').doc(session.user.id).update({ password: hashed, updatedAt: new Date().toISOString() });
  return NextResponse.json({ success:true });
}
