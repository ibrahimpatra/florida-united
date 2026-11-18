/** Runs once when the server starts. Prints only problems: missing or suspicious environment settings. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Plain console on purpose: importing the logger here would pull the database library into the edge build.
  const log = {
    error: (m: string, d?: any) => console.error(`ERROR [startup] ${m}`, d ? JSON.stringify(d) : ''),
    warn: (m: string, d?: any) => console.warn(`WARN  [startup] ${m}`, d ? JSON.stringify(d) : ''),
  };
  const has = (...names: string[]) => names.some(n => !!process.env[n]);

  const required: [string, string[]][] = [
    ['Firebase Admin project id', ['FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID']],
    ['Firebase Admin client email', ['FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_CLIENT_EMAIL']],
    ['Firebase Admin private key', ['FIREBASE_ADMIN_PRIVATE_KEY', 'FIREBASE_PRIVATE_KEY']],
    ['NEXTAUTH_SECRET (login will fail)', ['NEXTAUTH_SECRET']],
    ['NEXTAUTH_URL', ['NEXTAUTH_URL']],
  ];
  const missing = required.filter(([, names]) => !has(...names)).map(([label]) => label);
  if (missing.length) log.error('Missing required settings (the app will not work until these are set)', { missing });

  const optional: [string, string[]][] = [
    ['Email (order emails and password reset will not send)', ['EMAIL_USER']],
    ['Stripe (card payment is off, cash on delivery still works)', ['STRIPE_SECRET_KEY']],
    ['Stripe webhook secret (paid card orders will not be confirmed)', ['STRIPE_WEBHOOK_SECRET']],
    ['Gemini (AI assistant is off)', ['GEMINI_API_KEY']],
    ['R2 image storage (uploads fall back to Firebase Storage)', ['R2_BUCKET']],
    ['CRON_SECRET (unpaid card order cleanup is locked)', ['CRON_SECRET']],
  ];
  const off = optional.filter(([, names]) => !has(...names)).map(([label]) => label);
  if (off.length) log.warn('Optional features not configured', { off });

  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || '';
  if (key && !/BEGIN PRIVATE KEY/.test(key)) log.error('Firebase private key does not look right (it must start with -----BEGIN PRIVATE KEY-----)');
  if (process.env.NODE_ENV === 'production' && /localhost/.test(process.env.NEXTAUTH_URL || ''))
    log.warn('NEXTAUTH_URL points to localhost in production. Set it to your real domain.');
}
