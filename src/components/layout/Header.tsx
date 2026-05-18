'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import {
  ShoppingCart, Search, User, Menu, X, ChevronDown,
  Phone, Heart, Bell, LogOut, Package, Settings, LayoutDashboard,
  MapPin, Truck, Star
} from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { SITE_CONFIG } from '@/lib/siteConfig';
import { useWishlistStore } from '@/store/wishlistStore';
import { SearchModal } from '@/components/layout/SearchModal';
import { MiniCart } from '@/components/cart/MiniCart';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Category } from '@/types';

export function Header() {
  const { data: session } = useSession();
  const { t, dir } = useLanguage();
  const { items: cartItems } = useCartStore();
  const { items: wishlistItems } = useWishlistStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Fetch root categories for nav bar
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then((cats: Category[]) => setCategories(cats.filter(c => c.isActive && !c.parentId && (c.showOnNav ?? true))))
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
            ? 'bg-white/95 backdrop-blur-md shadow-md'
            : 'bg-white shadow-sm'
        }`}
      >
        {/* Top Bar */}
        <div className="bg-brand-700 text-white text-xs py-2 hidden md:block">
          <div className="container-custom flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3 h-3" />
                <a href={`tel:${SITE_CONFIG.phoneTel}`} className="hover:text-blue-200 transition-colors">
                  +965 2222 5050
                </a>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                {SITE_CONFIG.addressLine2} | Serving all of Kuwait
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3 h-3" />
                {t('nav.freeShipping')} KWD {SITE_CONFIG.freeShippingThreshold}
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="w-3 h-3" />
                Trusted Since 2005
              </span>
              <LanguageToggle />
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="container-custom">
          <div className="flex items-center gap-4 py-3 md:py-4">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Logo */}
            <Link href="/" className="flex-shrink-0 flex items-center gap-2 md:gap-3" aria-label={`${SITE_CONFIG.fullName} - Home`}>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg font-display">{SITE_CONFIG.logoText}</span>
              </div>
              <div className="hidden xs:block">
                <div className="text-brand-700 font-bold text-base md:text-lg leading-tight font-display">
                  Florida Kuwait
                </div>
                <div className="text-gray-500 text-xs leading-tight">{SITE_CONFIG.tagline}</div>
              </div>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="flex-1 hidden md:block max-w-xl lg:max-w-2xl">
              <button
                onClick={() => setSearchOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 hover:border-brand-300 hover:bg-blue-50/30 transition-all duration-200 text-sm"
                aria-label="Search products"
              >
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>Search hardware, electrical, tools...</span>
                <kbd className="ml-auto hidden lg:flex items-center gap-1 text-xs text-gray-300 border border-gray-200 rounded px-1.5 py-0.5 bg-white">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1 ml-auto md:ml-0">
              {/* Search Mobile */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
              >
                <Search className="w-5 h-5 text-gray-700" />
              </button>

              {/* Wishlist */}
              <Link
                href="/account/wishlist"
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors hidden sm:flex items-center"
                aria-label={`Wishlist (${wishlistItems.length} items)`}
              >
                <Heart className="w-5 h-5 text-gray-700" />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {wishlistItems.length > 9 ? '9+' : wishlistItems.length}
                  </span>
                )}
              </Link>

              {/* Account */}
              <div className="relative" ref={dropdownRef}>
                {session ? (
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Account menu"
                    aria-expanded={userMenuOpen}
                  >
                    <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-semibold text-sm">
                      {session.user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 hidden md:block transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <User className="w-5 h-5 text-gray-700" />
                    <span className="text-sm font-medium text-gray-700 hidden md:block">{t('nav.signIn')}</span>
                  </Link>
                )}

                {/* User Dropdown */}
                {userMenuOpen && session && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 animate-slide-down z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-semibold text-gray-900 text-sm truncate">{session.user?.name}</p>
                      <p className="text-gray-400 text-xs truncate">{session.user?.email}</p>
                    </div>
                    {session.user?.role === 'ADMIN' && (
                      <Link href="/admin/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-600 hover:bg-brand-50 font-semibold transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}
                    <Link href="/account" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <User className="w-4 h-4" /> My Account
                    </Link>
                    <Link href="/account/orders" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Package className="w-4 h-4" /> My Orders
                    </Link>
                    <Link href="/account/wishlist" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Heart className="w-4 h-4" /> Wishlist
                    </Link>
                    <Link href="/account/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-4 h-4" /> Settings
                    </Link>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cart */}
              <button
                onClick={() => setMiniCartOpen(true)}
                className="relative flex items-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-all duration-200 shadow-sm"
                aria-label={`Shopping cart (${cartCount} items)`}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="w-5 h-5 bg-accent-500 text-white text-xs rounded-full flex items-center justify-center font-bold absolute -top-1.5 -right-1.5">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
                <span className="text-sm font-semibold hidden md:block">Cart</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden md:block border-t border-gray-100 bg-white" aria-label="Main navigation">
          <div className="container-custom">
            <ul className="flex items-center gap-0">
              <li>
                <Link
                  href="/"
                  className="flex items-center px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors border-b-2 border-brand-600"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link href="/shop" className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-brand-700 hover:bg-brand-50 transition-colors border-b-2 border-transparent hover:border-brand-300">
                  All Products
                </Link>
              </li>
              {categories.map((cat) => {
                return (
                <li key={cat.slug} className="relative group">
                  <button
                    onMouseEnter={() => setActiveCategory(cat.slug)}
                    onMouseLeave={() => setActiveCategory(null)}
                    className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-gray-700 hover:text-brand-700 hover:bg-brand-50 transition-colors border-b-2 border-transparent hover:border-brand-300"
                  >
                    {cat.name}
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  {/* Dropdown */}
                  <div
                    onMouseEnter={() => setActiveCategory(cat.slug)}
                    onMouseLeave={() => setActiveCategory(null)}
                    className={`absolute left-0 top-full w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 transition-all duration-200 ${
                      activeCategory === cat.slug
                        ? 'opacity-100 visible translate-y-0'
                        : 'opacity-0 invisible -translate-y-2'
                    }`}
                  >
                    <Link
                      href={`/shop/${cat.slug}`}
                      className="block px-4 py-2 text-sm text-brand-600 font-semibold hover:bg-brand-50 transition-colors"
                    >
                      View All {cat.name} →
                    </Link>
                  </div>
                </li>
                );
              })}
              <li>
                <Link href="/deals" className="flex items-center gap-1 px-4 py-3 text-sm font-semibold text-accent-600 hover:bg-accent-50 transition-colors border-b-2 border-transparent hover:border-accent-300">
                  🔥 Deals
                </Link>
              </li>
              <li>
                <Link href="/contact" className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-brand-700 hover:bg-brand-50 transition-colors border-b-2 border-transparent hover:border-brand-300">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
            <div
              className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-brand-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{SITE_CONFIG.logoText}</span>
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{SITE_CONFIG.name}</div>
                      <div className="text-blue-200 text-xs">{SITE_CONFIG.tagline}</div>
                    </div>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-white/80 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {session ? (
                  <div className="mt-3 bg-white/10 rounded-xl p-3 text-white">
                    <p className="font-semibold text-sm">{session.user?.name}</p>
                    <p className="text-blue-200 text-xs">{session.user?.email}</p>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Link href="/auth/login" className="flex-1 text-center py-2 bg-white text-brand-700 rounded-lg text-sm font-semibold">
                      Sign In
                    </Link>
                    <Link href="/auth/register" className="flex-1 text-center py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold border border-white/30">
                      Register
                    </Link>
                  </div>
                )}
              </div>
              <nav className="p-4">
                <Link href="/" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-800 font-semibold">
                  Home
                </Link>
                <Link href="/shop" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-700">
                  All Products
                </Link>
                {categories.map((cat) => (
                  <div key={cat.slug}>
                    <Link href={`/shop/${cat.slug}`} className="flex items-center justify-between py-3 border-b border-gray-100 text-gray-700 font-medium">
                      <span className="flex items-center gap-2">{cat.icon && <span>{cat.icon}</span>}{cat.name}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </Link>
                  </div>
                ))}
                <Link href="/deals" className="flex items-center gap-3 py-3 border-b border-gray-100 text-accent-600 font-semibold">
                  🔥 Deals & Offers
                </Link>
                <Link href="/order-tracking" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-700">
                  Track Order
                </Link>
                <Link href="/contact" className="flex items-center gap-3 py-3 border-b border-gray-100 text-gray-700">
                  Contact Us
                </Link>
                {session && (
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex items-center gap-3 py-3 text-red-600 font-medium w-full"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                )}
              </nav>
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <a href={`tel:${SITE_CONFIG.phoneTel}`} className="flex items-center gap-2 text-brand-700 font-semibold text-sm">
                  <Phone className="w-4 h-4" /> +965 2222 5050
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
