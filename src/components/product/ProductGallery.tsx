'use client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, X, Maximize2 } from 'lucide-react';

/**
 * Product page pictures. A swipeable strip (native scroll-snap, so it feels right on phones), arrows on wider screens,
 * dots, thumbnails, keyboard arrows, and a full-screen view. It slides on its own every few seconds until the shopper
 * touches it, hovers it, or leaves the tab.
 */
export function ProductGallery({ images, alt, children }: { images: string[]; alt: string; children?: ReactNode }) {
  const list = (images || []).filter(Boolean);
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const idle = useRef(true);        // false after the shopper interacts: auto-slide stops for good
  const paused = useRef(false);
  const many = list.length > 1;

  const go = useCallback((n: number, smooth = true) => {
    const el = track.current; if (!el || !list.length) return;
    const k = (n + list.length) % list.length;
    el.scrollTo({ left: Math.abs(el.clientWidth) * k * (getComputedStyle(el).direction === 'rtl' ? -1 : 1), behavior: smooth ? 'smooth' : 'instant' as ScrollBehavior });
    setI(k);
  }, [list.length]);

  const onScroll = () => {
    const el = track.current; if (!el || !el.clientWidth) return;
    const k = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (k !== i && k >= 0 && k < list.length) setI(k);
  };
  const touched = () => { idle.current = false; };

  useEffect(() => {
    if (!many) return;
    const t = setInterval(() => { if (idle.current && !paused.current && !document.hidden && !full) go(((track.current ? Math.round(Math.abs(track.current.scrollLeft) / (track.current.clientWidth || 1)) : 0) + 1)); }, 4500);
    return () => clearInterval(t);
  }, [many, go, full]);

  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); if (e.key === 'ArrowRight') setI(x => (x + 1) % list.length); if (e.key === 'ArrowLeft') setI(x => (x - 1 + list.length) % list.length); };
    document.addEventListener('keydown', k); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [full, list.length]);

  if (!list.length) return (
    <div className="relative bg-gray-100 rounded-3xl overflow-hidden aspect-square flex items-center justify-center"><Package className="w-24 h-24 text-gray-300" />{children}</div>
  );

  return (
    <div onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}
      onKeyDown={e => { if (!many) return; if (e.key === 'ArrowRight') { touched(); go(i + 1); } if (e.key === 'ArrowLeft') { touched(); go(i - 1); } }} tabIndex={-1}>
      <div className="relative bg-gray-100 rounded-3xl overflow-hidden aspect-square mb-3 group">
        <div ref={track} onScroll={onScroll} onTouchStart={touched} onPointerDown={touched}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ scrollBehavior: 'smooth', overscrollBehaviorX: 'contain' }}>
          {list.map((src, n) => (
            <button key={src + n} type="button" onClick={() => setFull(true)} aria-label={`${alt} ${n + 1}`} className="relative flex-none w-full h-full snap-center cursor-zoom-in">
              <img src={src} alt={n === 0 ? alt : `${alt} - ${n + 1}`} draggable={false} loading={n === 0 ? 'eager' : 'lazy'} decoding="async" className="w-full h-full object-cover select-none" />
            </button>
          ))}
        </div>
        {children}
        <button type="button" onClick={() => setFull(true)} aria-label="Full screen" className="absolute bottom-3 end-3 w-9 h-9 rounded-full bg-white/90 shadow-soft flex items-center justify-center text-gray-700 hover:bg-white active:scale-90 transition"><Maximize2 className="w-4 h-4" /></button>
        {many && <>
          <button type="button" onClick={() => { touched(); go(i - 1); }} aria-label="Previous" className="hidden md:flex absolute top-1/2 -translate-y-1/2 start-3 w-10 h-10 rounded-full bg-white/90 shadow-soft items-center justify-center text-gray-800 opacity-0 group-hover:opacity-100 hover:bg-white active:scale-90 transition"><ChevronLeft className="w-5 h-5 rtl:rotate-180" /></button>
          <button type="button" onClick={() => { touched(); go(i + 1); }} aria-label="Next" className="hidden md:flex absolute top-1/2 -translate-y-1/2 end-3 w-10 h-10 rounded-full bg-white/90 shadow-soft items-center justify-center text-gray-800 opacity-0 group-hover:opacity-100 hover:bg-white active:scale-90 transition"><ChevronRight className="w-5 h-5 rtl:rotate-180" /></button>
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
            {list.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n === i ? 'w-5 bg-white shadow' : 'w-1.5 bg-white/60'}`} />)}
          </div>
        </>}
      </div>
      {many && (
        <div className="hidden sm:flex gap-2 overflow-x-auto pb-1">
          {list.map((src, n) => (
            <button key={src + n} type="button" onClick={() => { touched(); go(n); }} aria-label={`${alt} ${n + 1}`}
              className={`w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 ring-2 transition ${n === i ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
              <img src={src} alt="" draggable={false} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {full && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center" onClick={() => setFull(false)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setFull(false)} aria-label="Close" className="absolute top-4 end-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25"><X className="w-5 h-5" /></button>
          <img src={list[i]} alt={alt} draggable={false} onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain select-none" />
          {many && <>
            <button type="button" onClick={e => { e.stopPropagation(); setI((i - 1 + list.length) % list.length); }} aria-label="Previous" className="absolute start-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25"><ChevronLeft className="w-6 h-6 rtl:rotate-180" /></button>
            <button type="button" onClick={e => { e.stopPropagation(); setI((i + 1) % list.length); }} aria-label="Next" className="absolute end-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25"><ChevronRight className="w-6 h-6 rtl:rotate-180" /></button>
            <span className="absolute bottom-5 inset-x-0 text-center text-white/80 text-sm">{i + 1} / {list.length}</span>
          </>}
        </div>
      )}
    </div>
  );
}
