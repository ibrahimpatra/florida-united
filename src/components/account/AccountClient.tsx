'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Heart, MapPin, Settings, LogOut, ShoppingBag, Bell, Star } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { formatPrice, formatDate } from '@/lib/utils';
import type { Order } from '@/types';

export function AccountClient({ user }: { user: any }) {
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
            <h1 className="text-2xl font-bold font-display">Hello, {user.name?.split(' ')[0]}! 👋</h1>
            <p className="text-blue-200 text-sm mt-0.5">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="container-custom py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: ShoppingBag, label:'Total Orders', value: orders.length, color:'text-brand-600 bg-brand-50' },
            { icon: Package, label:'Delivered', value: orders.filter(o=>o.status==='delivered').length, color:'text-green-600 bg-green-50' },
            { icon: Star, label:'Total Spent', value: formatPrice(totalSpent), color:'text-amber-600 bg-amber-50' },
            { icon: Bell, label:'Active Orders', value: orders.filter(o=>!['delivered','cancelled','refunded'].includes(o.status)).length, color:'text-purple-600 bg-purple-50' },
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
                { icon: Package, label:'My Orders', href:'/account/orders', desc:'Track and manage orders' },
                { icon: Heart, label:'My Wishlist', href:'/account/wishlist', desc:'Saved products' },
                { icon: MapPin, label:'My Addresses', href:'/account/addresses', desc:'Manage shipping addresses' },
                { icon: Settings, label:'Account Settings', href:'/account/settings', desc:'Profile & password' },
              ].map(({icon:Icon,label,href,desc})=>(
                <Link key={label} href={href} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors group">
                  <div className="w-9 h-9 bg-brand-50 group-hover:bg-brand-100 rounded-xl flex items-center justify-center transition-colors"><Icon className="w-4 h-4 text-brand-600"/></div>
                  <div className="flex-1"><p className="font-semibold text-gray-800 text-sm">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
                  <span className="text-gray-400 group-hover:text-brand-600 text-lg">→</span>
                </Link>
              ))}
              <button onClick={()=>signOut({callbackUrl:'/'})} className="flex items-center gap-4 px-5 py-4 hover:bg-red-50 w-full transition-colors group">
                <div className="w-9 h-9 bg-red-50 group-hover:bg-red-100 rounded-xl flex items-center justify-center"><LogOut className="w-4 h-4 text-red-500"/></div>
                <div className="flex-1 text-left"><p className="font-semibold text-red-600 text-sm">Sign Out</p></div>
              </button>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">Recent Orders</h2>
              <Link href="/account/orders" className="text-brand-600 text-sm font-semibold hover:underline">View All →</Link>
            </div>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card p-4"><div className="skeleton h-16 w-full rounded-xl"/></div>)}</div>
            ) : recentOrders.length === 0 ? (
              <div className="card p-10 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
                <p className="text-gray-500 font-medium">No orders yet</p>
                <Link href="/shop" className="btn-primary mt-4 text-sm">Start Shopping</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map(o=>(
                  <Link key={o.id} href={`/account/orders/${o.id}`} className="card p-4 flex items-center gap-4 hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 block">
                    <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-brand-600"/></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 text-sm">#{o.orderNumber}</span>
                        <span className={`badge text-xs font-bold ${o.status==='delivered'?'badge-green':o.status==='cancelled'?'badge-red':'badge-blue'}`}>{o.status.replace(/_/g,' ')}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{o.items.length} item(s) · {formatDate(o.createdAt)}</p>
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
