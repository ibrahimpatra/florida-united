'use client';
import { useEffect, useState } from 'react';
import { SITE_CONFIG } from './siteConfig';

export interface PublicSettings { freeShippingThreshold: number | null; defaultShippingCost: number; codEnabled: boolean; codFee: number; usdRate: number; cardEnabled: boolean }
const DEFAULTS: PublicSettings = { freeShippingThreshold: SITE_CONFIG.freeShippingThreshold, defaultShippingCost: SITE_CONFIG.defaultShippingCost, codEnabled: true, codFee: 0, usdRate: 3.25, cardEnabled: false };
let cache: PublicSettings | null = null;
let inflight: Promise<PublicSettings> | null = null;

function load(): Promise<PublicSettings> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch('/api/settings/public').then(r => (r.ok ? r.json() : DEFAULTS)).catch(() => DEFAULTS)
    .then(d => { cache = { ...DEFAULTS, ...d }; return cache!; });
  return inflight;
}

/** Live store settings (free-shipping threshold etc.), with SITE_CONFIG defaults until loaded. */
export function useStoreSettings(): PublicSettings {
  const [s, setS] = useState<PublicSettings>(cache || DEFAULTS);
  useEffect(() => { let off = false; load().then(v => { if (!off) setS(v); }); return () => { off = true; }; }, []);
  return s;
}
