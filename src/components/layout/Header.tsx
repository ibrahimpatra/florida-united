'use client';

import { useState, useEffect, useRef } from 'react';
import { cachedJson } from '@/lib/client-cache';
import Link from '@/components/ui/LocLink';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import {
  ShoppingCart, Search, User, Menu, X, ChevronDown,
  Phone, Heart, Bell, LogOut, Package, Settings, LayoutDashboard,
  MapPin, Truck, Package2
} from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useBrand } from '@/contexts/BrandContext';
import { BrandMark } from '@/components/layout/BrandMark';
import { useWishlistStore } from '@/store/wishlistStore';
import { SearchModal } from '@/components/layout/SearchModal';
import { MiniCart } from '@/components/cart/MiniCart';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { formatPrice } from '@/lib/utils';
import type { Category } from '@/types';

export function Header() {
  const SITE_CONFIG = useBrand();
  const { data: session } = useSession();
  const pathname = (usePathname() || '/').replace(/^\/ar(?=\/|$)/, '') || '/';
  const navOn = (p: string) => (p === '/' ? pathname === '/' : pathname.startsWith(p));
  const { t, L, dir, isArabic } = useLanguage();
  const { freeShippingThreshold } = useStoreSettings();
  const tagline = isArabic ? SITE_CONFIG.taglineAr : SITE_CONFIG.tagline;
  const brandName = isArabic ? SITE_CONFIG.fullNameAr : SITE_CONFIG.name;
  const { items: cartItems } = useCartStore();
  const { items: wishlistItems } = useWishlistStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCats, setAllCats] = useState<Category[]>([]);
  const [pop, setPop] = useState<{ slug: string; left: number; top: number } | null>(null);   // category menu (drawn outside the scrolling row so it is never clipped)
  const [mobCat, setMobCat] = useState<string | null>(null);
  const popTimer = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const cartCount = cartItems.reduce((sum, item) => item.unavailable ? sum : sum + item.quantity, 0);

  // Fetch root categories for nav bar
  useEffect(() => {
    cachedJson<Category[]>('/api/categories')
      .then((cats: Category[]) => { const on = cats.filter(c => c.isActive !== false); setAllCats(on); setCategories(on.filter(c => !c.parentId && (c.showOnNav ?? true))); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveCategory(null);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <div dir={dir}>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-white/90 backdrop-blur-xl shadow-soft'
            : 'bg-white'
        }`}
      >
        {/* Top Bar */}
        <div className="bg-brand-900 text-white/85 text-[11px] py-1.5 hidden md:block">
          <div className="container-custom flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3 h-3" />
                <a href={`tel:${SITE_CONFIG.phoneTel}`} className="hover:text-brand-200 transition-colors">
                  <span dir="ltr">{SITE_CONFIG.phone}</span>
                </a>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[26rem]">{isArabic ? SITE_CONFIG.addressFullAr : SITE_CONFIG.addressLine2}</span> | {t('c1_nav.serving')}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {freeShippingThreshold ? (
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3 h-3" />
                  {t('c1_nav.freeShipOver', { amount: formatPrice(freeShippingThreshold) })}
                </span>
              ) : null}
              <LanguageToggle onDark />
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="container-custom">
          <div className="flex items-center gap-4 py-3 md:py-4">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={t('c1_nav.toggleMenu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Logo */}
            <Link href="/" className="flex-shrink-0 flex items-center gap-2 md:gap-3" aria-label={t('c1_nav.homeAria', { name: brandName })}>
              <div className="w-10 h-10 md:w-11 md:h-11 bg-brand-700 rounded-2xl flex items-center justify-center shadow-soft">
                <span className="text-white font-bold text-lg font-display"><BrandMark /></span>
              </div>
              <div className="hidden xs:block">
                <div className="text-brand-700 font-bold text-base md:text-lg leading-tight font-display">
                  {brandName}
                </div>
                <div className="text-gray-500 text-xs leading-tight">{tagline}</div>
              </div>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="flex-1 hidden md:block max-w-xl lg:max-w-2xl">
              <button
                onClick={() => setSearchOpen(true)}
                className="w-full flex items-center gap-3 px-5 py-3 bg-gray-100/80 border border-transparent rounded-full text-gray-400 hover:bg-gray-100 hover:border-gray-200 transition-all duration-200 text-sm"
                aria-label={t('c1_nav.searchProducts')}
              >
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{t('c1_nav.searchHint')}</span>
                <kbd className="ms-auto hidden lg:flex items-center gap-1 text-[11px] text-gray-400 rounded-full px-2 py-0.5 bg-white">
                  Ctrl K
                </kbd>
              </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-0 sm:gap-1 ms-auto md:ms-0">
              <div className="md:hidden me-1"><LanguageToggle /></div>
              {/* Search Mobile */}
              <button
                className="md:hidden w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setSearchOpen(true)}
                aria-label={t('c1_nav.search')}
              >
                <Search className="w-5 h-5 text-gray-700" />
              </button>

              {session && <NotificationBell />}

              {/* Wishlist */}
              <Link
                href="/account/wishlist"
                className="relative w-10 h-10 rounded-full hover:bg-gray-100 transition-colors hidden sm:flex items-center justify-center"
                aria-label={t('c1_nav.wishlistAria', { n: wishlistItems.length })}
              >
                <Heart className="w-5 h-5 text-gray-700" />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {wishlistItems.length > 9 ? '9+' : wishlistItems.length}
                  </span>
                )}
              </Link>

              {/* Account */}
              <div className="relative" ref={dropdownRef}>
                {session ? (
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label={t('c1_nav.accountMenu')}
                    aria-expanded={userMenuOpen}
                  >
                    <div className="w-9 h-9 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-semibold text-sm">
                      {session.user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 hidden md:block transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <User className="w-5 h-5 text-gray-700" />
                    <span className="text-sm font-medium text-gray-700 hidden md:block">{t('nav.signIn')}</span>
                  </Link>
                )}

                {/* User Dropdown */}
                {userMenuOpen && session && (
                  <div className="absolute end-0 top-full mt-2 w-60 bg-white rounded-3xl shadow-hover border border-gray-100 py-2 animate-slide-down z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-semibold text-gray-900 text-sm truncate">{session.user?.name}</p>
                      <p className="text-gray-400 text-xs truncate">{session.user?.email}</p>
                    </div>
                    {String(session.user?.role).toLowerCase() === 'admin' && (
                      <Link href="/admin/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-600 hover:bg-brand-50 font-semibold transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> {t('c1_nav.adminPanel')}
                      </Link>
                    )}
                    <Link href="/account" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <User className="w-4 h-4" /> {t('c1_nav.myAccount')}
                    </Link>
                    <Link href="/account/orders" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Package className="w-4 h-4" /> {t('c1_nav.myOrders')}
                    </Link>
                    <Link href="/account/addresses" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <MapPin className="w-4 h-4" /> {t('nav.addresses')}
                    </Link>
                    <Link href="/account/wishlist" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Heart className="w-4 h-4" /> {t('c1_nav.wishlist')}
                    </Link>
                    <Link href="/account/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-4 h-4" /> {t('c1_nav.settings')}
                    </Link>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> {t('c1_nav.signOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cart */}
              <button
                onClick={() => setMiniCartOpen(true)}
                className="relative flex items-center gap-2 px-3 md:px-4 h-10 bg-brand-800 text-white rounded-full hover:bg-brand-900 active:scale-95 transition-all duration-150 shadow-soft"
                aria-label={t('c1_nav.cartAria', { n: cartCount })}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="w-5 h-5 bg-accent-500 text-brand-950 text-xs rounded-full flex items-center justify-center font-bold absolute -top-1.5 -end-1.5">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
                <span className="text-sm font-semibold hidden md:block">{t('c1_nav.cart')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden md:block bg-white" aria-label={t('c1_nav.mainNav')}>
          <div className="container-custom">
            <ul className="flex items-center gap-1 pb-2.5">
              <li>
                <Link
                  href="/"
                  className={`flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-colors ${navOn('/') ? 'bg-brand-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {t('c1_nav.home')}
                </Link>
              </li>
              <li>
                <Link href="/shop" className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${navOn('/shop') ? 'bg-brand-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                  {t('c1_nav.allProducts')}
                </Link>
              </li>
              <li className="min-w-0 flex-1">
                {/* Categories get their own row space: it scrolls sideways (thin bar) when there are many */}
                <div className="thin-scroll overflow-x-auto overflow-y-hidden whitespace-nowrap flex items-center gap-1 pb-1.5 -mb-1.5" onScroll={() => setPop(null)}>
                  {categories.map((cat) => {
                    const kids = allCats.filter(c => c.parentId === cat.id);
                    return (
                      <Link key={cat.slug} href={`/shop/${cat.slug}`}
                        onMouseEnter={e => { clearTimeout(popTimer.current); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPop({ slug: cat.slug, left: r.left, top: r.bottom }); }}
                        onMouseLeave={() => { popTimer.current = setTimeout(() => setPop(null), 160); }}
                        className="flex-none flex items-center gap-1 px-3.5 py-2 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                        {L(cat, 'name')}
                        {kids.length > 0 && <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
                      </Link>
                    );
                  })}
                </div>
              </li>
              <li>
                <Link href="/bundles" className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                  <Package2 className="w-4 h-4" /> {t('c1_nav.bundles')}
                </Link>
              </li>
              <li>
                <Link href="/deals" className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-accent-700 bg-accent-50 hover:bg-accent-100 transition-colors">
                  {t('c1_nav.deals')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="flex items-center px-4 py-2 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                  {t('c1_nav.contact')}
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        {pop && (() => {
          const cat = categories.find(c => c.slug === pop.slug); if (!cat) return null;
          const kids = allCats.filter(c => c.parentId === cat.id);
          const w = 240; const left = Math.max(8, Math.min(pop.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - w - 8));
          return (
            <div onMouseEnter={() => clearTimeout(popTimer.current)} onMouseLeave={() => setPop(null)} style={{ position: 'fixed', top: pop.top + 2, left, width: w }}
              className="hidden md:block z-50 bg-white rounded-2xl shadow-hover border border-gray-100 py-2 max-h-[70vh] overflow-y-auto thin-scroll">
              <Link href={`/shop/${cat.slug}`} onClick={() => setPop(null)} className="block px-4 py-2 text-sm text-brand-700 font-semibold hover:bg-brand-50 transition-colors">{t('c1_nav.viewAllIn', { name: L(cat, 'name') })}</Link>
              {kids.map(k => <Link key={k.id} href={`/shop/${k.slug}`} onClick={() => setPop(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-700 transition-colors">{L(k, 'name')}</Link>)}
            </div>
          );
        })()}

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" onClick={() => setMobileMenuOpen(false)}>
            <div
              className="absolute start-0 top-0 bottom-0 w-80 max-w-[88vw] bg-white shadow-2xl overflow-y-auto rounded-e-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 bg-brand-800 rounded-be-3xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold text-lg"><BrandMark /></span>
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{brandName}</div>
                      <div className="text-brand-200 text-xs">{tagline}</div>
                    </div>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-white/80 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {session ? (
                  <div className="mt-3 bg-white/10 rounded-2xl p-3 text-white">
                    <p className="font-semibold text-sm">{session.user?.name}</p>
                    <p className="text-brand-200 text-xs">{session.user?.email}</p>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Link href="/auth/login" className="flex-1 text-center py-2.5 bg-white text-brand-800 rounded-full text-sm font-semibold">
                      {t('nav.signIn')}
                    </Link>
                    <Link href="/auth/register" className="flex-1 text-center py-2.5 bg-brand-600 text-white rounded-full text-sm font-semibold border border-white/30">
                      {t('c1_nav.register')}
                    </Link>
                  </div>
                )}
              </div>
              <nav className="p-4">
                <Link href="/" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-800 font-semibold">
                  {t('c1_nav.home')}
                </Link>
                <Link href="/shop" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-700">
                  {t('c1_nav.allProducts')}
                </Link>
                {categories.map((cat) => {
                  const kids = allCats.filter(c => c.parentId === cat.id); const open = mobCat === cat.slug;
                  return (
                    <div key={cat.slug} className="border-b border-gray-100">
                      <div className="flex items-center">
                        <Link href={`/shop/${cat.slug}`} className="flex-1 py-3 text-gray-700 font-medium">{L(cat, 'name')}</Link>
                        {kids.length > 0 && <button type="button" aria-label="Sub-categories" onClick={() => setMobCat(open ? null : cat.slug)} className="p-3 text-gray-400"><ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} /></button>}
                      </div>
                      {open && <div className="pb-2 ps-3">{kids.map(k => <Link key={k.id} href={`/shop/${k.slug}`} className="block py-2 text-sm text-gray-600">{L(k, 'name')}</Link>)}</div>}
                    </div>
                  );
                })}
                <Link href="/bundles" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-700 font-semibold">
                  <Package2 className="w-4 h-4" /> {t('c1_nav.bundles')}
                </Link>
                <Link href="/deals" className="flex items-center gap-3 py-3 border-b border-gray-100 text-accent-600 font-semibold">
                  {t('c1_nav.dealsOffers')}
                </Link>
                <Link href="/order-tracking" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-700">
                  {t('c1_nav.trackOrder')}
                </Link>
                <Link href="/contact" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-700">
                  {t('c1_nav.contactUs')}
                </Link>
                {session && (
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex items-center gap-3 py-3 text-red-600 font-medium w-full"
                  >
                    <LogOut className="w-4 h-4" /> {t('c1_nav.signOut')}
                  </button>
                )}
              </nav>
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <a href={`tel:${SITE_CONFIG.phoneTel}`} className="flex items-center gap-2 text-brand-700 font-semibold text-sm">
                  <Phone className="w-4 h-4" /> <span dir="ltr">{SITE_CONFIG.phone}</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mini Cart */}
      <MiniCart isOpen={miniCartOpen} onClose={() => setMiniCartOpen(false)} />
    </div>
  );
}
