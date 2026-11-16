'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Timer, Percent, Gift, Tag, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';
import type { FlashDeal } from '@/lib/shipping';

/** Seconds left until endAt, ticking every second. */
function useRemaining(endAt: string) {
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((new Date(endAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(endAt).getTime() - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [endAt]);
  return left;
}

function Countdown({ endAt }: { endAt: string }) {
  const { t } = useLanguage();
  const left = useRemaining(endAt);
  const parts = [
    { v: Math.floor(left / 86400), l: t('c2_deal.days') }, { v: Math.floor((left % 86400) / 3600), l: t('c2_deal.hrs') },
    { v: Math.floor((left % 3600) / 60), l: t('c2_deal.min') }, { v: left % 60, l: t('c2_deal.sec') },
  ];
  return (
    <div className="flex items-end gap-2" dir="ltr" aria-label={t('c2_deal.endsIn')}>
      {parts.map((p, i) => (
        <div key={i} className="text-center">
          <div className="min-w-[2.75rem] rounded-lg bg-black/25 px-2 py-1.5 text-xl font-black tabular-nums leading-none">{String(p.v).padStart(2, '0')}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider opacity-70">{p.l}</div>
        </div>
      ))}
    </div>
  );
}

function bigText(deal: FlashDeal, t: (k: string, v?: any) => string) {
  if (deal.type === 'percentage') return { num: `${deal.discountValue}%`, sub: t('c2_deal.off') };
  if (deal.type === 'fixed') return { num: formatPrice(deal.discountValue), sub: t('c2_deal.offFixed') };
  return { num: t('c2_deal.bogoBig'), sub: t('c2_deal.bogoSub') };
}
const Icon = (d: FlashDeal) => (d.type === 'percentage' ? Percent : d.type === 'bogo' ? Gift : Tag);

function target(deal: FlashDeal) {
  return deal.scope === 'products' && deal.productIds?.length === 1 ? `/shop/products/${deal.productIds[0]}` : '/deals';
}

/**
 * Home-page offer banners. Fully automatic: every live flash deal that is marked "show on homepage" appears here,
 * and disappears again when it ends. Text, badge and numbers follow the visitor's language.
 */
export function FlashDealsSection() {
  const { t, L } = useLanguage();
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  useEffect(() => {
    fetch('/api/flash-deals').then(r => r.json()).then(d => setDeals(Array.isArray(d) ? d.filter((x: FlashDeal) => x.showOnHomepage !== false && x.type !== 'bundle') : [])).catch(() => {});
  }, []);
  if (!deals.length) return null;
  const [hero, ...rest] = deals;
  const hb = bigText(hero, t); const HI = Icon(hero);
  const scopeLine = hero.minCartAmount ? t('c2_deal.minCart', { amount: formatPrice(hero.minCartAmount) }) : hero.scope === 'all' ? t('c2_deal.allStore') : '';

  return (
    <section className="section" aria-label={t('c1_home.flash')}>
      <div className="container-custom space-y-4">
        {/* Hero offer */}
        <Link href={target(hero)} className="group relative block overflow-hidden rounded-3xl text-white" style={{ backgroundColor: hero.bannerColor || '#b91c1c' }}>
          {/* diagonal hatching + a darker slab on the number side: printed-poster feel instead of a flat gradient */}
          <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 14px)' }} />
          <div className="absolute inset-y-0 end-0 w-1/2 bg-black/15 [clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)] rtl:[clip-path:polygon(0_0,78%_0,100%_100%,0_100%)]" />
          <div className="relative grid md:grid-cols-[1.3fr_1fr] gap-6 items-center p-6 sm:p-10">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-3 py-1 text-xs font-bold tracking-wide">
                <Sparkles className="h-3.5 w-3.5" />{L(hero as any, 'badgeText') || t('c2_deal.liveNow')}
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl font-black leading-tight">{L(hero as any, 'title')}</h2>
              {L(hero as any, 'subtitle') && <p className="mt-2 max-w-lg text-white/85">{L(hero as any, 'subtitle')}</p>}
              {scopeLine && <p className="mt-2 text-sm text-white/70">{scopeLine}</p>}
              {hero.showCountdown !== false && <div className="mt-6"><Countdown endAt={hero.endAt} /></div>}
              <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-gray-900 transition-transform group-hover:-translate-y-0.5">
                {t('c2_deal.shop')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </span>
            </div>
            <div className="relative flex flex-col items-center justify-center py-2 text-center">
              <HI className="mb-1 h-6 w-6 opacity-80" />
              <div className="text-7xl sm:text-8xl font-black leading-none tracking-tight">{hb.num}</div>
              <div className="mt-2 text-sm font-bold uppercase tracking-widest opacity-90">{hb.sub}</div>
              {hero.maxUsesTotal ? <div className="mt-3 text-xs rounded-full bg-black/25 px-3 py-1">{t('c2_deal.limited')}</div> : null}
            </div>
          </div>
        </Link>

        {/* More offers */}
        {rest.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.slice(0, 3).map(d => {
              const b = bigText(d, t);
              return (
                <Link key={d.id} href={target(d)} className="group relative overflow-hidden rounded-2xl p-5 text-white" style={{ backgroundColor: d.bannerColor || '#1d4ed8' }}>
                  <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 12px)' }} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">{L(d as any, 'badgeText')}</span>
                      <h3 className="mt-1 text-lg font-bold leading-snug">{L(d as any, 'title')}</h3>
                      {d.showCountdown !== false && <p className="mt-2 flex items-center gap-1 text-xs opacity-80"><Timer className="h-3.5 w-3.5" /><MiniLeft endAt={d.endAt} /></p>}
                    </div>
                    <div className="shrink-0 text-end"><div className="text-4xl font-black leading-none">{b.num}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-85">{b.sub}</div></div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniLeft({ endAt }: { endAt: string }) {
  const { t } = useLanguage();
  const left = useRemaining(endAt);
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60);
  return <span dir="ltr">{d > 0 ? `${d} ${t('c2_deal.days')} ` : ''}{h} {t('c2_deal.hrs')} {m} {t('c2_deal.min')}</span>;
}
