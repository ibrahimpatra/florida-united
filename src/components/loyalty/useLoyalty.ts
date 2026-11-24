'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export interface LoyaltyInfo {
  enabled: boolean; settings?: any; points?: number; valueKwd?: number; tier?: { name: string; nameAr?: string; bonusPct: number } | null;
  next?: { name: string; nameAr?: string; minSpent: number } | null; history?: any[]; joined?: boolean; pending?: { total: number; rows: { orderId: string; orderNumber: string; points: number; releaseAt: string | null; onHold: boolean }[] };
}
/** The signed-in customer's loyalty status (null while loading or when the programme is off). */
export function useLoyalty(): LoyaltyInfo | null { return useLoyaltyState().info; }
export function useLoyaltyState() {
  const { status } = useSession();
  const [info, setInfo] = useState<LoyaltyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (status === 'loading') return;
    setLoading(true);
    fetch('/api/loyalty', { cache: 'no-store' }).then(r => r.json()).then(d => setInfo(d?.enabled ? d : null)).catch(() => setInfo(null)).finally(() => setLoading(false));
  }, [status, tick]);
  return { info, loading, reload: () => setTick(x => x + 1) };
}
