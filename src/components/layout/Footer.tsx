import Link from 'next/link';
import { SITE_CONFIG } from '@/lib/siteConfig';
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter, Youtube, Shield, Truck, RotateCcw, CreditCard } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="container-custom py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg font-display">{SITE_CONFIG.logoText}</span>
              </div>
              <div>
                <div className="text-white font-bold text-lg font-display">{SITE_CONFIG.name}</div>
                <div className="text-gray-400 text-xs">{SITE_CONFIG.tagline}</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
              {SITE_CONFIG.metaDesc}
            </p>
            <div className="space-y-2.5 text-sm">
              <a href={`tel:${SITE_CONFIG.phoneTel}`} className="flex items-center gap-2.5 hover:text-white transition-colors">
                <Phone className="w-4 h-4 text-brand-400" />
                {SITE_CONFIG.phone}
              </a>
              <a href={`mailto:${SITE_CONFIG.email}`} className="flex items-center gap-2.5 hover:text-white transition-colors">
                <Mail className="w-4 h-4 text-brand-400" />
                info@floridakuwait.com
              </a>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                <span>{SITE_CONFIG.addressFull}</span>
              </div>
            </div>
            {/* Socials */}
            <div className="flex gap-3 mt-6">
              {[
                { Icon: Facebook, href: '#', label: 'Facebook' },
                { Icon: Instagram, href: '#', label: 'Instagram' },
                { Icon: Twitter, href: '#', label: 'Twitter' },
                { Icon: Youtube, href: '#', label: 'YouTube' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 bg-gray-800 hover:bg-brand-600 rounded-lg flex items-center justify-center transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Shop</h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'All Products', href: '/shop' },
                { label: 'Electrical Supplies', href: '/shop/electrical' },
                { label: 'Hardware & Tools', href: '/shop/hardware' },
                { label: 'Safety Equipment', href: '/shop/safety' },
                { label: 'Lighting', href: '/shop/lighting' },
                { label: 'Industrial', href: '/shop/industrial' },
                { label: 'New Arrivals', href: '/shop?new=true' },
                { label: 'Deals & Offers', href: '/deals' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Account</h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'My Account', href: '/account' },
                { label: 'My Orders', href: '/account/orders' },
                { label: 'Track Order', href: '/order-tracking' },
                { label: 'My Wishlist', href: '/account/wishlist' },
                { label: 'Returns', href: '/account/orders' },
                { label: 'Sign In', href: '/auth/login' },
                { label: 'Register', href: '/auth/register' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Information</h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'About Us', href: '/about' },
                { label: 'Contact Us', href: '/contact' },
                { label: 'Shipping Policy', href: '/shipping' },
                { label: 'Return Policy', href: '/returns' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Sitemap', href: '/sitemap.xml' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="hover:text-white hover:translate-x-1 inline-block transition-all duration-200">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Trust Badges Row */}
      <div className="border-t border-gray-800">
        <div className="container-custom py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { Icon: Shield, title: 'Secure Payments', desc: 'SSL encrypted checkout' },
              { Icon: Truck, title: 'Free Shipping', desc: `On orders over KWD ${SITE_CONFIG.freeShippingThreshold}` },
              { Icon: RotateCcw, title: '30-Day Returns', desc: 'Hassle-free returns' },
              { Icon: CreditCard, title: 'Multiple Payments', desc: 'Card, GPay & more' },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{title}</p>
                  <p className="text-gray-500 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800 py-5">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} {SITE_CONFIG.fullName}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>We accept:</span>
            <div className="flex gap-2">
              {['VISA', 'MC', 'COD', 'GPAY', 'KNET'].map((p) => (
                <span key={p} className="px-2 py-0.5 bg-gray-800 rounded text-gray-400 font-medium text-xs">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
