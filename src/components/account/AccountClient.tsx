'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Heart, MapPin, Settings, LogOut, ShoppingBag, Bell, Star } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { formatPrice, formatDate, statusText } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Order } from '@/types';

export function AccountClient({ user }: { user: any }) {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders').then(r=>r.json()).then(d=>{ setOrders(d.items||[]); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  const recentOrders = orders.slice(0,3);
  const totalSpent = orders.filter(o=>o.paymentStatus==='paid').reduce((s,o)=>s+o.total,0);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-600 text-white py-10">
        <div className="container-custom flex items-center gap-5">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black">{user.name?.[0]||'U'}</div>
          <div>
            <h1 className="text-2xl font-bold font-display">{t('c2_acct.hello', { name: user.name?.split(' ')[0] || '' })}</h1>
            <p className="text-brand-200 text-sm mt-0.5">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="container-custom py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: ShoppingBag, label:t('c2_acct.totalOrders'), value: orders.length, color:'text-brand-600 bg-brand-50' },
            { icon: Package, label:t('c2_acct.delivered'), value: orders.filter(o=>o.status==='delivered').length, color:'text-green-600 bg-green-50' },
            { icon: Star, label:t('c2_acct.totalSpent'), value: formatPrice(totalSpent), color:'text-amber-600 bg-amber-50' },
            { icon: Bell, label:t('c2_acct.activeOrders'), value: orders.filter(o=>!['delivered','cancelled','refunded'].includes(o.status)).length, color:'text-purple-600 bg-purple-50' },
          ].map(({icon:Icon,label,value,color})=>(
            <div key={label} className="card p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}><Icon className="w-5 h-5"/></div>
              <div><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-black text-gray-900">{value}</p></div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quick Nav */}
          <div className="space-y-3">
            <div className="card overflow-hidden">
              {[
                { icon: Package, label:t('c2_acct.myOrders'), href:'/account/orders', desc:t('c2_acct.myOrdersD') },
                { icon: Heart, label:t('c2_acct.myWishlist'), href:'/account/wishlist', desc:t('c2_acct.myWishlistD') },
                { icon: MapPin, label:t('c2_acct.myAddresses'), href:'/account/addresses', desc:t('c2_acct.myAddressesD') },
                { icon: Settings, label:t('c2_acct.settings'), href:'/account/settings', desc:t('c2_acct.settingsD') },
              ].map(({icon:Icon,label,href,desc})=>(
                <Link key={label} href={href} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors group">
                  <div className="w-9 h-9 bg-brand-50 group-hover:bg-brand-100 rounded-xl flex items-center justify-center transition-colors"><Icon className="w-4 h-4 text-brand-600"/></div>
                  <div className="flex-1"><p className="font-semibold text-gray-800 text-sm">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-brand-600 rtl:rotate-180" />
                </Link>
              ))}
              <button onClick={()=>signOut({callbackUrl:'/'})} className="flex items-center gap-4 px-5 py-4 hover:bg-red-50 w-full transition-colors group">
                <div className="w-9 h-9 bg-red-50 group-hover:bg-red-100 rounded-xl flex items-center justify-center"><LogOut className="w-4 h-4 text-red-500"/></div>
                <div className="flex-1 text-start"><p className="font-semibold text-red-600 text-sm">{t('c2_acct.signOut')}</p></div>
              </button>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">{t('c2_acct.recent')}</h2>
              <Link href="/account/orders" className="text-brand-600 text-sm font-semibold hover:underline">{t('c2_acct.viewAll')}</Link>
            </div>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card p-4"><div className="skeleton h-16 w-full rounded-xl"/></div>)}</div>
            ) : recentOrders.length === 0 ? (
              <div className="card p-10 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
                <p className="text-gray-500 font-medium">{t('c2_acct.noOrders')}</p>
                <Link href="/shop" className="btn-primary mt-4 text-sm">{t('c2_acct.start')}</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map(o=>(
                  <Link key={o.id} href={`/account/orders/${o.id}`} className="card p-4 flex items-center gap-4 hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 block">
                    <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-brand-600"/></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 text-sm">#{o.orderNumber}</span>
                        <span className={`badge text-xs font-bold ${o.status==='delivered'?'badge-green':o.status==='cancelled'?'badge-red':'badge-blue'}`}>{statusText(t, o.status)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{t('c2_acct.itemsDate', { n: o.items.length, date: formatDate(o.createdAt) })}</p>
                    </div>
                    <span className="font-black text-brand-700 flex-shrink-0">{formatPrice(o.total)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
