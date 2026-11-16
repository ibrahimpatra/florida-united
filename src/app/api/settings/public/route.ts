import { NextResponse } from 'next/server';
import { loadShippingSettings } from '@/lib/orders-server';
import { cardEnabled, getUsdRate } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import { SITE_CONFIG } from '@/lib/siteConfig';

export const dynamic = 'force-dynamic';

/** Non-sensitive storefront settings (same source checkout uses, so they can never disagree). */
export async function GET() {
  try {
    const { settings } = await loadShippingSettings();
    return NextResponse.json({
      freeShippingThreshold: settings.freeShippingThreshold ?? null,
      defaultShippingCost: settings.defaultShippingCost,
      codEnabled: settings.codEnabled !== false,
      codFee: settings.codFee ?? 0,
      usdRate: await getUsdRate(getAdminDb()),
      cardEnabled: cardEnabled(),
    }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({
      freeShippingThreshold: SITE_CONFIG.freeShippingThreshold, defaultShippingCost: SITE_CONFIG.defaultShippingCost, codEnabled: true, codFee: 0, usdRate: 3.25, cardEnabled: false,
    });
  }
}
