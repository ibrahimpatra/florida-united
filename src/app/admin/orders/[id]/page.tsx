'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Truck, Package, CheckCircle, Mail, MessageCircle, Printer } from 'lucide-react';
import Link from 'next/link';
import { formatPrice, formatDateTime, getStatusLabel, ORDER_STATUSES, getStatusColor } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Order } from '@/types';

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('UPS');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${id}`).then(r=>r.json()).then(d=>{ setOrder(d); setNewStatus(d.status); setLoading(false); }).catch(()=>setLoading(false));
  }, [id]);

  const updateStatus = async () => {
    if (!newStatus) return;
    setSaving(true);
    try {
      await fetch(`/api/orders/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus, note: statusNote }) });
      toast.success('Status updated & email sent');
      setOrder(o => o ? { ...o, status: newStatus as any } : o);
      setStatusNote('');
    } catch { toast.error('Update failed'); }
    setSaving(false);
  };

  const updateTracking = async () => {
    if (!tracking) return;
    setSaving(true);
    try {
      await fetch(`/api/orders/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ trackingNumber: tracking, carrier }) });
      toast.success('Tracking updated & email sent');
      setOrder(o => o ? { ...o, trackingNumber: tracking, shippingCarrier: carrier, status: 'shipped' } : o);
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  if (loading) return <div className="p-8"><div className="skeleton h-96 w-full rounded-2xl"/></div>;
  if (!order) return <div className="p-8 text-center text-gray-500">Order not found</div>;

  const statusColor: Record<string,string> = { delivered:'green', cancelled:'red', shipped:'blue', pending:'yellow', confirmed:'blue', processing:'purple', refunded:'green' };
  const sc = statusColor[order.status] || 'gray';

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={()=>router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><ArrowLeft className="w-5 h-5"/></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-display">Order #{order.orderNumber}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors no-print">
            <Printer className="w-4 h-4"/> Print
          </button>
          <span className={`badge badge-${sc} font-bold px-4 py-2 text-sm`}>{getStatusLabel(order.status)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left - Order details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-600"/><h3 className="font-bold text-gray-800">Order Items</h3>
            </div>
            <table className="table">
              <thead><tr><th>Product</th><th>SKU</th><th className="text-center">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {order.items.map((item,i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-3">
                        {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover bg-gray-100"/>}
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{item.productName}</p>
                          {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                          <span className={`badge text-xs ${item.isReturnable?'badge-green':'badge-red'}`}>{item.isReturnable?'Returnable':'Non-returnable'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-gray-500">{item.productSku}</td>
                    <td className="text-center font-bold">{item.quantity}</td>
                    <td className="text-right text-gray-700">{formatPrice(item.price)}</td>
                    <td className="text-right font-bold text-gray-900">{formatPrice(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} className="text-right text-gray-600">Subtotal</td><td className="text-right font-bold">{formatPrice(order.subtotal)}</td></tr>
                {order.discount>0 && <tr><td colSpan={4} className="text-right text-green-600">Discount</td><td className="text-right font-bold text-green-600">-{formatPrice(order.discount)}</td></tr>}
                <tr><td colSpan={4} className="text-right text-gray-600">Shipping</td><td className="text-right font-bold">{order.shippingCost===0?'FREE':formatPrice(order.shippingCost)}</td></tr>
                <tr><td colSpan={4} className="text-right text-gray-600">Tax</td><td className="text-right font-bold">{formatPrice(order.tax)}</td></tr>
                <tr className="bg-gray-50"><td colSpan={4} className="text-right font-black text-gray-900 text-base">TOTAL</td><td className="text-right font-black text-brand-700 text-lg">{formatPrice(order.total)}</td></tr>
              </tfoot>
            </table>
          </div>

          {/* Status History */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-brand-600"/>Order Timeline</h3>
            <div className="space-y-3">
              {[...order.statusHistory].reverse().map((h,i) => (
                <div key={i} className="flex gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${i===0?'bg-brand-600':'bg-gray-300'}`}/>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{getStatusLabel(h.status)}</p>
                    {h.note && <p className="text-xs text-gray-500">{h.note}</p>}
                    <p className="text-xs text-gray-400">{formatDateTime(h.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Actions & Info */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Customer</h3>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-gray-900">{order.userName}</p>
              <a href={`mailto:${order.userEmail}`} className="text-brand-600 hover:underline flex items-center gap-1"><Mail className="w-3.5 h-3.5"/>{order.userEmail}</a>
              {order.userPhone && <p className="text-gray-600">{order.userPhone}</p>}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Ship To</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {order.shippingAddress?.firstName} {order.shippingAddress?.lastName}<br/>
              {order.shippingAddress?.address1}{order.shippingAddress?.address2 && `, ${order.shippingAddress.address2}`}<br/>
              {order.shippingAddress?.city}{order.shippingAddress?.governorate && `, ${order.shippingAddress.governorate}`}<br/>
              {order.shippingAddress?.country}
            </p>
          </div>

          {/* Payment */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Payment</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-semibold uppercase">{order.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`badge text-xs font-bold ${order.paymentStatus==='paid'?'badge-green':'badge-yellow'}`}>{order.paymentStatus}</span></div>
              {order.stripePaymentId && <div className="flex justify-between"><span className="text-gray-500">Stripe ID</span><span className="font-mono text-xs text-gray-600 truncate max-w-[120px]">{order.stripePaymentId}</span></div>}
              {order.couponCode && <div className="flex justify-between"><span className="text-gray-500">Coupon</span><span className="badge-green badge text-xs">{order.couponCode}</span></div>}
            </div>
          </div>

          {/* Update Status */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Update Status</h3>
            <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} className="input-field text-sm py-2 mb-2">
              {ORDER_STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <textarea value={statusNote} onChange={e=>setStatusNote(e.target.value)} placeholder="Optional note to customer..." rows={2} className="input-field text-sm py-2 mb-2 resize-none"/>
            <button onClick={updateStatus} disabled={saving} className="btn-primary w-full py-2 text-sm">
              {saving?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><CheckCircle className="w-4 h-4"/>Update & Email Customer</>}
            </button>
          </div>

          {/* Add Tracking */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-brand-600"/>Tracking Info</h3>
            {order.trackingNumber && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-sm">
                <p className="font-bold text-green-700">{order.shippingCarrier}: {order.trackingNumber}</p>
              </div>
            )}
            <select value={carrier} onChange={e=>setCarrier(e.target.value)} className="input-field text-sm py-2 mb-2">
              {['UPS','FedEx','USPS','DHL','Amazon Logistics'].map(c=><option key={c}>{c}</option>)}
            </select>
            <input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Tracking number" className="input-field text-sm py-2 mb-2"/>
            <button onClick={updateTracking} disabled={saving||!tracking} className="btn-primary w-full py-2 text-sm disabled:opacity-50">
              {saving?'Saving...':'Save Tracking & Notify'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}