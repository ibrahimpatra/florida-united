import { returnWindowDays, DEFAULT_RETURN_DAYS } from '@/lib/returns';
import { withLog } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { loadShippingSettings } from '@/lib/orders-server';
import { getUsdRate } from '@/lib/stripe';
import { onlineProvider } from '@/lib/payments';
import { getAdminDb } from '@/lib/firebase-admin';
import { SITE_CONFIG } from '@/lib/siteConfig';

export const dynamic = 'force-dynamic';

/** Non-sensitive storefront settings (same source checkout uses, so they can never disagree). */
async function __GET() {
  try {
    const { settings } = await loadShippingSettings();
    return NextResponse.json({
      freeShippingThreshold: settings.freeShippingThreshold ?? null,
      returnWindowDays: returnWindowDays(settings.returnWindowDays),
      defaultShippingCost: settings.defaultShippingCost,
      codEnabled: settings.codEnabled !== false,
      codFee: settings.codFee ?? 0,
      usdRate: await getUsdRate(getAdminDb()),
      ...(await (async () => { const p = await onlineProvider(getAdminDb()); return { cardEnabled: !!p, onlineProvider: p?.id || null, onlineProviderName: p?.name || null, onlineCurrency: p?.currency || null }; })()),
    }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({
      returnWindowDays: DEFAULT_RETURN_DAYS, freeShippingThreshold: SITE_CONFIG.freeShippingThreshold, defaultShippingCost: SITE_CONFIG.defaultShippingCost, codEnabled: true, codFee: 0, usdRate: 3.25, cardEnabled: false, onlineProvider: null, onlineProviderName: null, onlineCurrency: null,
    });
  }
}

export const GET = withLog('GET', '/api/settings/public', __GET);
