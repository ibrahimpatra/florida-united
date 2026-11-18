'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { X, Gift } from 'lucide-react';
import { stripAr } from '@/lib/locale-path';
import { useLanguage } from '@/contexts/LanguageContext';

type P = Record<string, any>;
const NEVER = /^\/(admin|checkout|auth|account|api)/;

const pageKey = (path: string): string => {
  const p = stripAr(path);
  if (p === '/') return 'home';
  if (p.startsWith('/shop/products/')) return 'product';
  if (p.startsWith('/shop')) return 'shop';
  if (p.startsWith('/cart')) return 'cart';
  if (p.startsWith('/deals')) return 'deals';
  return 'other';
};

const store = (kind: 'local' | 'session') => { try { return kind === 'local' ? localStorage : sessionStorage; } catch { return null; } };
/** Has this visitor already seen the popup, given its frequency rule? */
export function alreadySeen(p: P, now = Date.now()): boolean {
  const k = `popup_${p.id}`;
  if (p.frequency === 'always') return false;
  if (p.frequency === 'session') return !!store('session')?.getItem(k);
  const at = Number(store('local')?.getItem(k) || 0);
  if (!at) return false;
  return p.frequency === 'once' ? true : now - at < 86_400_000;
}
const markSeen = (p: P) => { const now = String(Date.now()); store('local')?.setItem(`popup_${p.id}`, now); store('session')?.setItem(`popup_${p.id}`, now); };

/** The visible card. Used on the storefront and as the live preview in Admin > Popups. */
export function PopupCard({ p, lang, onClose, onClick, preview }: { p: P; lang: 'en' | 'ar'; onClose?: () => void; onClick?: () => void; preview?: boolean }) {
  const ar = lang === 'ar';
  const title = (ar && p.titleAr) || p.title || 'Your headline';
  const body = (ar && p.bodyAr) || p.body;
  const cta = (ar && p.ctaTextAr) || p.ctaText;
  const tone = p.style === 'brand' ? 'bg-brand-700 text-white' : p.style === 'accent' ? 'bg-accent-400 text-gray-900' : 'bg-white text-gray-900';
  const soft = p.style === 'light' ? 'text-gray-600' : 'opacity-90';
  const codeTone = p.style === 'light' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-current bg-white/15';
  const btn = p.style === 'light' ? 'bg-brand-600 text-white hover:bg-brand-700' : p.style === 'brand' ? 'bg-accent-400 text-gray-900 hover:bg-accent-300' : 'bg-gray-900 text-white hover:bg-gray-800';
  const bar = p.layout === 'bar';
  return (
    <div dir={ar ? 'rtl' : 'ltr'} className={`relative rounded-2xl shadow-xl ${tone} ${bar ? 'px-5 py-3 flex flex-wrap items-center gap-3' : 'p-6 text-center'} ${preview ? '' : ''}`}>
      {onClose && <button onClick={onClose} aria-label="Close" className="absolute end-2 top-2 p-1.5 rounded-lg opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>}
      {!bar && (p.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.image} alt="" className="mx-auto mb-3 h-28 w-full rounded-xl object-cover" />
        : <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-black/10 flex items-center justify-center"><Gift className="w-5 h-5" /></div>)}
      <div className={bar ? 'flex-1 min-w-[160px] pe-6' : ''}>
        <h2 className={`font-display font-bold ${bar ? 'text-base' : 'text-xl'}`}>{title}</h2>
        {body && <p className={`mt-1 text-sm ${soft}`}>{body}</p>}
      </div>
      {p.couponCode && <div className={`${bar ? '' : 'mt-4'} inline-block rounded-xl border-2 border-dashed px-4 py-2 font-mono font-bold tracking-widest ${codeTone}`}>{p.couponCode}</div>}
      {cta && (preview || !p.ctaLink
        ? <div className={`${bar ? '' : 'mt-4'} inline-block rounded-xl px-5 py-2.5 text-sm font-semibold ${btn}`}>{cta}</div>
        : <Link href={p.ctaLink} onClick={onClick} className={`${bar ? '' : 'mt-4'} inline-block rounded-xl px-5 py-2.5 text-sm font-semibold ${btn}`}>{cta}</Link>)}
    </div>
  );
}

/** Picks one live popup that fits this page, visitor and frequency rules, and shows it when its trigger fires. */
export function PopupManager() {
  const path = usePathname() || '/';
  const { status } = useSession();
  const { isArabic } = useLanguage();
  const [popups, setPopups] = useState<P[]>([]);
  const [shown, setShown] = useState<P | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (NEVER.test(stripAr(path))) return;
    let dead = false;
    fetch('/api/popups').then(r => r.json()).then(d => { if (!dead && Array.isArray(d)) setPopups(d); }).catch(() => {});
    return () => { dead = true; };
  }, [path]);

  useEffect(() => {
    setShown(null); fired.current = false;
    if (NEVER.test(stripAr(path)) || status === 'loading' || !popups.length) return;
    const key = pageKey(path);
    const p = popups.find(x =>
      (!x.pages?.length || x.pages.includes(key)) && (x.pages?.length || key !== 'other' || true) &&
      (x.audience === 'everyone' || (x.audience === 'guests' && status === 'unauthenticated') || (x.audience === 'customers' && status === 'authenticated')) &&
      !alreadySeen(x));
    if (!p) return;
    const show = () => { if (fired.current) return; fired.current = true; markSeen(p); setShown(p); fetch(`/api/popups/${p.id}/event`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'view' }) }).catch(() => {}); };
    const cleanups: (() => void)[] = [];
    if (p.trigger === 'delay') { const id = setTimeout(show, Math.max(0, p.delaySeconds) * 1000); cleanups.push(() => clearTimeout(id)); }
    else if (p.trigger === 'scroll') {
      const on = () => { const h = document.documentElement; const pct = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100; if (pct >= p.scrollPercent) show(); };
      window.addEventListener('scroll', on, { passive: true }); cleanups.push(() => window.removeEventListener('scroll', on));
    } else if (p.trigger === 'exit') {
      const on = (e: MouseEvent) => { if (e.clientY <= 0) show(); };
      document.addEventListener('mouseleave', on); cleanups.push(() => document.removeEventListener('mouseleave', on));
      // phones have no mouse: fall back to a long delay so exit offers are not wasted
      if (window.matchMedia('(pointer: coarse)').matches) { const id = setTimeout(show, 25000); cleanups.push(() => clearTimeout(id)); }
    }
    return () => cleanups.forEach(c => c());
  }, [popups, path, status]);

  if (!shown) return null;
  const close = () => setShown(null);
  const click = () => { fetch(`/api/popups/${shown.id}/event`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'click' }) }).catch(() => {}); close(); };
  const card = <PopupCard p={shown} lang={isArabic ? 'ar' : 'en'} onClose={close} onClick={click} />;
  if (shown.layout === 'bar') return <div className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-3xl" role="dialog" aria-label={shown.title}>{card}</div>;
  if (shown.layout === 'corner') return <div className="fixed bottom-3 end-3 z-[120] w-[calc(100%-1.5rem)] max-w-xs" role="dialog" aria-label={shown.title}>{card}</div>;
  return <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={shown.title} onClick={close}><div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>{card}</div></div>;
}
