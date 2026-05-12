'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, ArrowRight } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { FlashDeal } from '@/lib/shipping';

function Countdown({ endAt }: { endAt: string }) {
  const [t, setT] = useState({ h:0,m:0,s:0 });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff<=0) return;
      setT({ h:Math.floor(diff/3600000), m:Math.floor((diff%3600000)/60000), s:Math.floor((diff%60000)/1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);
  const pad = (n: number) => String(n).padStart(2,'0');
  return (
    <div className="flex items-center gap-1">
      {[t.h,t.m,t.s].map((v,i) => (
        <span key={i} className="flex items-center gap-0.5">
          <span className="bg-white/20 backdrop-blur-sm rounded-lg px-1.5 py-0.5 text-sm font-black text-white font-mono">{pad(v)}</span>
          {i<2 && <span className="text-white/70 text-xs font-bold">:</span>}
        </span>
      ))}
    </div>
  );
}

export function FlashDealsSection() {
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  useEffect(() => {
    fetch('/api/flash-deals').then(r=>r.json()).then(d=>setDeals(Array.isArray(d)?d.filter((x:FlashDeal)=>x.showOnHomepage):[]))
      .catch(()=>{});
  }, []);
  if (!deals.length) return null;
  return (
    <section className="section" aria-label="Flash Deals">
      <div className="container-custom">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title flex items-center gap-2"><Zap className="w-6 h-6 text-yellow-500 fill-yellow-500"/>Flash Deals</h2>
          <Link href="/deals" className="text-brand-500 font-semibold text-sm hover:text-brand-700 flex items-center gap-1">View All <ArrowRight className="w-4 h-4"/></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.slice(0,3).map(deal => (
            <Link key={deal.id} href={deal.scope==='products'&&deal.productIds?.[0]?`/shop/products/${deal.productIds[0]}`:'/deals'}
              className="relative overflow-hidden rounded-2xl text-white p-6 hover:scale-[1.02] transition-all duration-300 shadow-lg group"
              style={{ background: `linear-gradient(135deg, ${deal.bannerColor}, ${deal.bannerColor}cc)` }}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"/>
              <span className="inline-block text-xs font-black bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full mb-3">{deal.badgeText}</span>
              <h3 className="text-lg font-bold mb-0.5">{deal.title}</h3>
              {deal.subtitle && <p className="text-white/80 text-sm mb-3">{deal.subtitle}</p>}
              <div className="text-3xl font-black mb-4">
                {deal.type==='percentage'
                  ? `${deal.discountValue}% OFF`
                  : deal.type==='fixed'
                  ? `KWD ${deal.discountValue} OFF`
                  : deal.type.toUpperCase()}
              </div>
              {deal.showCountdown && (
                <div>
                  <p className="text-white/70 text-xs mb-1.5">⏱ Ends in:</p>
                  <Countdown endAt={deal.endAt}/>
                </div>
              )}
              <div className="mt-4 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                Shop Now <ArrowRight className="w-4 h-4"/>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}