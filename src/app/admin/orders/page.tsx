'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, Download, RefreshCw, Eye, ChevronDown } from 'lucide-react';
import { formatPrice, formatDateTime, getStatusLabel, ORDER_STATUSES } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Order } from '@/types';

const STATUS_COLORS: Record<string,string> = {
  pending:'badge-yellow', confirmed:'badge-blue', processing:'badge-blue',
  shipped:'badge-blue', out_for_delivery:'badge-orange', delivered:'badge-green',
  cancelled:'badge-red', return_requested:'badge-orange', return_approved:'badge-blue',
  return_picked_up:'badge-blue', returned:'badge-gray', refunded:'badge-green',
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string|null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      setOrders(data.items || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load orders'); }
    setLoading(false);
  }, [status, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }) });
      toast.success('Status updated');
      fetchOrders();
    } catch { toast.error('Update failed'); }
    setUpdatingId(null);
  };

  const filtered = search ? orders.filter(o =>
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.userName.toLowerCase().includes(search.toLowerCase()) ||
    o.userEmail.toLowerCase().includes(search.toLowerCase())
  ) : orders;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} total orders</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search orders, customers..."
            className="input-field pl-9 py-2 text-sm" />
        </div>
        <select value={status} onChange={e=>{ setStatus(e.target.value); setPage(1); }}
          className="input-field py-2 text-sm w-44">
          <option value="all">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper rounded-none">
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th><th>Customer</th><th>Items</th>
                <th>Total</th><th>Status</th><th>Payment</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i) => (
                  <tr key={i}>{Array.from({length:8}).map((_,j)=><td key={j}><div className="skeleton h-4 w-full rounded"/></td>)}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No orders found</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td><Link href={`/admin/orders/${o.id}`} className="font-mono font-bold text-brand-700 hover:underline">#{o.orderNumber}</Link></td>
                  <td>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{o.userName}</p>
                      <p className="text-xs text-gray-400">{o.userEmail}</p>
                    </div>
                  </td>
                  <td className="text-gray-700 text-sm">{o.items?.length} item(s)</td>
                  <td className="font-bold text-gray-900">{formatPrice(o.total)}</td>
                  <td>
                    <div className="relative group">
                      <select
                        value={o.status}
                        onChange={e => updateStatus(o.id, e.target.value)}
                        disabled={updatingId === o.id}
                        className={`badge ${STATUS_COLORS[o.status]||'badge-gray'} cursor-pointer border-0 bg-transparent font-bold text-xs pr-5 appearance-none`}
                      >
                        {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </td>
                  <td>
                    <span className={`badge text-xs font-bold ${o.paymentStatus==='paid'?'badge-green':o.paymentStatus==='failed'?'badge-red':'badge-yellow'}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:text-brand-800">
                      <Eye className="w-3.5 h-3.5" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}