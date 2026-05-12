import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDashboardStats } from '@/lib/firestore';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await getDashboardStats()); }
  catch(e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
