'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from '@/components/ui/LocLink';
import { ChevronLeft, ChevronRight, Check, LayoutGrid } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { formatPrice } from '@/lib/utils';

interface Slide { alt?: string; mode?: 'background' | 'side'; id: string; bg?: string; image?: string; badge?: string; title: string; subtitle?: string; description?: string; cta?: string; ctaLink: string; cta2?: string; cta2Link?: string }

const GRADS = ['from-brand-900 to-brand-800', 'from-brand-950 to-brand-800', 'from-brand-800 to-brand-900'];

export function HeroBanner() {
  const { t, L, lang } = useLanguage();
  const settings = useStoreSettings();
  const [banners, setBanners] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetch('/api/banners').then(r => (r.ok ? r.json() : [])).then(d => setBanners(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/categories').then(r => (r.ok ? r.json() : [])).then((d: any[]) => setCats((Array.isArray(d) ? d : []).filter(c => c.isActive !== false && !c.parentId).slice(0, 6))).catch(() => {});
  }, []);

  // Banners created in Admin > Banners replace the default slides.
  const slides: Slide[] = banners.length
    ? banners.map((b, i) => ({ id: b.id, bg: GRADS[i % GRADS.length], image: b.image, alt: L(b, 'imageAlt') || L(b, 'title'), mode: b.imageMode === 'side' ? 'side' as const : 'background' as const, title: L(b, 'title'), subtitle: L(b, 'subtitle'),
        cta: (lang === 'ar' && b.buttonTextAr) ? b.buttonTextAr : (b.buttonText || ''), ctaLink: b.link || '/shop' }))
    : [1, 2, 3].map(n => ({
        id: `s${n}`, bg: GRADS[n - 1], badge: t(`c1_home.s${n}Badge`), title: t(`c1_home.s${n}Title`), subtitle: t(`c1_home.s${n}Sub`), description: t(`c1_home.s${n}Desc`),
        cta: t(`c1_home.s${n}Cta`), ctaLink: ['/shop/electrical', '/shop/hardware', '/shop/safety'][n - 1],
        cta2: t(`c1_home.s${n}Cta2`), cta2Link: ['/deals', '/contact', '/contact'][n - 1],
      }));

  const count = slides.length;
  const go = useCallback((i: number) => setCurrent(((i % count) + count) % count), [count]);
  useEffect(() => { if (current >= count) setCurrent(0); }, [count, current]);
  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [count, current]);

  const slide = slides[Math.min(current, count - 1)];
  const th = settings.freeShippingThreshold;

  return (
    <section className="container-custom pt-3 md:pt-6" aria-label={t('c1_home.heroAria')}>
    <div className={`relative overflow-hidden rounded-3xl md:rounded-[2rem] bg-gradient-to-br ${slide.bg} shadow-card transition-colors duration-700`}>
      {slide.image && slide.mode !== 'side' && (
        <>
          <div role="img" aria-label={slide.alt} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${slide.image}")` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent rtl:bg-gradient-to-l" />
        </>
      )}
      <div className="relative px-5 sm:px-8 lg:px-12 py-9 md:py-14 lg:py-16 pb-14">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div key={slide.id} className="animate-fade-in">
            {slide.badge && <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-brand-950 bg-accent-500 mb-4">{slide.badge}</span>}
            <h1 className="text-[1.75rem] md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.15] mb-2 font-display">{slide.title}</h1>
            {slide.subtitle && <p className="text-white/85 font-medium mb-4 text-base md:text-lg">{slide.subtitle}</p>}
            {slide.description && <p className="text-white/70 text-sm md:text-base mb-8 leading-relaxed max-w-lg">{slide.description}</p>}
            <div className="flex flex-wrap gap-3">
              {slide.cta && <Link href={slide.ctaLink} className="inline-flex items-center gap-2 px-6 py-3 bg-accent-500 text-brand-950 font-bold rounded-full shadow-soft hover:bg-accent-400 active:scale-[0.98] transition">{slide.cta}</Link>}
              {slide.cta2 && <Link href={slide.cta2Link || '/shop'} className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-full border border-white/40 hover:bg-white/10 active:scale-[0.98] transition">{slide.cta2}</Link>}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-8 text-brand-100 text-sm">
              {th ? <span className="flex items-center gap-1.5"><Check className="w-4 h-4" />{t('c1_home.heroShip', { amount: formatPrice(th) })}</span> : null}
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4" />{t('c1_home.heroReturns')}</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4" />{t('c1_home.heroSecure')}</span>
            </div>
          </div>

          {slide.image && slide.mode === 'side' && (
            <div className="flex justify-center md:justify-end">
              <img src={slide.image} alt={slide.alt || slide.title} className="max-h-64 md:max-h-80 w-auto max-w-full object-contain rounded-3xl bg-white/10 p-3 shadow-2xl" />
            </div>
          )}
          {!slide.image && cats.length > 0 && (
            <div className="hidden md:block">
              <div className="bg-white/95 backdrop-blur rounded-3xl p-5 shadow-hover">
                <p className="text-brand-900 font-bold mb-2 flex items-center gap-2"><LayoutGrid className="w-4 h-4" />{t('c1_home.browse')}</p>
                <div className="grid grid-cols-2 gap-x-6">
                  {cats.map(c => (
                    <Link key={c.id} href={`/shop/${c.slug}`} className="border-b border-gray-100 py-2.5 text-brand-800 text-sm font-semibold hover:text-brand-600 hover:ps-1 transition-all">{L(c, 'name')}</Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {count > 1 && (
        <>
          <button onClick={() => go(current - 1)} className="absolute start-4 bottom-4 hidden sm:flex p-2 bg-white/15 hover:bg-white/30 backdrop-blur-sm text-white rounded-full border border-white/20" aria-label={t('c1_home.prevSlide')}><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => go(current + 1)} className="absolute end-4 bottom-4 hidden sm:flex p-2 bg-white/15 hover:bg-white/30 backdrop-blur-sm text-white rounded-full border border-white/20" aria-label={t('c1_home.nextSlide')}><ChevronRight className="w-5 h-5" /></button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((s, i) => (
              <button key={s.id} onClick={() => go(i)} aria-label={t('c1_home.goSlide', { n: i + 1 })}
                className={`transition-all duration-300 rounded-full ${i === current ? 'w-6 h-2 bg-accent-500' : 'w-2 h-2 bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
    </section>
  );
}
