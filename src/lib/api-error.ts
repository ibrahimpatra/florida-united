import { NextResponse } from 'next/server';

/**
 * One rule for the whole app: shoppers get a short friendly message, admins also get the technical reason
 * (`adminDetail`) so they can fix it without opening the server logs. The front end shows adminDetail as "[admin only] ...".
 */
export const isAdminRole = (session: any) => String(session?.user?.role || '').toLowerCase() === 'admin';

/** Returns a 401 response unless the caller is a superadmin (see roles.ts); null means allowed. */
export async function denyUnlessSuper(session: any): Promise<NextResponse | null> {
  const { isSuperSession } = await import('./roles');
  return (await isSuperSession(session)) ? null : NextResponse.json({ error: 'Only the super admin can do this.' }, { status: 403 });
}

export function failJson(session: any, status: number, publicMessage: string, cause?: any, extra: Record<string, any> = {}) {
  const detail = cause ? String(cause?.message || cause).slice(0, 400) : '';
  return NextResponse.json({ error: publicMessage, ...extra, ...(isAdminRole(session) && status >= 500 && detail && detail.trim() !== publicMessage.trim() ? { adminDetail: detail } : {}) }, { status });
}
export { errorText } from './error-text';
