import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

async function __POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (typeof token !== 'string' || token.length < 32) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) return NextResponse.json({ error: 'SHORT' }, { status: 400 });
    const db = getAdminDb();
    const ref = db.collection('passwordResets').doc(sha(token));
    const hashed = await bcrypt.hash(password, 12);
    // Single-use: claim the token inside a transaction so two requests cannot both succeed.
    const userId = await db.runTransaction(async tx => {
      const s = await tx.get(ref); const d: any = s.data();
      if (!s.exists || d.used || Number(d.expiresMs) < Date.now()) return null;
      tx.update(ref, { used: true, usedAt: FieldValue.serverTimestamp() });
      tx.update(db.collection('users').doc(d.userId), { password: hashed, updatedAt: new Date().toISOString() });
      return d.userId as string;
    });
    if (!userId) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
    try { await getAdminAuth().updateUser(userId, { password }); } catch (e) { console.error('[reset] auth sync', e); }
    return NextResponse.json({ ok: true });
  } catch (e) { console.error('[reset]', e); return NextResponse.json({ error: 'FAIL' }, { status: 500 }); }
}

export const POST = withLog('POST', '/api/auth/reset', __POST);
