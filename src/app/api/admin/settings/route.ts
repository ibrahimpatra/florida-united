import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { isHex } from '@/lib/brand';
import { clearBrandCache } from '@/lib/brand-server';
import { getAdminDb } from '@/lib/firebase-admin';
import { denyUnlessSuper } from '@/lib/api-error';

const SETTINGS_PATH = 'config/storeSettings';

async function __GET() {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  { const no = await denyUnlessSuper(session); if (no) return no; }

  try {
    const db = getAdminDb();
    const snap = await db.doc(SETTINGS_PATH).get();
    return NextResponse.json(snap.exists ? snap.data() : {});
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  { const no = await denyUnlessSuper(session); if (no) return no; }

  try {
    const raw = await req.json();
    // whitelist + coerce: the form posts every value as a string
    const NUM = ['freeShippingThreshold', 'defaultShippingCost', 'taxRate', 'defaultReturnDays', 'usdRate'];
    const STR = ['storeName', 'tagline', 'phone', 'email', 'emailOrders', 'address', 'addressAr', 'whatsapp', 'hoursWeekdays', 'hoursSaturday', 'metaTitle', 'metaDesc', 'googleAnalyticsId', 'paymentMode',
      'storeNameAr', 'taglineAr', 'logoUrl', 'faviconUrl', 'themeName', 'onlineProvider'];
    const data: Record<string, any> = {};
    for (const k of NUM) if (k in raw) {
      const n = Number(raw[k]);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: `"${k}" must be a number of 0 or more.` }, { status: 400 });
      data[k] = n;
    }
    for (const k of STR) if (k in raw) data[k] = String(raw[k] ?? '').trim();
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    for (const k of ['brandColor', 'accentColor']) if (k in raw) {
      const v = String(raw[k] ?? '').trim();
      if (v && !isHex(v)) return NextResponse.json({ error: 'Colours must look like #234b63.' }, { status: 400 });
      data[k] = v.toLowerCase();
    }
    if ('onlineProvider' in data && !['', 'auto', 'stripe', 'tap', 'myfatoorah', 'none'].includes(data.onlineProvider))
      return NextResponse.json({ error: 'Unknown payment provider.' }, { status: 400 });
    const db = getAdminDb();
    await db.doc(SETTINGS_PATH).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    clearBrandCache();
    try { revalidatePath('/', 'layout'); } catch {}
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[settings]', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export const GET = withLog('GET', '/api/admin/settings', __GET);
export const POST = withLog('POST', '/api/admin/settings', __POST);
