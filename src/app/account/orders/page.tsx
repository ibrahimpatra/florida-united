'use client';
import { useEffect, useState } from 'react';
import { Package, ChevronRight, RotateCcw, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatPrice, formatDate, getStatusLabel } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { Order } from '@/types';

const STATUS_COLOR: Record<string,string> = { delivered:'badge-green', cancelled:'badge-red', shipped:'badge-blue', pending:'badge-yellow', confirmed:'badge-blue', processing:'badge-blue', return_requested:'badge-orange', refunded:'badge-green' };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnModal, setReturnModal] = useState<Order|null>(null);
  const [returnForm, setReturnForm] = useState({ reason:'', description:'' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/orders').then(r=>r.json()).then(d=>{ setOrders(d.items||[]); setLoading(false); });
  }, []);

  const canReturn = (order: Order) => order.status === 'delivered' && !['return_requested','return_approved','return_picked_up','returned','refunded'].includes(order.status);

  const submitReturn = async () => {
    if (!returnForm.reason || !returnModal) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders/returns', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId: returnModal.id, ...returnForm }) });
      const data = await res.json();
      if (data.success) { toast.success('Return request submitted! We\'ll review it within 24 hours.'); setReturnModal(null); setReturnForm({ reason:'', description:'' }); }
      else toast.error(data.error||'Failed');
    } catch { toast.error('Error'); }
    setSubmitting(false);
  };

  const whatsappOrder = (order: Order) => {
    const msg = `Hi, I have a question about my order #${order.orderNumber} (${formatPrice(order.total)}) placed on ${formatDate(order.createdAt)}.`;
    window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP||'15550000000'}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <>
      <Header/>
      <main className="bg-gray-50 min-h-screen">
        <div className="page-hero"><div className="container-custom"><h1 className="text-2xl font-bold text-gray-900 font-display">My Orders</h1><p className="text-gray-500 mt-1">{orders.length} orders total</p></div></div>
        <div className="container-custom py-8 max-w-3xl">
          {loading ? <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="card p-6"><div className="skeleton h-24 w-full rounded-xl"/></div>)}</div>
          : orders.length===0 ? (
            <div className="card p-16 text-center"><Package className="w-12 h-12 text-gray-300 mx-auto mb-4"/><p className="text-gray-500 font-semibold mb-4">No orders yet</p><Link href="/shop" className="btn-primary">Start Shopping</Link></div>
          ) : orders.map(o=>(
            <div key={o.id} className="card p-5 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <span className="font-bold text-brand-700 text-lg">#{o.orderNumber}</span>
                  <span className={`ml-2 badge text-xs font-bold ${STATUS_COLOR[o.status]||'badge-gray'}`}>{getStatusLabel(o.status)}</span>
                </div>
                <div className="text-right">
                  <p className="font-black text-gray-900 text-lg">{formatPrice(o.total)}</p>
                  <p className="text-xs text-gray-500">{formatDate(o.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 mb-4">
                {o.items.slice(0,3).map((item,i)=>(
                  <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs">
                    {item.image && <img src={item.image} alt={item.productName} className="w-8 h-8 rounded-lg object-cover"/>}
                    <div><p className="font-medium text-gray-800 max-w-[120px] truncate">{item.productName}</p><p className="text-gray-400">Qty: {item.quantity}</p></div>
                  </div>
                ))}
                {o.items.length>3 && <div className="flex-shrink-0 flex items-center px-3 text-xs text-gray-500">+{o.items.length-3} more</div>}
              </div>
              {o.trackingNumber && (
                <div className="bg-blue-50 rounded-xl px-3 py-2 mb-3 text-xs text-brand-800">
                  🚚 <strong>{o.shippingCarrier}</strong> — Tracking: <strong>{o.trackingNumber}</strong>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={`/order-tracking?q=${o.orderNumber}`} className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 rounded-xl text-xs font-semibold hover:bg-brand-100 transition-colors">
                  <Package className="w-3.5 h-3.5"/>Track Order
                </Link>
                {canReturn(o) && (
                  <button onClick={()=>setReturnModal(o)} className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 rounded-xl text-xs font-semibold hover:bg-orange-100 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5"/>Request Return
                  </button>
                )}
                <button onClick={()=>whatsappOrder(o)} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5"/>WhatsApp Support
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Return Modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Request Return</h3>
            <p className="text-sm text-gray-500 mb-4">Order #{returnModal.orderNumber}</p>
            <div className="space-y-3">
              <div>
                <label className="label">Reason *</label>
                <select value={returnForm.reason} onChange={e=>setReturnForm(f=>({...f,reason:e.target.value}))} className="input-field">
                  <option value="">Select a reason</option>
                  {['Item damaged/defective','Wrong item received','Item not as described','Changed my mind','Duplicate order','Item missing parts'].map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Additional Details</label>
                <textarea value={returnForm.description} onChange={e=>setReturnForm(f=>({...f,description:e.target.value}))} rows={3} className="input-field resize-none" placeholder="Please describe the issue in detail..."/>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                ⚠️ Items marked as <strong>non-returnable</strong> by the seller cannot be returned. Please check individual item policies.
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setReturnModal(null)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
              <button onClick={submitReturn} disabled={submitting||!returnForm.reason} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">{submitting?'Submitting...':'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}
      <Footer/>
    </>
  );
}
