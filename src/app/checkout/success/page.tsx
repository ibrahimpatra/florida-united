'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, Banknote, ClipboardCheck, CreditCard } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

function SuccessContent() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const orderId = params.get('orderId');
  const orderNo = params.get('n');
  const isCod = params.get('cod') === '1';
  // 'checking' until the server has verified the Stripe payment (the webhook may be a moment behind).
  const [state, setState] = useState<'checking' | 'paid' | 'unpaid'>(isCod || !orderId ? 'paid' : 'checking');
  useEffect(() => {
    if (isCod || !orderId) return;
    let off = false; let tries = 0;
    const tick = async () => {
      try { const d = await (await fetch(`/api/stripe/confirm?orderId=${orderId}`)).json(); if (!off && d.paid) return setState('paid'); } catch {}
      if (off) return;
      if (++tries >= 6) return setState('unpaid');
      setTimeout(tick, 2000);
    };
    tick();
    return () => { off = true; };
  }, [isCod, orderId]);
  if (state === 'checking') return <main className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-500"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /><p>{t('c2_pay.verifying')}</p></main>;
  if (state === 'unpaid') return (
    <main className="min-h-screen flex items-center justify-center p-4"><div className="card p-8 max-w-md text-center">
      <h1 className="text-xl font-bold mb-2">{t('c2_pay.unpaidTitle')}</h1><p className="text-gray-500 mb-5">{t('c2_pay.notYet')}</p>
      <Link href={orderId ? `/account/orders/${orderId}` : '/account/orders'} className="btn-primary w-full justify-center"><Package className="w-4 h-4" /> {t('c2_ok.track')}</Link>
    </div></main>);

  return (
    <main className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="card p-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            {isCod
              ? <Banknote className="w-10 h-10 text-green-600" />
              : <CheckCircle className="w-10 h-10 text-green-600" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2 font-display">
            {isCod ? t('c2_ok.codTitle') : t('c2_ok.paidTitle')}
          </h1>
          <p className="text-gray-500 mb-6">
            {isCod ? t('c2_ok.codBody') : t('c2_ok.paidBody')}
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-gray-600 space-y-2 text-start">
            <p className="flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-brand-600" />{t('c2_ok.l1')}</p>
            <p className="flex items-center gap-2">{isCod ? <Banknote className="w-4 h-4 text-brand-600" /> : <CreditCard className="w-4 h-4 text-brand-600" />}{isCod ? t('c2_ok.l2cod') : t('c2_ok.l2paid')}</p>
          </div>

          {orderNo && (
            <div className="mb-6">
              <p className="text-xs text-gray-400 mb-1">{t('c2_ok.orderNo')}</p>
              <p className="text-2xl font-black tracking-wider text-gray-900 font-mono bg-gray-100 rounded-xl px-4 py-3" dir="ltr">{orderNo}</p>
            </div>
          )}

          <div className="space-y-3">
            <Link href={orderId ? `/account/orders/${orderId}` : '/account/orders'} className="btn-primary w-full justify-center">
              <Package className="w-4 h-4" /> {t('c2_ok.track')}
            </Link>
            <Link href="/shop" className="btn-secondary w-full justify-center">
              {t('c2_ok.continue')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <>
      <Header />
      <Suspense fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </main>
      }>
        <SuccessContent />
      </Suspense>
      <Footer />
    </>
  );
}