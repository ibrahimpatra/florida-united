'use client';
import { useState } from 'react';
import { Search, Truck, CheckCircle, Clock, MapPin, ClipboardList, PackageCheck } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatDateTime, formatPrice, statusText } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const STEPS = [
  { key: 'pending', icon: ClipboardList }, { key: 'confirmed', icon: CheckCircle }, { key: 'processing', icon: Clock },
  { key: 'shipped', icon: Truck }, { key: 'delivered', icon: MapPin },
];

export default function OrderTrackingPage() {
  const { t, L } = useLanguage();
  const [orderNo, setOrderNo] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState('');

  const track = async () => {
    if (!orderNo.trim() || !contact.trim()) { setError(t('c2_trk.need')); return; }
    setLoading(true); setError(''); setOrder(null);
    try {
      const res = await fetch('/api/orders/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber: orderNo, contact }) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.orderNumber) setOrder(data);
      else setError(res.status === 404 ? t('c2_trk.notFound') : t('c2_trk.fail'));
    } catch { setError(t('c2_trk.fail')); }
    setLoading(false);
  };

  // 'out_for_delivery' counts as shipped for the progress bar
  const idx = order ? STEPS.findIndex(s => s.key === (order.status === 'out_for_delivery' ? 'shipped' : order.status)) : -1;
  const showProgress = order && idx >= 0 && !['cancelled', 'returned', 'refunded'].includes(order.status);
  const onKey = (e: React.KeyboardEvent) => e.key === 'Enter' && track();

  return (
    <><Header />
    <main className="bg-gray-50 min-h-screen">
      <div className="page-hero"><div className="container-custom"><h1 className="text-3xl font-bold text-gray-900 font-display">{t('c2_trk.title')}</h1><p className="text-gray-500 mt-1">{t('c2_trk.sub')}</p></div></div>
      <div className="container-custom py-10 max-w-3xl">
        <div className="card p-6 mb-8">
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
            <input value={orderNo} onChange={e => setOrderNo(e.target.value)} onKeyDown={onKey} placeholder={t('c2_trk.numPh')} dir="ltr" className="input-field" />
            <input value={contact} onChange={e => setContact(e.target.value)} onKeyDown={onKey} placeholder={t('c2_trk.contactPh')} dir="ltr" className="input-field" />
            <button onClick={track} disabled={loading} className="btn-primary px-6 justify-center">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Search className="w-4 h-4" />{t('c2_trk.track')}</>}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>

        {order && (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex flex-wrap gap-4 justify-between mb-4">
                <div><p className="text-xs text-gray-500 uppercase tracking-wide">{t('c2_trk.orderNo')}</p><p className="text-xl font-black text-brand-700" dir="ltr">#{order.orderNumber}</p></div>
                <div><p className="text-xs text-gray-500 uppercase tracking-wide">{t('c2_trk.status')}</p><span className={`badge badge-${order.status === 'delivered' ? 'green' : order.status === 'cancelled' ? 'red' : order.status.includes('ship') ? 'blue' : 'yellow'} font-bold`}>{statusText(t, order.status)}</span></div>
                <div><p className="text-xs text-gray-500 uppercase tracking-wide">{t('c2_trk.total')}</p><p className="text-xl font-bold text-gray-900">{formatPrice(order.total)}</p></div>
                <div><p className="text-xs text-gray-500 uppercase tracking-wide">{t('c2_trk.ordered')}</p><p className="text-sm font-medium text-gray-700">{formatDateTime(order.createdAt)}</p></div>
              </div>
              {order.trackingNumber && (
                <div className="bg-brand-50 rounded-xl p-3 flex gap-3 text-sm">
                  <Truck className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                  <div><p className="font-bold text-brand-800">{t('c2_trk.trackingNo')}: <span dir="ltr">{order.trackingNumber}</span></p>{order.shippingCarrier && <p className="text-brand-600">{t('c2_trk.carrier')}: {order.shippingCarrier}</p>}</div>
                </div>
              )}
            </div>

            {showProgress && (
              <div className="card p-6">
                <h3 className="font-bold text-gray-800 mb-6">{t('c2_trk.progress')}</h3>
                <div className="relative">
                  <div className="absolute top-4 inset-x-4 h-0.5 bg-gray-200"><div className="h-full bg-brand-600 transition-all duration-500" style={{ width: `${(idx / (STEPS.length - 1)) * 100}%` }} /></div>
                  <div className="relative flex justify-between">
                    {STEPS.map((s, i) => { const Icon = s.icon; return (
                      <div key={s.key} className="flex flex-col items-center gap-2 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all ${i <= idx ? 'bg-brand-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}><Icon className="w-4 h-4" /></div>
                        <p className={`text-xs font-medium text-center hidden sm:block ${i <= idx ? 'text-brand-700' : 'text-gray-400'}`}>{t(`c2_trk.step_${s.key}`)}</p>
                      </div>); })}
                  </div>
                </div>
              </div>
            )}

            <div className="card p-6">
              <h3 className="font-bold text-gray-800 mb-4">{t('c2_trk.timeline')}</h3>
              <div className="space-y-3">
                {[...(order.statusHistory || [])].reverse().map((h: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${i === 0 ? 'bg-brand-600' : 'bg-gray-300'}`} />
                    <div><p className="text-sm font-semibold text-gray-800">{statusText(t, h.status)}</p>{h.note && <p className="text-xs text-gray-500">{h.note}</p>}<p className="text-xs text-gray-400 mt-0.5">{formatDateTime(h.createdAt)}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><PackageCheck className="w-5 h-5 text-brand-600" />{t('c2_trk.items')}</h3>
              <div className="space-y-3">
                {order.items.map((item: any, i: number) => (
                  <div key={i} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">{item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}</div>
                    <div className="flex-1"><p className="text-sm font-semibold text-gray-800">{L({ name: item.productName, nameAr: item.productNameAr }, 'name')}</p><p className="text-xs text-gray-500">{t('c2_trk.sku')}: <span dir="ltr">{item.productSku}</span> &middot; {t('c2_trk.qty')}: {item.quantity}</p></div>
                    <span className="font-bold text-gray-800">{formatPrice(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
    <Footer /></>
  );
}
