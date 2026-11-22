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
export function __resetRolesCache() { cache = null; }

export async function anySuperadminExists(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 60_000) return cache.has;
  let has = true;
  try { has = !(await getAdminDb().collection('users').where('role', '==', 'superadmin').limit(1).get()).empty; }
  catch { has = true; /* if we cannot tell, do not widen access */ }
  cache = { at: Date.now(), has };
  return has;
}

export const isAdminSession = (s: any) => String(s?.user?.role || '').toLowerCase() === 'admin';

/** True for a superadmin, or for any admin while no superadmin exists yet. */
export async function isSuperSession(s: any): Promise<boolean> {
  if (!isAdminSession(s)) return false;
  if (s.user.isSuper) return true;
  return !(await anySuperadminExists());
}
