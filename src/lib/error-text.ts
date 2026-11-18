/** Message a client can show: friendly text, plus the admin-only line when the server sent one. Safe to import in the browser. */
export const errorText = (d: any, fallback: string) => `${d?.error || fallback}${d?.adminDetail ? `\n[admin only] ${d.adminDetail}` : ''}`;
