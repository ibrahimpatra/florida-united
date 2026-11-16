import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, lang } = await req.json();
    const e = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e) || e.length > 200) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    const id = createHash('sha256').update(e).digest('hex').slice(0, 32);
    await getAdminDb().collection('newsletter').doc(id).set(
      { email: e, lang: lang === 'ar' ? 'ar' : 'en', subscribed: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('newsletter error', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
