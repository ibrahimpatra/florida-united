import { NextResponse } from 'next/server';

/**
 * One rule for the whole app: shoppers get a short friendly message, admins also get the technical reason
 * (`adminDetail`) so they can fix it without opening the server logs. The front end shows adminDetail as "[admin only] ...".
 */
export const isAdminRole = (session: any) => String(session?.user?.role || '').toLowerCase() === 'admin';

export function failJson(session: any, status: number, publicMessage: string, cause?: any, extra: Record<string, any> = {}) {
  const detail = cause ? String(cause?.message || cause).slice(0, 400) : '';
  return NextResponse.json({ error: publicMessage, ...extra, ...(isAdminRole(session) && detail ? { adminDetail: detail } : {}) }, { status });
}
export { errorText } from './error-text';
