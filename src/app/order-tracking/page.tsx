'use client';
import { useState } from 'react';
import { Search, Package, Truck, CheckCircle, Clock, MapPin } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatDateTime, getOrderProgress, ORDER_STATUS_STEPS, formatPrice, getStatusLabel } from '@/lib/utils';
import type { Order } from '@/types';

export default function OrderTrackingPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  const track = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setOrder(null);
    try {
      const res = await fetch(`/api/orders?orderNumber=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.items?.[0]) setOrder(data.items[0]);
      else setError('Order not found. Please check the order number and try again.');
    } catch { setError('Failed to lookup order. Please try again.'); }
    setLoading(false);
  };

  const progress = order ? getOrderProgress(order.status) : 0;

  return (
    <><Header/>
    <main className="bg-gray-50 min-h-screen">
      <div className="page-hero"><div className="container-custom"><h1 className="text-3xl font-bold text-gray-900 font-display">Track Your Order</h1><p className="text-gray-500 mt-1">Enter your order number to get live updates</p></div></div>
      <div className="container-custom py-10 max-w-3xl">
        {/* Search */}
        <div className="card p-6 mb-8">
          <div className="flex gap-3">
            <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&track()}
              placeholder="Enter order number (e.g. FU-ABC123-XYZ)" className="input-field flex-1"/>
            <button onClick={track} disabled={loading} className="btn-primary px-6">
              {loading?<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Search className="w-4 h-4"/>Track</>}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>

        {order && (
          <div className="space-y-6">
            {/* Order Header */}
            <div className="card p-6">
              <div className="flex flex-wrap gap-4 justify-between mb-4">
                <div><p className="text-xs text-gray-500 uppercase tracking-wide">Order Number</p><p className="text-xl font-black text-brand-700">#{order.orderNumber}</p></div>
                <div><p className="text-xs text-gray-500 uppercase tracking-wide">Status</p><span className={`badge badge-${order.status==='delivered'?'green':order.status==='cancelled'?'red':order.status.includes('ship')?'blue':'yellow'} font-bold`}>{getStatusLabel(order.status)}</span></div>
                <div><p className="text-xs text-gray-500 uppercase tracking-wide">Total</p><p className="text-xl font-bold text-gray-900">{formatPrice(order.total)}</p></div>
                <div><p className="text-xs text-gray-500 uppercase tracking-wide">Ordered</p><p className="text-sm font-medium text-gray-700">{formatDateTime(order.createdAt)}</p></div>
              </div>
              {order.trackingNumber && (
                <div className="bg-blue-50 rounded-xl p-3 flex gap-3 text-sm">
                  <Truck className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5"/>
                  <div><p className="font-bold text-brand-800">Tracking Number: {order.trackingNumber}</p><p className="text-brand-600">Carrier: {order.shippingCarrier}</p></div>
                </div>
              )}
            </div>

            {/* Progress */}
            {!['cancelled','returned','refunded'].includes(order.status) && (
              <div className="card p-6">
                <h3 className="font-bold text-gray-800 mb-6">Order Progress</h3>
                <div className="relative">
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200"><div className="h-full bg-brand-600 transition-all duration-500" style={{width:`${(progress/(ORDER_STATUS_STEPS.length-1))*100}%`}}/></div>
                  <div className="relative flex justify-between">
                    {ORDER_STATUS_STEPS.map((step,i)=>(
                      <div key={step.key} className="flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm z-10 transition-all ${i<=progress?'bg-brand-600 text-white shadow-md':'bg-gray-100 text-gray-400'}`}>{step.icon}</div>
                        <p className={`text-xs font-medium text-center hidden sm:block ${i<=progress?'text-brand-700':'text-gray-400'}`}>{step.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* History */}
            <div className="card p-6">
              <h3 className="font-bold text-gray-800 mb-4">Order Timeline</h3>
              <div className="space-y-3">
                {[...(order.statusHistory || [])].reverse().map((h,i)=>(
                  <div key={i} className="flex gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${i===0?'bg-brand-600':'bg-gray-300'}`}/>
                    <div><p className="text-sm font-semibold text-gray-800 capitalize">{getStatusLabel(h.status)}</p>{h.note&&<p className="text-xs text-gray-500">{h.note}</p>}<p className="text-xs text-gray-400 mt-0.5">{formatDateTime(h.createdAt)}</p></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="card p-6">
              <h3 className="font-bold text-gray-800 mb-4">Items Ordered</h3>
              <div className="space-y-3">
                {order.items.map((item,i)=>(
                  <div key={i} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">{item.image&&<img src={item.image} alt={item.productName} className="w-full h-full object-cover"/>}</div>
                    <div className="flex-1"><p className="text-sm font-semibold text-gray-800">{item.productName}</p><p className="text-xs text-gray-500">SKU: {item.productSku} · Qty: {item.quantity}</p></div>
                    <span className="font-bold text-gray-800">{formatPrice(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
    <Footer/></>
  );
}
