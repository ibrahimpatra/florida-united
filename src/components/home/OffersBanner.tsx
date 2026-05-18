'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const offers = [
  { title: '⚡ Flash Deal', subtitle: 'Circuit Breakers', discount: '40% OFF', color: 'from-blue-700 to-blue-900', href: '/shop/electrical', ends: Date.now() + 86400000 * 2 },
  { title: '🔧 Tool Sale', subtitle: 'Power Tools & Hand Tools', discount: '30% OFF', color: 'from-gray-700 to-gray-900', href: '/shop/hardware', ends: Date.now() + 86400000 * 5 },
  { title: '🦺 Safety Week', subtitle: 'All PPE & Safety Gear', discount: '25% OFF', color: 'from-orange-600 to-red-700', href: '/shop/safety', ends: Date.now() + 86400000 * 3 },
];

function useCountdown(target: number) {
  const [diff, setDiff] = useState(target - Date.now());
  useEffect(() => {
    const t = setInterval(() => setDiff(target - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  const s = Math.max(0, diff);
  const h = Math.floor(s / 3600000);
  const m = Math.floor((s % 3600000) / 60000);
  const sec = Math.floor((s % 60000) / 1000);
  return { h, m, sec };
}

function Timer({ target }: { target: number }) {
  const { h, m, sec } = useCountdown(target);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="flex gap-1 text-center">
      {[h, m, sec].map((v, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <span className="bg-white/20 rounded px-1.5 py-0.5 text-sm font-bold text-white">{pad(v)}</span>
          {i < 2 && <span className="text-white/70 text-xs">:</span>}
        </span>
      ))}
    </div>
  );
}

export function OffersBanner() {
  return (
    <section className="section" aria-label="Special Offers">
      <div className="container-custom">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="section-title">🔥 Hot Deals</h2>
            <p className="section-subtitle">Limited time offers — grab them fast!</p>
          </div>
          <Link href="/deals" className="text-brand-500 font-semibold text-sm hover:text-brand-700">View All →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <Link key={offer.title} href={offer.href}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${offer.color} p-6 text-white hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-xl group`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <span className="inline-block text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full mb-3">{offer.title}</span>
                <p className="text-lg font-bold mb-1">{offer.subtitle}</p>
                <p className="text-4xl font-black mb-4">{offer.discount}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-xs mb-1">Ends in:</p>
                    <Timer target={offer.ends} />
                  </div>
                  <span className="px-4 py-2 bg-white text-gray-900 rounded-xl font-bold text-sm group-hover:bg-yellow-300 transition-colors">Shop Now →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
