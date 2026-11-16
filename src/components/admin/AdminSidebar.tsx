'use client';
import { SITE_CONFIG } from '@/lib/siteConfig';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Tag, Percent, Image,
  Settings, LogOut, Menu, X, RotateCcw, Zap, Truck, Ruler, Upload,
  Gift, BarChart2,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

const nav = [
  { href:'/admin/dashboard',   icon:LayoutDashboard, label:'Dashboard' },
  { href:'/admin/orders',      icon:ShoppingCart,    label:'Orders' },
  { href:'/admin/products',    icon:Package,         label:'Products' },
  { href:'/admin/bundles',     icon:Gift,            label:'Bundles' },
  { href:'/admin/import',      icon:Upload,          label:'Bulk Import' },
  { href:'/admin/categories',  icon:Tag,             label:'Categories' },
  { href:'/admin/customers',   icon:Users,           label:'Customers' },
  { href:'/admin/returns',     icon:RotateCcw,       label:'Returns' },
  { href:'/admin/flash-deals', icon:Zap,             label:'Flash Deals' },
  { href:'/admin/coupons',     icon:Percent,         label:'Coupons' },
  { href:'/admin/shipping',    icon:Truck,           label:'Shipping Zones' },
  { href:'/admin/uoms',        icon:Ruler,           label:'Units (UOM)' },
  { href:'/admin/banners',     icon:Image,           label:'Banners' },
  { href:'/admin/settings',    icon:Settings,        label:'Settings' },
];

function SidebarContent({ user, onClose }: { user: any; onClose?: () => void }) {
  const path = usePathname();
  return (
    <>
      {/* Logo row */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
            {SITE_CONFIG.logoText}
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">{SITE_CONFIG.name}</p>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <Link key={href} href={href} onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2 px-2">
          <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user?.name?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-400">Administrator</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-xs text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );
}

export function AdminSidebar({ user }: { user: any }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const path = usePathname();

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [path]);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-56 bg-gray-900 text-white flex-col flex-shrink-0 h-screen">
        <SidebarContent user={user} />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white flex items-center gap-3 px-4 py-3 shadow-lg">
        <button onClick={() => setDrawerOpen(true)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-300">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">
            {SITE_CONFIG.logoText}
          </div>
          <span className="text-sm font-bold text-white">{SITE_CONFIG.name} Admin</span>
        </div>
      </div>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-gray-900 text-white flex flex-col h-full shadow-2xl">
            <SidebarContent user={user} onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
