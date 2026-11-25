'use client';
import Link from 'next/link';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { LayoutGrid, Store, LogOut, ChevronRight } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useBrand } from '@/contexts/BrandContext';
import { BrandMark } from '@/components/layout/BrandMark';
import { findNav } from '@/lib/admin-nav';
import { rememberAdminPage } from './AdminHome';

/** Slim bar on every admin page: the grid button goes back to the full-page menu; no sidebar. */
export function AdminTopBar({ user, isSuper }: { user: any; isSuper: boolean }) {
  const path = usePathname(); const brand = useBrand();
  const here = findNav(path);
  useEffect(() => { if (here) rememberAdminPage(here.item.href); }, [here?.item.href]);  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <header className="flex-shrink-0 bg-white/90 backdrop-blur-xl text-gray-900 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-14 z-30 shadow-soft">
      <Link href="/admin" aria-label="Admin menu" className="w-10 h-10 -ms-1 inline-flex items-center justify-center rounded-full bg-brand-800 text-white hover:bg-brand-900 shadow-soft active:scale-95 transition"><LayoutGrid className="w-5 h-5" /></Link>
      <Link href="/admin" className="hidden sm:flex items-center gap-2 text-sm font-bold">
        <span className="w-8 h-8 bg-brand-700 rounded-xl flex items-center justify-center text-[10px] text-white"><BrandMark /></span>{brand.name}
      </Link>
      {here && (<>
        <ChevronRight className="w-4 h-4 text-gray-300 rtl:rotate-180 hidden sm:block" />
        <span className="text-xs text-gray-500 hidden md:block">{here.group.label}</span>
        <ChevronRight className="w-4 h-4 text-gray-300 rtl:rotate-180 hidden md:block" />
        <span className="text-sm font-bold text-gray-900 truncate">{here.item.label}</span>
      </>)}
      <span className="flex-1" />
      <Link href="/" target="_blank" className="h-10 px-3 rounded-full hover:bg-gray-100 text-gray-700 flex items-center gap-1.5 text-xs font-semibold"><Store className="w-4 h-4" /><span className="hidden sm:inline">View store</span></Link>
      <span className="hidden md:block text-xs text-gray-500">{user?.name} · {isSuper ? 'Super admin' : 'Admin'}</span>
      <NotificationBell scope="admin" />
      <button onClick={() => signOut({ callbackUrl: '/' })} aria-label="Sign out" className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-red-50 text-gray-500 hover:text-red-600"><LogOut className="w-4 h-4" /></button>
    </header>
  );
}
