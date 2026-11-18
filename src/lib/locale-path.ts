/** Arabic pages live under /ar/... and mirror the public English pages. */
const PUBLIC = [/^\/$/, /^\/shop(\/.*)?$/, /^\/deals$/, /^\/bundles$/, /^\/about$/, /^\/contact$/, /^\/terms$/, /^\/privacy$/, /^\/returns-policy$/, /^\/shipping-info$/, /^\/search$/];

export const isArabicPath = (p?: string | null) => !!p && (p === '/ar' || p.startsWith('/ar/'));
export const stripAr = (p: string) => (isArabicPath(p) ? p.slice(3) || '/' : p);
export const toAr = (p: string) => (isArabicPath(p) ? p : p === '/' ? '/ar' : `/ar${p}`);
/** True when this path has an Arabic twin (checkout, account, admin... do not). */
export const hasArabicTwin = (p: string) => PUBLIC.some(r => r.test(stripAr(p)));
