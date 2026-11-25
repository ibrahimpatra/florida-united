'use client';
import { useEffect, useRef, useState } from 'react';
import { Package } from 'lucide-react';

/**
 * Picture area of a product card. One picture: shown as is. Several: they cross-fade on hover (desktop)
 * and can be swiped sideways on a phone. Only the first picture loads with the page; the others are loaded the first
 * time the shopper hovers or touches the card, so a long product list costs nothing extra.
 * Dots at the bottom show which picture is on screen.
 */
export function CardSlides({ images, alt, onError }: { images: string[]; alt: string; onError?: () => void }) {
  const list = (images || []).filter(Boolean).slice(0, 8);
  const [i, setI] = useState(0);
  const [armed, setArmed] = useState(false);          // other pictures requested
  const timer = useRef<any>(null);
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const swiped = useRef(false);
  const many = list.length > 1;

  const stop = () => { clearInterval(timer.current); timer.current = null; };
  const start = () => { if (!many || timer.current) return; setArmed(true); setI(x => (x + 1) % list.length); timer.current = setInterval(() => setI(x => (x + 1) % list.length), 1200); };
  const leave = () => { stop(); setI(0); };
  useEffect(() => stop, []);

  if (!list.length) return <div className="w-full h-full flex items-center justify-center bg-gray-100"><Package className="w-12 h-12 text-gray-300" /></div>;

  return (
    <div className="absolute inset-0"
      onMouseEnter={() => { if (window.matchMedia('(hover: hover)').matches) start(); }}
      onMouseLeave={leave}
      onTouchStart={e => { setArmed(true); const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, moved: false }; }}
      onTouchMove={e => { const s = touch.current; if (!s || !many) return; const t = e.touches[0]; if (Math.abs(t.clientX - s.x) > 24 && Math.abs(t.clientX - s.x) > Math.abs(t.clientY - s.y) * 1.5) s.moved = true; }}
      onTouchEnd={e => {
        const s = touch.current; touch.current = null;
        if (!s?.moved || !many) return;
        const dx = e.changedTouches[0].clientX - s.x;
        swiped.current = true; setTimeout(() => { swiped.current = false; }, 450);
        setI(x => (x + (dx < 0 ? 1 : -1) + list.length) % list.length);
      }}
      onClickCapture={e => { /* a swipe must not open the product */ if (swiped.current) { e.preventDefault(); e.stopPropagation(); } }}
    >
      {list.map((src, n) => (n === 0 || armed) && (
        <img key={src + n} src={src} alt={n === 0 ? alt : `${alt} ${n + 1}`} loading={n === 0 ? 'lazy' : 'eager'} decoding="async" draggable={false}
          onError={n === 0 ? onError : undefined}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${n === i ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      {many && (
        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 pointer-events-none md:group-hover:bottom-12 transition-all duration-300">
          {list.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n === i ? 'w-4 bg-white shadow' : 'w-1.5 bg-white/60'}`} />)}
        </div>
      )}
    </div>
  );
}
