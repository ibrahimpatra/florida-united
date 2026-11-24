/**
 * Roles: customer < admin < superadmin.
 * A superadmin is stored as role "superadmin" in users/{id}. The session maps it to role "admin" (so every existing admin check keeps working)
 * and adds `isSuper`. Only a superadmin sees Issues, Settings and Jobs.
 * Safety net: while NO superadmin exists yet, every admin counts as super, so nobody is locked out the day this is deployed.
 */
import { getAdminDb } from './firebase-admin';

export const ROLES = ['customer', 'admin', 'superadmin'] as const;
export type Role = typeof ROLES[number];

let cache: { at: number; has: boolean } | null = null;
const roleCache = new Map<string, { at: number; role: string | null }>();
export function __resetRolesCache() { cache = null; roleCache.clear(); }

export async function anySuperadminExists(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 60_000) return cache.has;
  let has = true;
  try { has = !(await getAdminDb().collection('users').where('role', '==', 'superadmin').limit(1).get()).empty; }
  catch { has = true; /* if we cannot tell, do not widen access */ }
  cache = { at: Date.now(), has };
  return has;
}

/** The stored role of one user, cached for a minute (so a demotion or promotion applies within about a minute, without signing in again). null = could not read. */
export async function roleOf(id: string): Promise<string | null> {
  const c = roleCache.get(id);
  if (c && Date.now() - c.at < 60_000) return c.role;
  let role: string | null = null;
  try { const s = await getAdminDb().collection('users').doc(id).get(); role = s.exists ? String((s.data() as any)?.role || 'customer').toLowerCase() : 'customer'; } catch { role = null; }
  roleCache.set(id, { at: Date.now(), role });
  return role;
}

const ms = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate().getTime() : v ? new Date(v).getTime() || Infinity : Infinity);

/**
 * If the shop has no super admin yet, the OLDEST admin account (the owner who set the shop up) becomes the super admin, once, and is saved as such.
 * Everybody else stays a normal admin. Returns the super admin's id.
 */
export async function ensureOwnerSuper(): Promise<string | null> {
  try {
    const db = getAdminDb();
    const ex = await db.collection('users').where('role', '==', 'superadmin').limit(1).get();
    if (!ex.empty) return ex.docs[0].id;
    const admins = (await db.collection('users').where('role', '==', 'admin').get()).docs;
    if (!admins.length) return null;
    const owner = admins.sort((a: any, b: any) => ms(a.data().createdAt) - ms(b.data().createdAt))[0];
    await db.collection('users').doc(owner.id).update({ role: 'superadmin', updatedAt: new Date().toISOString() });
    __resetRolesCache();
    return owner.id;
  } catch { return null; }
}

export const isAdminSession = (s: any) => String(s?.user?.role || '').toLowerCase() === 'admin';

/**
 * True only for the super admin. Checked against the stored role (cached 1 minute), not against what the login remembered, so changes apply quickly.
 * If the shop has no super admin yet, the oldest admin is made one (see ensureOwnerSuper); other admins are NOT super.
 */
export async function isSuperSession(s: any): Promise<boolean> {
  if (!isAdminSession(s)) return false;
  const id = String(s.user.id || '');
  const role = id ? await roleOf(id) : null;
  if (role === 'superadmin') return true;
  if (role === null) return !!s.user.isSuper;              // the database could not be read: fall back to what the login said
  if (role !== 'admin') return false;                       // demoted to customer
  if (await anySuperadminExists()) return false;
  return (await ensureOwnerSuper()) === id;
}
