import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
export async function GET() {
  try {
    const snap = await getDocs(query(collection(db,'coupons'), orderBy('createdAt','desc')));
    const items = snap.docs.map(d=>{
      const data=d.data();
      return { id:d.id, ...data, createdAt:data.createdAt?.toDate?.()?.toISOString()||data.createdAt };
    });
    return NextResponse.json(items);
  } catch { return NextResponse.json([]); }
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await req.json();
  const ref = await addDoc(collection(db,'coupons'), { ...data, usedCount:0, createdAt: serverTimestamp() });
  return NextResponse.json({ success:true, id:ref.id });
}
