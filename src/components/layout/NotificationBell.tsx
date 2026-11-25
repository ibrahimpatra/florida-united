'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import LocLink from '@/components/ui/LocLink';
import { Bell, Package, RotateCcw, Tag, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Note { id: string; type: string; title: string; titleAr?: string; body?: string; bodyAr?: string; href?: string; createdAt: string }
interface Data { items: Note[]; readAt: string; unread: number }

const FRESH_MS = 5 * 60_000;     // the list is asked for at most every 5 minutes on its own...
const OPEN_MS = 60_000;          // ...and when the bell is opened, if it is older than a minute
const ICON: Record<string, any> = { order: Package, return: RotateCcw, offer: Tag };

function ago(iso: string, ar: boolean) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const u = ar ? { n: 'الآن', m: 'د', h: 'س', d: 'ي' } : { n: 'now', m: 'm', h: 'h', d: 'd' };
  if (s < 60) return u.n;
  if (s < 3600) return `${Math.floor(s / 60)}${u.m}`;
  if (s < 86400) return `${Math.floor(s / 3600)}${u.h}`;
  return `${Math.floor(s / 86400)}${u.d}`;
}

/** The bell. scope "me" = the shopper's own updates and offers, "admin" = the team's alerts. Low cost: see FRESH_MS / OPEN_MS. */
export function NotificationBell({ scope = 'me', className = '' }: { scope?: 'me' | 'admin'; className?: string }) {
  const { t, isArabic } = useLanguage();
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const at = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const KEY = `fk-notif:${scope}`;
  const Link: any = scope === 'me' ? LocLink : NextLink;   // shop links follow the language; admin links never get a /ar prefix

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - at.current < FRESH_MS) return;
    at.current = Date.now();
    try {
      const r = await fetch(`/api/notifications?scope=${scope}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d: Data = await r.json(); setData(d);
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: at.current, d })); } catch { /* optional */ }
    } catch { /* offline: keep what is shown */ }
  }, [scope, KEY]);

  useEffect(() => {
    try { const c = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (c?.d) { setData(c.d); at.current = c.at || 0; } } catch { /* optional */ }
    load();
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [load, KEY]);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);

  const markRead = useCallback(() => {
    const now = new Date().toISOString();
    setData(d => { if (!d || !d.unread) return d; const n = { ...d, readAt: now, unread: 0 }; try { sessionStorage.setItem(KEY, JSON.stringify({ at: at.current, d: n })); } catch { /* optional */ } return n; });
    fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', scope }) }).catch(() => {});
  }, [scope, KEY]);

  const toggle = () => {
    const next = !open; setOpen(next);
    if (next) { if (Date.now() - at.current > OPEN_MS) load(true); }
  };
  const unread = data?.unread || 0;
  const items = data?.items || [];

  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" onClick={toggle} aria-label={t('smart.bell')} aria-expanded={open}
        className="relative w-10 h-10 rounded-full hover:bg-gray-100 active:scale-95 transition flex items-center justify-center text-gray-700">
        <Bell className="w-5 h-5" />
        {unread > 0 && <span className="absolute top-0.5 end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:end-0 sm:w-96 z-[70] bg-white rounded-3xl shadow-hover border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-bold text-gray-900 text-sm">{t('smart.bell')}</p>
            {unread > 0 && <button type="button" onClick={markRead} className="text-xs font-semibold text-brand-700 hover:underline inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('smart.markAll')}</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto thin-scroll">
            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500"><Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />{t('smart.bellEmpty')}</div>
            ) : items.map(n => {
              const Icon = ICON[n.type] || Bell; const isNew = data ? n.createdAt > data.readAt : false;
              const title = (isArabic && n.titleAr) || n.title; const body = (isArabic && n.bodyAr) || n.body;
              const inner = (
                <div className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${isNew ? 'bg-brand-50/50' : ''}`}>
                  <span className="shrink-0 w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 leading-snug">{title}</span>
                    {body && <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{body}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-gray-400 pt-0.5 flex flex-col items-end gap-1">{ago(n.createdAt, isArabic)}{isNew && <span className="w-2 h-2 rounded-full bg-accent-500" />}</span>
                </div>
              );
              return n.href ? <Link key={n.id} href={n.href} onClick={() => { setOpen(false); markRead(); }}>{inner}</Link> : <div key={n.id}>{inner}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
