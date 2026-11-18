/**
 * Server problems saved for Admin > Issues, so an admin can read them without opening Vercel logs.
 * This is the only place that works for login and register failures, because nobody is signed in as admin then.
 * Same problem repeated = one row with a counter. Writes are throttled and can never break a request.
 */
import { getAdminDb } from './firebase-admin';

export interface Issue { id: string; route: string; method: string; status: number; message: string; user: string; count: number; firstAt: string; lastAt: string }
const recent = new Map<string, number>();
const idOf = (route: string, message: string) => Buffer.from(`${route}|${message}`.slice(0, 300)).toString('base64url').slice(0, 90);

export async function recordIssue(i: { route: string; method: string; status: number; message: string; user?: string }) {
  try {
    const message = i.message.replace(/\s+/g, ' ').slice(0, 400);
    const id = idOf(i.route, message);
    const now = Date.now();
    if ((recent.get(id) || 0) > now - 60_000) return;          // at most once a minute per distinct problem per server instance
    recent.set(id, now); if (recent.size > 500) recent.clear();
    const { FieldValue } = await import('firebase-admin/firestore');
    const ref = getAdminDb().collection('errorLog').doc(id);
    const snap = await ref.get();
    const iso = new Date().toISOString();
    if (snap.exists) await ref.update({ count: FieldValue.increment(1), lastAt: iso, status: i.status, user: i.user || '' });
    else await ref.set({ route: i.route, method: i.method, status: i.status, message, user: i.user || '', count: 1, firstAt: iso, lastAt: iso });
  } catch { /* logging must never fail the request */ }
}

export async function listIssues(limit = 200): Promise<Issue[]> {
  const snap = await getAdminDb().collection('errorLog').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Issue)).sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, limit);
}
export async function clearIssues(id?: string) {
  const col = getAdminDb().collection('errorLog');
  if (id) { await col.doc(id).delete(); return; }
  const snap = await col.get(); const b = getAdminDb().batch(); snap.docs.forEach(d => b.delete(d.ref)); await b.commit();
}
