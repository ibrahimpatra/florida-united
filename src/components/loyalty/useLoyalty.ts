'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export interface LoyaltyInfo {
  enabled: boolean; settings?: any; points?: number; valueKwd?: number; tier?: { name: string; nameAr?: string; bonusPct: number } | null;
  next?: { name: string; nameAr?: string; minSpent: number } | null; history?: any[];
}
/** The signed-in customer's loyalty status (null while loading or when the programme is off). */
export function useLoyalty(): LoyaltyInfo | null {
  const { status } = useSession();
  const [info, setInfo] = useState<LoyaltyInfo | null>(null);
  useEffect(() => {
    if (status === 'loading') return;
    fetch('/api/loyalty', { cache: 'no-store' }).then(r => r.json()).then(d => setInfo(d?.enabled ? d : null)).catch(() => setInfo(null));
  }, [status]);
  return info;
}
