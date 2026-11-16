import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

const SETTINGS_PATH = 'config/storeSettings';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const snap = await db.doc(SETTINGS_PATH).get();
    return NextResponse.json(snap.exists ? snap.data() : {});
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const raw = await req.json();
    // whitelist + coerce: the form posts every value as a string
    const NUM = ['freeShippingThreshold', 'defaultShippingCost', 'taxRate', 'defaultReturnDays', 'usdRate'];
    const STR = ['storeName', 'tagline', 'phone', 'email', 'emailOrders', 'address', 'whatsapp', 'hoursWeekdays', 'hoursSaturday', 'metaTitle', 'metaDesc', 'googleAnalyticsId', 'paymentMode'];
    const data: Record<string, any> = {};
    for (const k of NUM) if (k in raw) {
      const n = Number(raw[k]);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: `"${k}" must be a number of 0 or more.` }, { status: 400 });
      data[k] = n;
    }
    for (const k of STR) if (k in raw) data[k] = String(raw[k] ?? '').trim();
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    const db = getAdminDb();
    await db.doc(SETTINGS_PATH).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[settings]', e);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
