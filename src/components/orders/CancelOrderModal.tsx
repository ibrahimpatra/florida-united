'use client';
import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

/** Shared by the orders list and the order page. The server decides if cancelling is allowed. */
export function CancelOrderModal({ orderId, orderNumber, onClose, onCancelled }: {
  orderId: string; orderNumber: string; onClose: () => void; onCancelled: (needsRefund: boolean) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', note: 'Cancelled by customer' }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { toast.error(d?.error || t('orders.cancelFailed')); setBusy(false); if (res.status === 400) onClose(); return; }
      toast.success(t('orders.cancelledOk'));
      if (d?.needsRefund) toast(t('orders.refundNote'), { duration: 8000 });
      onCancelled(!!d?.needsRefund);
    } catch { toast.error(t('orders.cancelFailed')); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
          <h3 className="font-bold text-gray-900">{t('orders.cancelTitle')}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-1 font-mono" dir="ltr">#{orderNumber}</p>
        <p className="text-sm text-gray-500 mb-5">{t('orders.cancelBody')}</p>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">{t('orders.keepOrder')}</button>
          <button onClick={go} disabled={busy} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('orders.yesCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
