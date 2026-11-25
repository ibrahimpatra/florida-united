'use client';
import Link from '@/components/ui/LocLink';
import { cachedJson } from '@/lib/client-cache';
import { useBrand } from '@/contexts/BrandContext';
import { BrandMark } from '@/components/layout/BrandMark';
import { useEffect, useState } from 'react';
import { Phone, Mail, MapPin, Shield, Truck, RotateCcw, CreditCard } from 'lucide-react';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const SITE_CONFIG = useBrand();
  const { t, L, dir, isArabic } = useLanguage();
  const { freeShippingThreshold } = useStoreSettings();
  const [cats, setCats] = useState<any[]>([]);
  useEffect(() => {
    cachedJson<any[]>('/api/categories').then((d: any[]) => setCats((Array.isArray(d) ? d : []).filter(c => c.isActive !== false && !c.parentId).slice(0, 6))).catch(() => {});
  }, []);
  return (
    <footer dir={dir} className="bg-brand-950 text-gray-300 rounded-t-[2rem] md:rounded-t-[2.5rem] mt-10 overflow-hidden">
      {/* Main Footer */}
      <div className="container-custom py-10 md:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg font-display"><BrandMark /></span>
              </div>
              <div>
                <div className="text-white font-bold text-lg font-display">{isArabic ? SITE_CONFIG.fullNameAr : SITE_CONFIG.name}</div>
                <div className="text-gray-400 text-xs">{isArabic ? SITE_CONFIG.taglineAr : SITE_CONFIG.tagline}</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
              {t('c1_foot.about')}
            </p>
            <div className="space-y-2.5 text-sm">
              <a href={`tel:${SITE_CONFIG.phoneTel}`} className="flex items-center gap-2.5 hover:text-white transition-colors">
                <Phone className="w-4 h-4 text-brand-400" />
                <span dir="ltr">{SITE_CONFIG.phone}</span>
              </a>
              <a href={`mailto:${SITE_CONFIG.email}`} className="flex items-center gap-2.5 hover:text-white transition-colors">
                <Mail className="w-4 h-4 text-brand-400" />
                <span dir="ltr">{SITE_CONFIG.email}</span>
              </a>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                <span>{isArabic ? SITE_CONFIG.addressFullAr : SITE_CONFIG.addressFull}</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4">{t('c1_foot.shop')}</h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { k: 'allProducts', href: '/shop' }, { k: 'newArrivals', href: '/shop?new=true' },
                { k: 'bundles', href: '/bundles' }, { k: 'deals', href: '/deals' },
              ].map(({ k, href }) => (
                <li key={k}><Link href={href} className="hover:text-white inline-block transition-colors duration-200">{t(`c1_foot.${k}`)}</Link></li>
              ))}
              {cats.map(c => (
                <li key={c.id}><Link href={`/shop/${c.slug}`} className="hover:text-white inline-block transition-colors duration-200">{L(c, 'name')}</Link></li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4">{t('c1_foot.account')}</h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { k: 'myAccount', href: '/account' }, { k: 'myOrders', href: '/account/orders' }, { k: 'track', href: '/order-tracking' },
                { k: 'wishlist', href: '/account/wishlist' }, { k: 'signIn', href: '/auth/login' }, { k: 'register', href: '/auth/register' },
              ].map(({ k, href }) => (
                <li key={k}><Link href={href} className="hover:text-white inline-block transition-colors duration-200">{t(`c1_foot.${k}`)}</Link></li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="text-white font-bold text-sm mb-4">{t('c1_foot.info')}</h3>
            <ul className="space-y-2.5 text-sm">
              {[{ k: 'about', href: '/about' }, { k: 'shipPolicy', href: '/shipping-info' }, { k: 'returnPolicy', href: '/returns-policy' },
                { k: 'terms', href: '/terms' }, { k: 'privacy', href: '/privacy' }, { k: 'contact', href: '/contact' }].map(({ k, href }) => (
                <li key={k}><Link href={href} className="hover:text-white inline-block transition-colors duration-200">{t(`c1_foot.${k}`)}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Trust Badges Row */}
      <div className="border-t border-white/10">
        <div className="container-custom py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { Icon: Shield, title: t('c1_foot.secure'), desc: t('c1_foot.secureD') },
              { Icon: Truck, title: t('c1_foot.ship'), desc: freeShippingThreshold ? t('c1_foot.shipD', { amount: formatPrice(freeShippingThreshold) }) : '' },
              { Icon: RotateCcw, title: t('c1_foot.ret'), desc: t('c1_foot.retD') },
              { Icon: CreditCard, title: t('c1_foot.pay'), desc: t('c1_foot.payD') },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0">
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
      <div className="border-t border-white/10 py-5">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} {isArabic ? SITE_CONFIG.fullNameAr : SITE_CONFIG.fullName}. {t('footer.rights')}.</p>
          <div className="flex items-center gap-4">
            <span>{t('c1_foot.accept')}:</span>
            <div className="flex gap-2">
              {[t('c1_foot.card'), t('c1_foot.cod')].map((p) => (
                <span key={p} className="px-2.5 py-0.5 bg-white/10 rounded-full text-gray-300 font-medium text-xs">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
