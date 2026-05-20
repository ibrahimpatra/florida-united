'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Package, MapPin, CheckCircle, Clock, Truck, XCircle,
  MessageCircle, RotateCcw, ShoppingCart, Loader2, AlertTriangle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatPrice, formatDate, formatDateTime, getStatusLabel, getStatusColor } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import type { Order } from '@/types';

const STEPS = [
  { key: 'pending',    label: 'Order Placed',    icon: CheckCircle },
  { key: 'confirmed',  label: 'Confirmed',        icon: CheckCircle },
  { key: 'processing', label: 'Being Packed',     icon: Clock       },
  { key: 'shipped',    label: 'Out for Delivery', icon: Truck       },
  { key: 'delivered',  label: 'Delivered',        icon: MapPin      },
];
const STEP_ORDER = ['pending','confirmed','processing','shipped','delivered'];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { addItem } = useCartStore();

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(d => { setOrder(d); setLoading(false); })
      .catch(() => { toast.error('Failed to load order'); setLoading(false); });
  }, [id]);

  const canCancel = order && ['pending', 'confirmed'].includes(order.status);
  const canReturn = order && order.status === 'delivered' &&
    !['return_requested','return_approved','return_picked_up','returned','refunded'].includes(order.status);

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', note: 'Cancelled by customer' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Could not cancel order'); return; }
      setOrder(o => o ? { ...o, status: 'cancelled' } : o);
      toast.success('Order cancelled successfully.');
      setShowCancelConfirm(false);
    } catch { toast.error('Failed to cancel. Please contact support.'); }
    setCancelling(false);
  };

  const handleReorder = async () => {
    if (!order) return;
    setReordering(true);
    try {
      const checks = await Promise.all(
        order.items.map(item => fetch(`/api/products/${item.productId}`).then(r => r.ok ? r.json() : null).catch(() => null))
      );
      const unavailable: string[] = [];
      order.items.forEach((item, i) => {
        const prod = checks[i];
        if (!prod || prod.stock === 0) { unavailable.push(item.productName); return; }
        addItem({
          id: item.productId, productId: item.productId, name: item.productName,
          slug: item.productId, price: item.price, image: item.image || '',
          quantity: item.quantity, sku: item.productSku, variantId: undefined,
          variantName: item.variantName, stock: 9999, isReturnable: item.isReturnable ?? true,
        });
      });
      const added = order.items.length - unavailable.length;
      if (added > 0) {
        toast.success(`${added} item${added > 1 ? 's' : ''} added to cart!`);
        router.push('/cart');
      } else {
        toast.error('All items from this order are currently out of stock.');
      }
    } catch { toast.error('Failed to reorder. Please try again.'); }
    setReordering(false);
  };

  const whatsappOrder = () => {
    if (!order) return;
    const msg = `Hi, I have a question about my order #${order.orderNumber} (${formatPrice(order.total)}).`;
    window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '96522225050'}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return (
    <div><Header />
    <div className="container-custom py-20 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
    </div>
    <Footer /></div>
  );

  if (!order) return (
    <div><Header />
    <div className="container-custom py-20 text-center">
      <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500 font-semibold mb-4">Order not found.</p>
      <Link href="/account/orders" className="btn-primary">Back to Orders</Link>
    </div>
    <Footer /></div>
  );

  const currentIdx = STEP_ORDER.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div>
      <Header />
      <main className="bg-gray-50 min-h-screen">
        <div className="page-hero">
          <div className="container-custom flex items-center gap-3">
            <Link href="/account/orders" className="p-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-display">Order #{order.orderNumber}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{formatDateTime(order.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="container-custom py-8 max-w-2xl space-y-5">

          {/* Status + Action Buttons */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className={`badge text-sm font-bold ${getStatusColor(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
              <span className="font-black text-gray-900 text-xl">{formatPrice(order.total)}</span>
            </div>

            {/* Tracking timeline */}
            {!isCancelled ? (
              <div className="relative mb-2">
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0">
                  <div className="h-full bg-brand-600 transition-all duration-700"
                    style={{ width: `${Math.max(0, (currentIdx / (STEPS.length - 1)) * 100)}%` }} />
                </div>
                <div className="relative z-10 flex justify-between">
                  {STEPS.map((step, i) => {
                    const done = i <= currentIdx;
                    const current = i === currentIdx;
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1.5 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${done ? 'bg-brand-600 shadow-md shadow-brand-200' : 'bg-gray-200'} ${current ? 'ring-4 ring-brand-100' : ''}`}>
                          <Icon className={`w-4 h-4 ${done ? 'text-white' : 'text-gray-400'}`} />
                        </div>
                        <p className={`text-xs text-center leading-tight max-w-[60px] ${done ? 'text-brand-700 font-semibold' : 'text-gray-400'}`}>{step.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600 text-sm font-semibold bg-red-50 rounded-xl px-4 py-3 mb-2">
                <XCircle className="w-4 h-4" /> Order Cancelled
              </div>
            )}

            {order.trackingNumber && (
              <div className="mt-3 bg-blue-50 rounded-xl px-4 py-2.5 text-xs text-blue-700">
                🚚 <span className="font-semibold">{order.shippingCarrier}</span>
                <span className="text-blue-400 mx-2">·</span>
                Tracking: <span className="font-mono font-bold">{order.trackingNumber}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
              {canCancel && (
                <button onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors">
                  <XCircle className="w-3.5 h-3.5" /> Cancel Order
                </button>
              )}
              {(['delivered','cancelled'] as const).includes(order.status as any) && (
                <button onClick={handleReorder} disabled={reordering}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-60">
                  {reordering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                  Reorder
                </button>
              )}
              {canReturn && (
                <Link href={`/account/orders?return=${order.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 rounded-xl text-xs font-semibold hover:bg-orange-100 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Request Return
                </Link>
              )}
              <button onClick={whatsappOrder}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Support
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Order Items ({order.items.length})</h3>
            <div className="space-y-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                    {item.image
                      ? <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{item.productName}</p>
                    {item.variantName && <p className="text-xs text-gray-400">{item.variantName}</p>}
                    <p className="text-xs text-gray-400">SKU: {item.productSku} · Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 text-sm">{formatPrice(item.total)}</p>
                    <p className="text-xs text-gray-400">{formatPrice(item.price)} each</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Price Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                  <span>-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{order.shippingCost === 0 ? <span className="text-green-600 font-semibold">FREE</span> : formatPrice(order.shippingCost)}</span>
              </div>
              <div className="flex justify-between font-black text-gray-900 text-base border-t pt-2 mt-1">
                <span>Total</span><span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {order.shippingAddress && (
            <div className="card p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Delivery Address</h3>
              <div className="text-sm text-gray-700 space-y-0.5">
                <p className="font-semibold">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                <p>{order.shippingAddress.address1}</p>
                {order.shippingAddress.floor && <p>Floor {order.shippingAddress.floor}{order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ''}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.governorate}</p>
                <p>Kuwait</p>
                {order.shippingAddress.phone && <p className="text-gray-500 pt-1">📞 {order.shippingAddress.phone}</p>}
              </div>
            </div>
          )}

          {/* Status History */}
          {(order.statusHistory || []).length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Order History</h3>
              <div className="space-y-3">
                {[...(order.statusHistory || [])].reverse().map((h, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${i === 0 ? 'bg-brand-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-semibold text-gray-800">{getStatusLabel(h.status)}</p>
                      {h.note && <p className="text-gray-400 text-xs">{h.note}</p>}
                      {h.createdAt && <p className="text-gray-400 text-xs">{formatDate(h.createdAt)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Cancel this order?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Order <span className="font-semibold text-gray-800">#{order.orderNumber}</span> will be cancelled.
              This cannot be undone. If you already paid, a refund will be processed within 3–5 business days.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Keep Order
              </button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
