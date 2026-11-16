import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendPasswordResetEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Always answers "ok", whether or not the email exists, so this cannot be used to find out who has an account.
 * Only the SHA-256 of the token is stored; the real token only ever exists in the email.
 */
export async function POST(req: NextRequest) {
  const ok = NextResponse.json({ ok: true });
  try {
    const { email } = await req.json();
    const addr = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return ok;
    const db = getAdminDb();
    const u = await db.collection('users').where('email', '==', addr).limit(1).get();
    if (u.empty) return ok;
    const user = u.docs[0];
    if (!(user.data() as any).password) return ok; // Google-only account: nothing to reset

    // One link per minute per account.
    const recent = await db.collection('passwordResets').where('userId', '==', user.id).get();
    const now = Date.now();
    if (recent.docs.some(d => now - Number((d.data() as any).createdMs || 0) < 60_000)) return ok;
    recent.docs.forEach(d => { if (now - Number((d.data() as any).createdMs || 0) > 86_400_000) d.ref.delete().catch(() => {}); });

    const token = randomBytes(32).toString('hex');
    await db.collection('passwordResets').doc(sha(token)).set({ userId: user.id, createdMs: now, expiresMs: now + 3_600_000, used: false, createdAt: FieldValue.serverTimestamp() });
    const base = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '');
    await sendPasswordResetEmail(addr, `${base}/auth/reset?token=${token}`);
  } catch (e) { console.error('[forgot]', e); }
  return ok;
}
