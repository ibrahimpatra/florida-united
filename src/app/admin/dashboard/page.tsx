'use client';
import { useEffect, useState } from 'react';
import {
  TrendingUp, ShoppingCart, Package, Users, Banknote,
  ArrowUpRight, ArrowDownRight, BarChart2, Star, AlertTriangle, Clock,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { formatPrice, formatDate, getStatusLabel } from '@/lib/utils';
import type { DashboardStats } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
  out_for_delivery: '#0ea5e9', shipped: '#06b6d4', delivered: '#10b981', cancelled: '#ef4444', returned: '#f97316',
  return_requested: '#f59e0b', return_approved: '#fb923c', return_picked_up: '#f97316', return_rejected: '#64748b', refunded: '#dc2626',
};
const PIE_COLORS = ['#1a56db','#7e3af2','#10b981','#f97316','#ef4444','#06b6d4'];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'categories'>('overview');

  const [loadError, setLoadError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const load = () => {
    setLoadError(null);
    return fetch('/api/admin/stats', { cache: 'no-store' })
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || `Failed (${r.status})`); setStats(d); })
      .catch(e => setLoadError(e.message || 'Could not load dashboard'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const rebuild = async () => {
    if (rebuilding) return;
    if (!confirm('Recalculate all analytics from existing orders? Safe to run any time; may take a minute on large stores.')) return;
    setRebuilding(true);
    try {
      const r = await fetch('/api/admin/stats/rebuild', { method: 'POST' });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || 'Rebuild failed');
      toast.success(`Analytics rebuilt from ${d.orders} orders`);
      await load();
    } catch (e: any) { toast.error(e.message || 'Rebuild failed'); }
    setRebuilding(false);
  };

  if (loading) return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
      <div className="skeleton h-64 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );

  if (loadError && !stats) return (
    <div className="p-4 lg:p-8"><div className="card p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p className="font-semibold text-gray-800">{loadError}</p>
      <button onClick={() => { setLoading(true); load(); }} className="btn-primary mt-4 px-4 py-2 text-sm">Retry</button>
    </div></div>
  );

  const statCards = [
    { icon: Banknote,     label: 'Revenue earned (30d)', value: formatPrice(stats?.recognized?.last30 ?? stats?.totalRevenue ?? 0),   change: stats?.revenueChange || 0,  color: 'text-green-600 bg-green-50',  href: '/admin/orders' },
    { icon: ShoppingCart, label: 'All orders',      value: stats?.totalOrders || 0,                change: stats?.ordersChange  || 0,  color: 'text-brand-600 bg-brand-50',  href: '/admin/orders' },
    { icon: Package,      label: 'Active Products',   value: stats?.totalProducts || 0,              change: 0,                          color: 'text-purple-600 bg-purple-50', href: '/admin/products' },
    { icon: Users,        label: 'Customers',         value: stats?.totalCustomers || 0,             change: 0,                          color: 'text-orange-600 bg-orange-50', href: '/admin/customers' },
  ];

  const avgOrderValue = stats?.avgOrderValue || 0;
  const pendingCount  = stats?.ordersByStatus?.['pending'] || 0;
  const returnsOpen   = ['return_requested', 'return_approved', 'return_picked_up'].reduce((a, k) => a + (stats?.ordersByStatus?.[k] || 0), 0);

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 font-display">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={rebuild} disabled={rebuilding}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {rebuilding ? 'Rebuilding…' : 'Rebuild analytics'}
        </button>
        {pendingCount > 0 && (
          <Link href="/admin/orders?status=pending"
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors">
            <Clock className="w-4 h-4" /> {pendingCount} Pending Orders
          </Link>
        )}
        {returnsOpen > 0 && (
          <Link href="/admin/returns" className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-sm font-semibold hover:bg-orange-100 transition-colors">
            {returnsOpen} open returns
          </Link>
        )}
      </div>

      {(stats?.warnings?.length || 0) > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 space-y-1">
          {stats!.warnings!.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {statCards.map(({ icon: Icon, label, value, change, color, href }) => (
          <Link key={label} href={href} className="card p-4 hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              {change !== 0 && (
                <div className={`flex items-center gap-0.5 text-xs font-bold ${change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(change).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-xl font-black text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Revenue — only money that is really earned */}
      <div className="card p-4 lg:p-5 mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="font-bold text-gray-900">Revenue</h2>
          <p className="text-xs text-gray-500">Counted once an order is delivered and its return period has ended. Cancelled, returned and refunded orders are never counted.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Today', stats?.recognized?.today || 0, ''],
            ['Last 7 days', stats?.recognized?.last7 || 0, ''],
            ['This month', stats?.recognized?.thisMonth || 0, stats?.revenueChange ? `${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange}% vs last month` : `Last month ${formatPrice(stats?.recognized?.lastMonth || 0)}`],
            ['Avg. order (30d)', avgOrderValue, `${stats?.recognized?.orders30 || 0} orders earned`],
          ].map(([l, v, sub]) => (
            <div key={String(l)} className="rounded-2xl bg-green-50/70 p-3">
              <p className="text-xs text-gray-500">{l}</p>
              <p className="text-lg font-black text-gray-900">{formatPrice(Number(v))}</p>
              {sub ? <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p> : null}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div className="rounded-2xl bg-amber-50 p-3">
            <p className="text-xs text-gray-500">On its way (not earned yet)</p>
            <p className="text-lg font-black text-gray-900">{formatPrice(stats?.pendingRevenue?.inProgress || 0)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{stats?.pendingRevenue?.inProgressCount || 0} orders not delivered</p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-3">
            <p className="text-xs text-gray-500">Return period open</p>
            <p className="text-lg font-black text-gray-900">{formatPrice(stats?.pendingRevenue?.held || 0)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{stats?.pendingRevenue?.heldCount || 0} delivered orders waiting</p>
          </div>
          <div className="rounded-2xl bg-red-50 p-3">
            <p className="text-xs text-gray-500">Refunded (30d)</p>
            <p className="text-lg font-black text-gray-900">{formatPrice(stats?.refunds?.last30 || 0)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{stats?.refunds?.count30 || 0} refunds</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Orders placed (30d)</p>
            <p className="text-lg font-black text-gray-900">{formatPrice(stats?.placed?.last30 || 0)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{stats?.placed?.orders30 || 0} orders, before returns</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">Shipping included in earned revenue (30d): {formatPrice(stats?.recognized?.shipping30 || 0)} · Discounts given on earned orders (30d): {formatPrice(stats?.recognized?.discount30 || 0)}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 w-fit">
        {(['overview', 'products', 'categories'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Revenue Chart */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-600" /> Earned revenue vs orders placed (14 days)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats?.revenueByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }}
                  tickFormatter={v => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                <YAxis yAxisId="rev" tick={{ fontSize: 11 }} tickFormatter={v => `KD${v}`} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any, n: string) =>
                  n === 'revenue' ? [formatPrice(Number(v)), 'Revenue earned'] : [v, 'Orders placed']} />
                <Legend />
                <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#1a56db" strokeWidth={2.5} dot={false} name="revenue" />
                <Line yAxisId="ord" type="monotone" dataKey="orders"  stroke="#f97316" strokeWidth={2}   dot={false} name="orders" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Order Status Pie */}
            <div className="card p-5">
              <h3 className="font-bold text-gray-800 mb-4">Orders by status (all time)</h3>
              {Object.keys(stats?.ordersByStatus || {}).length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No orders yet</p>
              ) : (
                <div className="flex items-center gap-4">
                  <PieChart width={130} height={130}>
                    <Pie data={Object.entries(stats?.ordersByStatus || {}).map(([k, v]) => ({ name: k, value: v }))}
                      cx={65} cy={65} innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value">
                      {Object.keys(stats?.ordersByStatus || {}).map((k, i) => (
                        <Cell key={k} fill={STATUS_COLORS[k] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                  <div className="flex-1 space-y-1.5">
                    {Object.entries(stats?.ordersByStatus || {}).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: STATUS_COLORS[status] || '#94a3b8' }} />
                          <span className="text-gray-600 capitalize">{getStatusLabel(status)}</span>
                        </div>
                        <span className="font-bold text-gray-800">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Orders */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">Recent Orders</h3>
                <Link href="/admin/orders" className="text-xs text-brand-600 hover:text-brand-700 font-semibold">View all →</Link>
              </div>
              <div className="space-y-2.5">
                {(stats?.recentOrders || []).slice(0, 6).map(o => (
                  <Link key={o.id} href={`/admin/orders/${o.id}`}
                    className="flex items-center justify-between py-2 border-b border-gray-50 hover:bg-gray-50 -mx-2 px-2 rounded-xl transition-colors">
                    <div>
                      <p className="font-mono text-xs font-bold text-gray-800">#{o.orderNumber}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[140px]">{o.userName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-gray-900">{formatPrice(o.total)}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        o.status === 'shipped'   ? 'bg-cyan-100 text-cyan-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{getStatusLabel(o.status)}</span>
                    </div>
                  </Link>
                ))}
                {(stats?.recentOrders || []).length === 0 && (
                  <p className="text-center text-gray-400 py-4 text-sm">No orders yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Products Tab ── */}
      {activeTab === 'products' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Top products by earned revenue
            </h3>
            {(stats?.topProducts || []).length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No sales data yet</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={(stats?.topProducts || []).slice(0, 8)} layout="vertical" margin={{ left: 0, right: 60 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `KD${Number(v).toFixed(0)}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140}
                      tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + '…' : v} />
                    <Tooltip formatter={(v: any) => [formatPrice(Number(v)), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#1a56db" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {(stats?.topProducts || []).map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>{i + 1}</span>
                      {p.image && <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <Link href={`/p/${encodeURIComponent(p.id)}`} target="_blank" className="text-sm font-semibold text-gray-800 truncate block hover:text-brand-700 hover:underline">{p.name}</Link>
                        <p className="text-xs text-gray-400">{p.units} units</p>
                      </div>
                      <p className="font-black text-gray-900 flex-shrink-0">{formatPrice(p.revenue)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Categories Tab ── */}
      {activeTab === 'products' && (stats?.deadStock?.length || stats?.topCustomers?.length) ? (
        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          <div className="card p-4">
            <h3 className="font-bold text-gray-800 mb-3">Dead stock <span className="text-xs font-normal text-gray-400">(in stock, never sold)</span></h3>
            {(stats?.deadStock || []).length === 0 ? <p className="text-sm text-gray-400">None </p> :
              (stats?.deadStock || []).map((p: any) => (
                <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm hover:text-brand-600">
                  <Link href={`/p/${encodeURIComponent(p.id)}`} target="_blank" className="truncate pr-3 hover:text-brand-700 hover:underline">{p.name}</Link><span className="text-gray-400 flex-shrink-0">{p.stock} in stock</span>
                </Link>))}
          </div>
          <div className="card p-4">
            <h3 className="font-bold text-gray-800 mb-3">Top customers <span className="text-xs font-normal text-gray-400">(value of orders placed)</span></h3>
            {(stats?.topCustomers || []).length === 0 ? <p className="text-sm text-gray-400">No data yet</p> :
              (stats?.topCustomers || []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                  <span className="truncate pr-3">{c.name} <span className="text-gray-400 text-xs">· {c.orderCount} orders</span></span>
                  <span className="font-bold flex-shrink-0">{formatPrice(c.totalSpent)}</span>
                </div>))}
          </div>
        </div>
      ) : null}

      {activeTab === 'categories' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-brand-600" /> Category performance (earned revenue)
            </h3>
            {(stats?.categoryPerformance || []).length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No earned revenue yet. Sales appear here once orders are delivered and their return period has ended.</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats?.categoryPerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `KD${Number(v).toFixed(0)}`} />
                    <Tooltip formatter={(v: any, n: string) => n === 'revenue' ? [formatPrice(Number(v)), 'Revenue'] : [v, 'Units']} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#1a56db" radius={[4,4,0,0]} name="revenue" />
                    <Bar dataKey="units"   fill="#10b981" radius={[4,4,0,0]} name="units" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {(stats?.categoryPerformance || []).map((cat: any, i: number) => (
                    <div key={cat.name} className="flex items-center gap-3 py-2 border-b border-gray-50">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <p className="flex-1 text-sm font-semibold text-gray-700">{cat.name}</p>
                      <p className="text-xs text-gray-400">{cat.units} units</p>
                      <p className="font-bold text-gray-900 w-24 text-right">{formatPrice(cat.revenue)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
