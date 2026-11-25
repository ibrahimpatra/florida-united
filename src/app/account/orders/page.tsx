'use client';
import { useEffect, useState } from 'react';
import { Package, RotateCcw, MessageCircle, ShoppingCart, XCircle } from 'lucide-react';
import { CancelOrderModal } from '@/components/orders/CancelOrderModal';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatPrice, formatDate, statusText } from '@/lib/utils';
import { reorder } from '@/lib/reorder';
import { toast } from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Order } from '@/types';

const STATUS_COLOR: Record<string,string> = {
  delivered:'badge-green', cancelled:'badge-red', shipped:'badge-blue',
  pending:'badge-yellow', confirmed:'badge-blue', processing:'badge-blue',
  return_requested:'badge-orange', refunded:'badge-green',
};

export default function OrdersPage() {
  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [cancelModal, setCancelModal] = useState<Order|null>(null);
  const [reordering, setReordering]   = useState<string|null>(null);
  const { addItem }                   = useCartStore();
  const { t, L, dir, lang }           = useLanguage();

  useEffect(() => {
    fetch('/api/orders').then(r=>r.json()).then(d=>{ setOrders(d.items||[]); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  const canReturn = (o: Order) =>
    o.status === 'delivered' &&
    !['return_requested','return_approved','return_picked_up','returned','refunded'].includes(o.status);

  const canCancel = (o: Order) => ['pending', 'confirmed'].includes(o.status);


  const handleReorder = async (order: Order) => {
    setReordering(order.id);
    try {
      const { added, unavailable } = await reorder(order, addItem, lang);
      if (added > 0) toast.success(unavailable.length ? t('c2_ord.someOut', { n: added, names: unavailable.join(', ') }) : t('c2_ord.reordered', { n: added }), { duration: 5000 });
      else toast.error(t('c2_ord.allOut'));
    } catch { toast.error(t('c2_ord.reorderFail')); }
    setReordering(null);
  };

  const whatsappOrder = (order: Order) => {
    const msg = t('c2_ord.waMsg', { no: order.orderNumber, total: formatPrice(order.total) });
    window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||'96522225050'}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div dir={dir}>
      <Header/>
      <main className="bg-gray-50 min-h-screen">
        <div className="page-hero">
          <div className="container-custom">
            <h1 className="text-2xl font-bold text-gray-900 font-display">{t('orders.title')}</h1>
            <p className="text-gray-500 mt-1">{orders.length} {t('orders.total')}</p>
          </div>
        </div>

        <div className="container-custom py-5 max-w-3xl">
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i=>(
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"/>
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"/>
                <div className="h-4 bg-gray-100 rounded w-2/3"/>
              </div>
            ))}</div>
          ) : orders.length===0 ? (
            <div className="card p-16 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
              <p className="text-gray-500 font-semibold mb-4">{t('orders.empty')}</p>
              <Link href="/shop" className="btn-primary">{t('orders.startShopping')}</Link>
            </div>
          ) : orders.map(o => {
            return (
              <div key={o.id} className="card mb-4 overflow-hidden">
                {/* ── Order header ── */}
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <span className="font-bold text-brand-700 text-base">#{o.orderNumber}</span>
                      <span className={`ms-2 badge text-xs font-bold ${STATUS_COLOR[o.status]||'badge-gray'}`}>{statusText(t, o.status)}</span>
                    </div>
                    <div className="text-end">
                      <p className="font-black text-gray-900 text-lg">{formatPrice(o.total)}</p>
                      <p className="text-xs text-gray-500">{formatDate(o.createdAt)}</p>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
                    {o.items.slice(0,4).map((item,i)=>(
                      <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs">
                        {item.image && <img src={item.image} alt={L({ name: item.productName, nameAr: item.productNameAr }, 'name')} className="w-8 h-8 rounded-lg object-cover"/>}
                        <div>
                          <Link href={`/p/${encodeURIComponent(item.productId)}`} className="font-medium text-gray-800 max-w-[110px] truncate block hover:text-brand-700 hover:underline">{L({ name: item.productName, nameAr: item.productNameAr }, 'name')}</Link>
                          <p className="text-gray-400">&times;{item.quantity} &middot; {formatPrice(item.price)}</p>
                        </div>
                      </div>
                    ))}
                    {o.items.length>4 && <div className="flex-shrink-0 flex items-center px-3 text-xs text-gray-500">{t('c2_ord.more', { n: o.items.length-4 })}</div>}
                  </div>



                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Link
                      href={`/account/orders/${o.id}`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 rounded-xl text-xs font-semibold hover:bg-brand-100 transition-colors"
                    >
                      <Package className="w-3.5 h-3.5"/>
                      {t('orders.viewDetails')}
                    </Link>

                    {canCancel(o) && (
                      <button
                        onClick={() => setCancelModal(o)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5"/>
                        {t('orders.cancelOrder')}
                      </button>
                    )}

                    <button
                      onClick={() => handleReorder(o)}
                      disabled={reordering===o.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 rounded-xl text-xs font-semibold hover:bg-brand-100 transition-colors disabled:opacity-60"
                    >
                      {reordering===o.id
                        ? <div className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"/>
                        : <ShoppingCart className="w-3.5 h-3.5"/>}
                      {t('orders.reorder')}
                    </button>

                    {canReturn(o) && (
                      <Link href={`/account/orders/${o.id}?return=1`} className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 rounded-xl text-xs font-semibold hover:bg-orange-100 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5"/>{t('orders.requestReturn')}
                      </Link>
                    )}

                    <button onClick={()=>whatsappOrder(o)} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5"/>{t('c2_ord.whatsapp')}
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </main>

      {cancelModal && (
        <CancelOrderModal orderId={cancelModal.id} orderNumber={cancelModal.orderNumber}
          onClose={() => setCancelModal(null)}
          onCancelled={() => { setOrders(os => os.map(o => o.id === cancelModal.id ? { ...o, status: 'cancelled' } : o)); setCancelModal(null); }} />
      )}
      <Footer/>
    </div>
  );
}
