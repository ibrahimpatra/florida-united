'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Home, LayoutGrid, ShoppingBag, Heart, User } from 'lucide-react';
import Link from '@/components/ui/LocLink';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useLanguage } from '@/contexts/LanguageContext';

/** Pages where a bottom bar would only get in the way (focused flows and the admin area). */
const HIDE = ['/admin', '/checkout', '/auth', '/order-success'];
/** Product pages show their own bottom bar (price + Add to cart) instead of the tabs */
const OWN_BAR = ['/shop/products'];

/** Floating bottom bar for phones: Home, Shop, Cart, Saved, Account. The tab you are on opens up to show its name. */
export function MobileNav() {
  const raw = usePathname() || '/';
  const path = raw.replace(/^\/ar(?=\/|$)/, '') || '/';
  const { t, dir } = useLanguage();
  const { data: session } = useSession();
  const cart = useCartStore(s => s.items.reduce((n, i) => (i.unavailable ? n : n + i.quantity), 0));
  const saved = useWishlistStore(s => s.items.length);
  const hidden = HIDE.some(h => path === h || path.startsWith(h + '/'));
  const ownBar = OWN_BAR.some(h => path.startsWith(h + '/'));

  useEffect(() => {
    document.body.classList.toggle('has-bottom-nav', !hidden);
    return () => document.body.classList.remove('has-bottom-nav');
  }, [hidden]);
  if (hidden || ownBar) return null;

  const tabs = [
    { href: '/', label: t('bnav.home'), Icon: Home, on: path === '/' },
    { href: '/shop', label: t('bnav.shop'), Icon: LayoutGrid, on: path.startsWith('/shop') || path.startsWith('/search') || path.startsWith('/p/') },
    { href: '/cart', label: t('bnav.cart'), Icon: ShoppingBag, on: path.startsWith('/cart'), badge: cart },
    { href: '/account/wishlist', label: t('bnav.saved'), Icon: Heart, on: path.startsWith('/account/wishlist'), badge: saved },
    { href: session ? '/account' : '/auth/login', label: t('bnav.account'), Icon: User, on: (path.startsWith('/account') && !path.startsWith('/account/wishlist')) || path.startsWith('/auth') },
  ];
  return (
    <nav dir={dir} aria-label="Main" className="md:hidden fixed inset-x-3 z-40 no-print" style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <ul className="mx-auto max-w-md flex items-center justify-between gap-1 rounded-full bg-brand-900/95 backdrop-blur-md p-1.5 shadow-float">
        {tabs.map(({ href, label, Icon, on, badge }) => (
          <li key={href} className={on ? 'flex-[1.8]' : 'flex-1'}>
            <Link href={href} aria-current={on ? 'page' : undefined}
              className={`relative flex items-center justify-center gap-1.5 h-11 rounded-full text-sm font-semibold transition-all duration-200 ${on ? 'bg-white text-brand-900' : 'text-white/70 active:bg-white/10'}`}>
              <Icon className="w-5 h-5 shrink-0" strokeWidth={on ? 2.4 : 2} />
              {on && <span className="truncate">{label}</span>}
              {!!badge && badge > 0 && (
                <span className={`absolute top-0.5 ${on ? 'end-2' : 'end-1.5'} min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-accent-500 text-brand-950 text-[10px] font-extrabold flex items-center justify-center`}>{badge > 9 ? '9+' : badge}</span>
              )}
              {!on && <span className="sr-only">{label}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
