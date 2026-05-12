import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateUser } from '@/lib/firestore';
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const { name, phone } = await req.json();
  await updateUser(session.user.id, { displayName: name, phone });
  return NextResponse.json({ success:true });
}
