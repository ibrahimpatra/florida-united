import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
export async function GET() {
  try {
    const snap = await getDocs(query(collection(db,'banners'), orderBy('sortOrder','asc')));
    return NextResponse.json(snap.docs.map(d=>({ id:d.id, ...d.data() })));
  } catch { return NextResponse.json([]); }
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const data = await req.json();
  const ref = await addDoc(collection(db,'banners'), { ...data, createdAt: serverTimestamp() });
  return NextResponse.json({ success:true, id:ref.id });
}
