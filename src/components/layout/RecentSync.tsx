'use client';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRecentStore } from '@/store/recentStore';

/**
 * Signed in: on login the browser's list is merged into the account (read once, written only if something changed),
 * and later views are saved in one batched write a few seconds after the last one. Signed out: nothing is sent.
 */
export function RecentSync() {
  const { status, data } = useSession();
  const uid = data?.user?.id;
  const synced = useRef<string | null>(null);
  const timer = useRef<any>(null);
  const items = useRecentStore(s => s.items);
  const merge = useRecentStore(s => s.merge);

  useEffect(() => {
    if (status !== 'authenticated' || !uid || synced.current === uid) return;
    synced.current = uid;
    (async () => {
      try {
        const local = useRecentStore.getState().items;
        const r = await fetch('/api/account/recent', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: local }) });
        if (r.ok) merge((await r.json()).items || []);
      } catch { /* try again next visit */ }
    })();
  }, [status, uid, merge]);

  useEffect(() => {
    if (status !== 'authenticated' || !uid || synced.current !== uid) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch('/api/account/recent', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: useRecentStore.getState().items }) }).catch(() => {});
    }, 8000);
    return () => clearTimeout(timer.current);
  }, [items, status, uid]);
  return null;
}
