'use client';
import { formatAddress } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Truck, Package, CheckCircle, Mail, MessageCircle, Printer } from 'lucide-react';
import Link from 'next/link';
import { useBusy } from '@/components/layout/BusyLayer';
import { nextSteps, STEP_LABEL } from '@/lib/order-flow';
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
    load();
  }, [id]);

  const load = () => fetch(`/api/orders/${id}`, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => { if (d?.id) { setOrder(d); setNewStatus(d.status); } else setOrder(null); setLoading(false); })
    .catch(() => setLoading(false));

  const { start: startBusy } = useBusy();
  const updateStatus = async (newStatus: string) => {
    if (!newStatus) return;
    setSaving(true); const stopBusy = startBusy('Updating order…');
    try {
      const res = await fetch(`/api/orders/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus, note: statusNote }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || `Update failed (${res.status})`); setNewStatus(order?.status || ''); }
      else {
        toast.success(newStatus === 'cancelled' ? 'Order cancelled, stock restored' : 'Status updated, customer notified');
        if (d.needsRefund) toast('This order was already paid online - issue the refund in Stripe.', { duration: 9000 });
        setStatusNote(''); await load();
      }
    } catch { toast.error('Network error - status not changed'); }
    stopBusy(); setSaving(false);
  };

  const updateTracking = async () => {
    if (!tracking.trim()) { toast.error('Enter a tracking number first.'); return; }
    setSaving(true); const stopBusy = startBusy('Saving tracking…');
    try {
      const res = await fetch(`/api/orders/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ trackingNumber: tracking.trim(), carrier }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(d.error || `Failed (${res.status})`);
      else { toast.success('Tracking saved, order marked as shipped'); await load(); }
    } catch { toast.error('Network error - tracking not saved'); }
    stopBusy(); setSaving(false);
  };

  if (loading) return <div className="p-8"><div className="skeleton h-96 w-full rounded-2xl"/></div>;
  if (!order) return <div className="p-8 text-center text-gray-500">Order not found</div>;

  const statusColor: Record<string,string> = { delivered:'green', cancelled:'red', shipped:'blue', pending:'yellow', confirmed:'blue', processing:'purple', refunded:'green' };
  const steps = nextSteps(order.status);
  const sc = statusColor[order.status] || 'gray';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button onClick={()=>router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><ArrowLeft className="w-5 h-5"/></button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-display break-all">Order #{order.orderNumber}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/orders/${order.id}/invoice`} target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors no-print">
            Invoice PDF
          </a>
          <button onClick={()=>window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors no-print">
            <Printer className="w-4 h-4"/> Print
          </button>
          <span className={`badge badge-${sc} font-bold px-4 py-2 text-sm`}>{getStatusLabel(order.status)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 [&>*]:min-w-0">
        {/* Left - Order details */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
          {/* Items */}
          <div className="card overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-600"/><h3 className="font-bold text-gray-800">Order Items</h3>
            </div>
            {/* Phones: item cards instead of a wide table */}
            <div className="sm:hidden divide-y divide-gray-100">
              {order.items.map((item, i) => (
                <div key={i} className="p-4 flex gap-3">
                  {item.image && <img src={item.image} alt={item.productName} className="w-14 h-14 rounded-lg object-cover bg-gray-100 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${encodeURIComponent(item.productId)}`} target="_blank" className="font-semibold text-gray-800 text-sm hover:text-brand-700 block break-words">{item.productName}</Link>
                    {item.productNameAr && <p className="text-xs text-gray-500" dir="rtl">{item.productNameAr}</p>}
                    {item.productSku && <p className="font-mono text-[11px] text-gray-400 break-all">{item.productSku}</p>}
                    {(item as any).dealId && <p className="text-xs text-amber-700">Offer: {(item as any).dealTitle || 'Flash deal'}</p>}
                    <div className="flex items-center justify-between mt-1.5 text-sm">
                      <span className="text-gray-600">{item.quantity} × {formatPrice(item.price)}</span>
                      <span className="font-bold text-gray-900">{formatPrice(item.total)}</span>
                    </div>
                    <span className={`badge text-xs mt-1 ${item.isReturnable ? 'badge-green' : 'badge-red'}`}>{item.isReturnable ? 'Returnable' : 'Non-returnable'}</span>
                  </div>
                </div>
              ))}
              <div className="p-4 space-y-1.5 text-sm bg-gray-50">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><b>{formatPrice(order.subtotal)}</b></div>
                {order.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><b>-{formatPrice(order.discount)}</b></div>}
                {(order as any).loyaltyDiscount > 0 && <div className="flex justify-between text-green-600"><span>Loyalty points ({(order as any).loyaltyPoints})</span><b>-{formatPrice((order as any).loyaltyDiscount)}</b></div>}
                <div className="flex justify-between text-gray-600"><span>Shipping</span><b>{order.shippingCost === 0 ? 'FREE' : formatPrice(order.shippingCost)}</b></div>
                <div className="flex justify-between text-gray-600"><span>Tax</span><b>{formatPrice(order.tax)}</b></div>
                <div className="flex justify-between text-base font-black text-gray-900 pt-1.5 border-t border-gray-200"><span>TOTAL</span><span className="text-brand-700">{formatPrice(order.total)}</span></div>
              </div>
            </div>
            <div className="hidden sm:block overflow-x-auto"><table className="table">
              <thead><tr><th>Product</th><th>SKU</th><th className="text-center">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {order.items.map((item,i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-3">
                        {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 rounded-lg object-cover bg-gray-100"/>}
                        <div>
                          <Link href={`/p/${encodeURIComponent(item.productId)}`} target="_blank" className="font-semibold text-gray-800 text-sm hover:text-brand-700 hover:underline block">{item.productName}</Link>
                          {item.productNameAr && <p className="text-xs text-gray-500" dir="rtl">{item.productNameAr}</p>}
                          {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                          {(item as any).dealId && <p className="text-xs text-amber-700">Offer: {(item as any).dealTitle || 'Flash deal'} (was {formatPrice((item as any).listPrice)} each)</p>}
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
                {(order as any).loyaltyDiscount>0 && <tr><td colSpan={4} className="text-right text-green-600">Loyalty points ({(order as any).loyaltyPoints})</td><td className="text-right font-bold text-green-600">-{formatPrice((order as any).loyaltyDiscount)}</td></tr>}
                <tr><td colSpan={4} className="text-right text-gray-600">Shipping</td><td className="text-right font-bold">{order.shippingCost===0?'FREE':formatPrice(order.shippingCost)}</td></tr>
                <tr><td colSpan={4} className="text-right text-gray-600">Tax</td><td className="text-right font-bold">{formatPrice(order.tax)}</td></tr>
                <tr className="bg-gray-50"><td colSpan={4} className="text-right font-black text-gray-900 text-base">TOTAL</td><td className="text-right font-black text-brand-700 text-lg">{formatPrice(order.total)}</td></tr>
              </tfoot>
            </table></div>
          </div>

          {/* Status History */}
          <div className="card p-4 sm:p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-brand-600"/>Order Timeline</h3>
            <div className="space-y-3">
              {[...(order.statusHistory || [])].reverse().map((h,i) => (
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
        <div className="space-y-4 sm:space-y-5 min-w-0 [overflow-wrap:anywhere]">
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
              {formatAddress(order.shippingAddress).name}<br/>
              {formatAddress(order.shippingAddress).line1}<br/>
              {formatAddress(order.shippingAddress).line2}
              {formatAddress(order.shippingAddress).phone && <><br/><span dir="ltr">{formatAddress(order.shippingAddress).phone}</span></>}
            </p>
          </div>

          {/* Payment */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Payment</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-semibold uppercase">{order.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`badge text-xs font-bold ${order.paymentStatus==='paid'?'badge-green':'badge-yellow'}`}>{order.paymentStatus}</span></div>
              {(order as any).stripePaymentIntent && <div className="flex justify-between"><span className="text-gray-500">Stripe ID</span><span className="font-mono text-xs text-gray-600 truncate max-w-[120px]">{(order as any).stripePaymentIntent}</span></div>}
              {order.couponCode && <div className="flex justify-between"><span className="text-gray-500">Coupon</span><span className="badge-green badge text-xs">{order.couponCode}</span></div>}
            </div>
          </div>

          {/* Next steps: only what the order flow allows */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Next step</h3>
            {steps.length === 0 ? (
              <p className="text-sm text-gray-500">
                {order.status === 'delivered' ? 'Delivered. No more steps; if the customer asks for a return it appears here.' : `This order is ${getStatusLabel(order.status).toLowerCase()}. No further changes are possible.`}
              </p>
            ) : (<>
              <textarea value={statusNote} onChange={e=>setStatusNote(e.target.value)} placeholder="Optional note to customer..." rows={2} className="input-field text-sm py-2 mb-3 resize-none"/>
              <div className="flex flex-col gap-2">
                {steps.filter(x => x !== 'shipped').map(x => (
                  <button key={x} disabled={saving} onClick={() => updateStatus(x)}
                    className={`${x === 'cancelled' || x === 'return_rejected' ? 'btn-outline text-red-600 border-red-200' : 'btn-primary'} w-full py-2 text-sm disabled:opacity-50`}>
                    {saving ? 'Saving…' : STEP_LABEL[x] || getStatusLabel(x)}
                  </button>
                ))}
              </div>
            </>)}
          </div>

          {/* Shipping: carrier + tracking is what moves Processing → Shipped */}
          {['processing', 'shipped'].includes(order.status) && (
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-brand-600"/>{order.status === 'processing' ? 'Ship this order' : 'Tracking info'}</h3>
            {order.trackingNumber && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-sm">
                <p className="font-bold text-green-700">{order.shippingCarrier}: {order.trackingNumber}</p>
              </div>
            )}
            <select value={carrier} onChange={e=>setCarrier(e.target.value)} className="input-field text-sm py-2 mb-2">
              {['UPS','FedEx','USPS','DHL','Aramex','Amazon Logistics','Local courier'].map(c=><option key={c}>{c}</option>)}
            </select>
            <input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Tracking number" className="input-field text-sm py-2 mb-2"/>
            <button onClick={updateTracking} disabled={saving||!tracking} className="btn-primary w-full py-2 text-sm disabled:opacity-50">
              {saving?'Saving...':order.status === 'processing' ? 'Mark as shipped & notify' : 'Update tracking'}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}