'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Package, MapPin, CheckCircle, Clock, Truck, XCircle,
  MessageCircle, RotateCcw, CreditCard, Banknote, ShoppingCart, Loader2, FileText, X,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatPrice, formatDate, formatDateTime, getStatusColor, statusText, govLabel } from '@/lib/utils';
import { reorder } from '@/lib/reorder';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { returnDaysLeft, returnWindowDays } from '@/lib/returns';
import { SmartReturnFlow } from '@/components/returns/SmartReturnFlow';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { CancelOrderModal } from '@/components/orders/CancelOrderModal';
import { useCartStore } from '@/store/cartStore';
import type { Order } from '@/types';

const STEPS = [
  { key: 'pending',    icon: CheckCircle },
  { key: 'confirmed',  icon: CheckCircle },
  { key: 'processing', icon: Clock       },
  { key: 'shipped',    icon: Truck       },
  { key: 'delivered',  icon: MapPin      },
];
const STEP_ORDER = ['pending','confirmed','processing','shipped','delivered'];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const [showReturn, setShowReturn] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [paying, setPaying] = useState(false);
  const { addItem } = useCartStore();
  const { t, L, isArabic, lang } = useLanguage();

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { setOrder(d && d.id ? d : null); setLoading(false); })
      .catch(() => { toast.error(t('c2_ord.loadFail')); setLoading(false); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (order && search.get('return') === '1' && order.status === 'delivered') setShowReturn(true); }, [order, search]);

  const o: any = order;
  const payKey = !o ? '' : o.paymentMethod !== 'card' ? 'statusCod'
    : o.paymentStatus === 'paid' ? 'statusPaid' : o.paymentStatus === 'refunded' ? 'statusRefunded'
    : o.paymentStatus === 'refund_pending' ? 'statusRefundPending' : o.status === 'cancelled' ? 'statusCancelled' : 'statusPending';
  const canPay = !!o && o.paymentMethod === 'card' && o.paymentStatus !== 'paid' && o.status === 'pending';
  const payNow = async () => {
    setPaying(true);
    try {
      const r = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: id }) });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.error || t('c2_pay.payNowFail'));
      window.location.href = d.url;
    } catch (e: any) { toast.error(e.message || t('c2_pay.payNowFail')); setPaying(false); }
  };
  const canCancel = order && ['pending', 'confirmed'].includes(order.status);
  const retSettings = useStoreSettings();
  const retWindow = returnWindowDays(retSettings.returnWindowDays);
  const retLeft = order ? returnDaysLeft(order, retWindow) : null;
  // the Return button exists only while the order is delivered AND inside the return window
  const canReturn = !!order && order.status === 'delivered' && (retLeft === null || retLeft >= 0);
  const returnClosed = !!order && order.status === 'delivered' && retLeft !== null && retLeft < 0;

  const handleReorder = async () => {
    if (!order) return;
    setReordering(true);
    try {
      const { added, unavailable } = await reorder(order, addItem, lang);
      if (added > 0) {
        toast.success(unavailable.length ? t('c2_ord.someOut', { n: added, names: unavailable.join(', ') }) : t('c2_ord.reordered', { n: added }), { duration: 5000 });
        router.push('/cart');
      } else toast.error(t('c2_ord.allOut'));
    } catch { toast.error(t('c2_ord.reorderFail')); }
    setReordering(false);
  };

  const whatsappOrder = () => {
    if (!order) return;
    const msg = t('c2_ord.waMsg', { no: order.orderNumber, total: formatPrice(order.total) });
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
      <p className="text-gray-500 font-semibold mb-4">{t('orders.notFound')}</p>
      <Link href="/account/orders" className="btn-primary">{t('orders.backToOrders')}</Link>
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
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-display" dir="ltr">{t('orders.orderNumber')} #{order.orderNumber}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{formatDateTime(order.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="container-custom py-8 max-w-2xl space-y-5">

          {/* Status + Action Buttons */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className={`badge text-sm font-bold ${getStatusColor(order.status)}`}>
                {statusText(t, order.status)}
              </span>
              <span className="font-black text-gray-900 text-xl">{formatPrice(order.total)}</span>
            </div>

            {/* Tracking timeline */}
            {!isCancelled ? (
              <div className="relative mb-2">
                <div className="absolute top-4 inset-x-4 h-0.5 bg-gray-200 z-0">
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
                        <p className={`text-xs text-center leading-tight max-w-[70px] ${done ? 'text-brand-700 font-semibold' : 'text-gray-400'}`}>{t(`c2_ord.step_${step.key}`)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600 text-sm font-semibold bg-red-50 rounded-xl px-4 py-3 mb-2">
                <XCircle className="w-4 h-4" /> {t('orders.orderCancelled')}
              </div>
            )}

            {order.trackingNumber && (
              <div className="mt-3 bg-brand-50 rounded-xl px-4 py-2.5 text-xs text-brand-700">
                <Truck className="w-3.5 h-3.5 inline me-1" /><span className="font-semibold">{order.shippingCarrier}</span>
                <span className="text-brand-400 mx-2">&middot;</span>
                {t('c2_ord.tracking')}: <span className="font-mono font-bold" dir="ltr">{order.trackingNumber}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
              {canCancel && (
                <button onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors">
                  <XCircle className="w-3.5 h-3.5" /> {t('orders.cancelOrder')}
                </button>
              )}
              {(['delivered','cancelled'] as const).includes(order.status as any) && (
                <button onClick={handleReorder} disabled={reordering}
                  className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 rounded-xl text-xs font-semibold hover:bg-brand-100 transition-colors disabled:opacity-60">
                  {reordering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                  {t('orders.reorder')}
                </button>
              )}
              {canReturn && (
                <button onClick={() => setShowReturn(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 rounded-xl text-xs font-semibold hover:bg-orange-100 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> {t('orders.requestReturn')}{retLeft !== null && retLeft <= 2 ? <span className="text-[10px] font-bold">({retLeft === 0 ? t('c2_ret.lastDay') : t('c2_ret.daysLeftN', { n: retLeft })})</span> : null}
                </button>
              )}
              {returnClosed && <span className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-xs font-semibold">{t('c2_ret.winClosed')}</span>}
              <a href={`/api/orders/${order.id}/invoice`} target="_blank" rel="noopener"
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors">
                <FileText className="w-3.5 h-3.5" /> {t('orders.downloadInvoice')}
              </a>
              <button onClick={whatsappOrder}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> {t('orders.whatsappSupport')}
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-500 mb-4">{t('orders.orderItems')} ({order.items.length})</h3>
            <div className="space-y-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                    {item.image
                      ? <img src={item.image} alt={L({ name: item.productName, nameAr: item.productNameAr }, 'name')} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-gray-300" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/p/${encodeURIComponent(item.productId)}`} className="font-semibold text-gray-800 text-sm hover:text-brand-700 hover:underline block">{L({ name: item.productName, nameAr: item.productNameAr }, 'name')}</Link>
                    {item.variantName && <p className="text-xs text-gray-400">{L({ name: item.variantName, nameAr: item.variantNameAr }, 'name')}</p>}
                    <p className="text-xs text-gray-400">{t('c2_ord.sku')}: <span dir="ltr">{item.productSku}</span> &middot; {t('c2_ord.qty')}: {item.quantity}</p>
                    {(item as any).dealId && <p className="text-xs text-amber-700 font-medium">{t('c2_ord.offerApplied', { title: L({ t: (item as any).dealTitle, tAr: (item as any).dealTitleAr } as any, 't') || '' })}</p>}
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className="font-bold text-gray-900 text-sm">{formatPrice(item.total)}</p>
                    {(item as any).listPrice > item.price && <p className="text-xs text-gray-400 line-through">{formatPrice((item as any).listPrice * item.quantity)}</p>}
                    <p className="text-xs text-gray-400">{t('c2_ord.each', { price: formatPrice(item.price) })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-500 mb-4">{t('c2_pay.method')}</h3>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-semibold text-gray-800">
                {o.paymentMethod === 'card' ? <CreditCard className="w-4 h-4 text-brand-600" /> : <Banknote className="w-4 h-4 text-green-600" />}
                {o.paymentMethod === 'card' ? t('c2_pay.mCard') : t('c2_pay.mCod')}
              </span>
              <span className="badge bg-gray-100 text-gray-700">{t('c2_pay.' + payKey)}</span>
            </div>
            {o.paymentMethod === 'card' && o.usdAmount > 0 && o.paymentStatus === 'paid' && (
              <p className="text-xs text-gray-500 mt-2">{t('c2_pay.charged')}: <span dir="ltr">USD {Number(o.usdAmount).toFixed(2)}</span></p>
            )}
            {search.get('payment') === 'cancelled' && canPay && <p className="text-xs text-amber-700 mt-3">{t('c2_pay.cancelledMsg')}</p>}
            {canPay && (
              <button onClick={payNow} disabled={paying} className="btn-primary w-full justify-center mt-4">
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} {t('c2_pay.payNow')}
              </button>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-500 mb-4">{t('orders.priceBreakdown')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>{t('orders.subtotal')}</span><span>{formatPrice(order.subtotal)}</span></div>
              {(order as any).dealDiscount > 0 && (
                <div className="flex justify-between text-amber-700 text-xs"><span>{t('c2_ord.offerSaved')} ({t('c2_ord.included')})</span><span>{formatPrice((order as any).dealDiscount)}</span></div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{t('c2_ord.discount')}{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                  <span>-{formatPrice(order.discount)}</span>
                </div>
              )}
              {(order as any).loyaltyDiscount > 0 && (
                <div className="flex justify-between text-green-600"><span>{t('c4_loy.line')} ({(order as any).loyaltyPoints})</span><span>-{formatPrice((order as any).loyaltyDiscount)}</span></div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>{t('orders.shipping')}</span>
                <span>{order.shippingCost === 0 ? <span className="text-green-600 font-semibold">{t('orders.free')}</span> : formatPrice(order.shippingCost)}</span>
              </div>
              <div className="flex justify-between font-black text-gray-900 text-base border-t pt-2 mt-1">
                <span>{t('orders.grandTotal')}</span><span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {order.shippingAddress && (
            <div className="card p-5">
              <h3 className="text-xs font-bold text-gray-500 mb-3">{t('orders.deliveryAddress')}</h3>
              <div className="text-sm text-gray-700 space-y-0.5">
                <p className="font-semibold">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                {(order.shippingAddress as any).block
                  ? <p>{t('c2_ord.addrLine', { block: (order.shippingAddress as any).block, street: (order.shippingAddress as any).street, building: (order.shippingAddress as any).building })}</p>
                  : <p>{order.shippingAddress.address1}</p>}
                {order.shippingAddress.floor && <p>{t('c2_ord.floor', { n: order.shippingAddress.floor })}{order.shippingAddress.apartment ? `، ${order.shippingAddress.apartment}` : ''}</p>}
                <p>{order.shippingAddress.city}, {govLabel(order.shippingAddress.governorate, isArabic)}</p>
                <p>{t('c2_ord.kuwait')}</p>
                {order.shippingAddress.phone && <p className="text-gray-500 pt-1" dir="ltr">{order.shippingAddress.phone}</p>}
              </div>
            </div>
          )}

          {/* Status History */}
          {(order.statusHistory || []).length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-bold text-gray-500 mb-3">{t('orders.history')}</h3>
              <div className="space-y-3">
                {[...(order.statusHistory || [])].reverse().map((h, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${i === 0 ? 'bg-brand-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-semibold text-gray-800">{statusText(t, h.status)}</p>
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

      {showReturn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">{t('c2_ord.returnTitle')}</h3>
              <button onClick={() => setShowReturn(false)} aria-label={t('c2_ret.close')} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <SmartReturnFlow order={order} onCancel={() => setShowReturn(false)}
              onSuccess={() => { setShowReturn(false); fetch(`/api/orders/${id}`).then(r => (r.ok ? r.json() : null)).then(d => d?.id && setOrder(d)); }} />
          </div>
        </div>
      )}
      {showCancelConfirm && (
        <CancelOrderModal orderId={order.id} orderNumber={order.orderNumber}
          onClose={() => setShowCancelConfirm(false)}
          onCancelled={() => { setOrder(o => o ? { ...o, status: 'cancelled' } : o); setShowCancelConfirm(false); }} />
      )}
      <Footer />
    </div>
  );
}
