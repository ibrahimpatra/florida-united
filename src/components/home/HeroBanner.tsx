'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const slides = [
  {
    id: 1,
    title: 'Professional Electrical Supplies',
    subtitle: 'Trusted by Florida Contractors Since 2005',
    description: 'Shop circuit breakers, wiring, panels & more. Best prices guaranteed with next-day delivery.',
    cta: 'Shop Electrical',
    ctaLink: '/shop/electrical',
    ctaSecondary: 'View Deals',
    ctaSecondaryLink: '/deals',
    bg: 'from-brand-800 via-brand-700 to-brand-600',
    badge: '🔥 Up to 40% Off',
    image: '/images/hero-electrical.jpg',
    accent: 'bg-yellow-400',
  },
  {
    id: 2,
    title: 'Complete Hardware Solutions',
    subtitle: 'Everything You Need in One Place',
    description: 'From fasteners to power tools, we carry 50,000+ SKUs. Same-day pickup available at our Miami store.',
    cta: 'Shop Hardware',
    ctaLink: '/shop/hardware',
    ctaSecondary: 'Find a Store',
    ctaSecondaryLink: '/contact',
    bg: 'from-gray-900 via-gray-800 to-gray-700',
    badge: '🛠 50,000+ Products',
    image: '/images/hero-hardware.jpg',
    accent: 'bg-accent-500',
  },
  {
    id: 3,
    title: 'Safety First — Always',
    subtitle: 'OSHA-Compliant Safety Equipment',
    description: 'Protect your team with premium PPE, safety signs, and fire protection equipment. Bulk pricing available.',
    cta: 'Shop Safety',
    ctaLink: '/shop/safety',
    ctaSecondary: 'Get a Quote',
    ctaSecondaryLink: '/contact',
    bg: 'from-orange-800 via-orange-700 to-amber-600',
    badge: '✅ OSHA Compliant',
    image: '/images/hero-safety.jpg',
    accent: 'bg-brand-500',
  },
];

export function HeroBanner() {
  const [current, setCurrent] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const goTo = (index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrent(index);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const prev = () => goTo((current - 1 + slides.length) % slides.length);
  const next = () => goTo((current + 1) % slides.length);

  useEffect(() => {
    const timer = setInterval(next, 5500);
    return () => clearInterval(timer);
  }, [current]);

  const slide = slides[current];

  return (
    <section
      className={`relative overflow-hidden bg-gradient-to-r ${slide.bg} transition-all duration-700`}
      aria-label="Hero banner"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative container-custom py-14 md:py-20 lg:py-24">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Content */}
          <div
            className={`transition-all duration-500 ${isAnimating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
          >
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white ${slide.accent} mb-4`}>
              {slide.badge}
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-2 font-display">
              {slide.title}
            </h1>
            <p className="text-blue-100 font-medium mb-4 text-lg">{slide.subtitle}</p>
            <p className="text-blue-200 text-sm md:text-base mb-8 leading-relaxed max-w-lg">
              {slide.description}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={slide.ctaLink}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-700 font-bold rounded-xl hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                {slide.cta}
              </Link>
              <Link
                href={slide.ctaSecondaryLink}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
              >
                {slide.ctaSecondary}
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-4 mt-8 text-blue-100 text-sm">
              <span className="flex items-center gap-1.5">✓ Free shipping $99+</span>
              <span className="flex items-center gap-1.5">✓ 30-day returns</span>
              <span className="flex items-center gap-1.5">✓ Secure checkout</span>
            </div>
          </div>

          {/* Image / Illustration */}
          <div className={`hidden md:flex justify-center transition-all duration-500 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            <div className="relative w-full max-w-md">
              <div className="absolute inset-0 bg-white/10 rounded-3xl blur-3xl" />
              <div className="relative bg-white/15 backdrop-blur-sm rounded-3xl p-8 border border-white/20 shadow-2xl">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: '⚡', label: 'Electrical', count: '8,500+' },
                    { icon: '🔧', label: 'Hardware', count: '15,000+' },
                    { icon: '🛡', label: 'Safety', count: '3,200+' },
                    { icon: '💡', label: 'Lighting', count: '4,100+' },
                    { icon: '🔩', label: 'Fasteners', count: '12,000+' },
                    { icon: '🏗', label: 'Industrial', count: '7,600+' },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/20 rounded-xl p-3 text-center text-white">
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-xs text-blue-200">{item.count}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-white/20 rounded-xl p-4 text-white text-center">
                  <div className="text-2xl font-bold">50,000+</div>
                  <div className="text-sm text-blue-200">Products Available</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded-xl transition-all duration-200 border border-white/20"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded-xl transition-all duration-200 border border-white/20"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`transition-all duration-300 rounded-full ${
              i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
