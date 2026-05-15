'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingCart, Package, Users, Banknote, ArrowUpRight, ArrowDownRight, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatPrice, formatDate, getStatusLabel } from '@/lib/utils';
import type { DashboardStats } from '@/types';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats').then(r=>r.json()).then(d=>{ setStats(d); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 space-y-6">
      <div className="skeleton h-8 w-48 rounded-xl"/>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="skeleton h-28 rounded-2xl"/>)}</div>
      <div className="skeleton h-64 rounded-2xl"/>
    </div>
  );

  const statCards = [
    { icon: Banknote, label:'Total Revenue', value: formatPrice(stats?.totalRevenue||0), change: stats?.revenueChange||0, color:'text-green-600 bg-green-50', href:'/admin/orders' },
    { icon: ShoppingCart, label:'Total Orders', value: stats?.totalOrders||0, change: stats?.ordersChange||0, color:'text-brand-600 bg-brand-50', href:'/admin/orders' },
    { icon: Package, label:'Products', value: stats?.totalProducts||0, change: 0, color:'text-purple-600 bg-purple-50', href:'/admin/products' },
    { icon: Users, label:'Customers', value: stats?.totalCustomers||0, change: 0, color:'text-orange-600 bg-orange-50', href:'/admin/customers' },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-gray-900 font-display">Dashboard</h1><p className="text-gray-500 text-sm mt-0.5">Welcome back! Here's what's happening.</p></div>
        <div className="text-sm text-gray-500 bg-white border border-gray-200 px-4 py-2 rounded-xl">{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map(({icon:Icon,label,value,change,color,href})=>(
          <Link key={label} href={href} className="card p-5 hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5"/></div>
              {change!==0 && (
                <div className={`flex items-center gap-1 text-xs font-bold ${change>0?'text-green-600':'text-red-500'}`}>
                  {change>0?<ArrowUpRight className="w-3.5 h-3.5"/>:<ArrowDownRight className="w-3.5 h-3.5"/>}
                  {Math.abs(change).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 card p-6">
          <h3 className="font-bold text-gray-800 mb-5">Revenue & Orders (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats?.revenueByDay||[]}>
              <XAxis dataKey="date" tick={{fontSize:11}} tickFormatter={v=>new Date(v).toLocaleDateString('en',{month:'short',day:'numeric'})}/>
              <YAxis yAxisId="rev" tick={{fontSize:11}} tickFormatter={v=>`$${v}`}/>
              <YAxis yAxisId="ord" orientation="right" tick={{fontSize:11}}/>
              <Tooltip formatter={(v:any,n:string)=>n==='revenue'?[formatPrice(Number(v)),'Revenue']:[v,'Orders']}/>
              <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#1a56db" strokeWidth={2.5} dot={false}/>
              <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#f97316" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-gray-800 mb-4">Orders by Status</h3>
          <div className="space-y-2.5">
            {Object.entries(stats?.ordersByStatus||{}).slice(0,7).map(([status,count])=>(
              <div key={status} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1"><span className="font-medium text-gray-700 capitalize">{getStatusLabel(status)}</span><span className="font-bold text-gray-800">{count}</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full" style={{width:`${Math.min(100,(count/Math.max(...Object.values(stats?.ordersByStatus||{1:1}).map(Number)))*100)}%`}}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Recent Orders</h3>
          <Link href="/admin/orders" className="text-sm text-brand-600 font-semibold hover:underline">View All →</Link>
        </div>
        <div className="table-wrapper rounded-none rounded-b-2xl">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {(stats?.recentOrders||[]).slice(0,8).map(o=>(
                <tr key={o.id}>
                  <td><span className="font-mono font-bold text-brand-700 text-sm">#{o.orderNumber}</span></td>
                  <td><div><p className="font-medium text-gray-800 text-sm">{o.userName}</p><p className="text-xs text-gray-400">{o.userEmail}</p></div></td>
                  <td><span className={`badge text-xs font-bold ${o.status==='delivered'?'badge-green':o.status==='cancelled'?'badge-red':o.status.includes('ship')?'badge-blue':'badge-yellow'}`}>{getStatusLabel(o.status)}</span></td>
                  <td className="font-bold text-gray-800">{formatPrice(o.total)}</td>
                  <td className="text-gray-500 text-xs">{formatDate(o.createdAt)}</td>
                  <td><Link href={`/admin/orders/${o.id}`} className="text-xs text-brand-600 font-semibold hover:underline">Manage →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
