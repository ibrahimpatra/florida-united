'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, Banknote } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get('orderId');
  const isCod = params.get('cod') === '1';

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
            {isCod ? 'Order Placed! 🎉' : 'Payment Confirmed! 🎉'}
          </h1>
          <p className="text-gray-500 mb-6">
            {isCod
              ? "Your order has been placed successfully. Our delivery team will contact you before arrival. Please have the exact amount ready."
              : "Thank you for your purchase! We've sent a confirmation email with your order details and receipt."}
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-gray-600 space-y-2 text-left">
            <p>✅ Order confirmation email sent</p>
            <p>📦 Your order is being processed</p>
            {isCod
              ? <p>💵 Pay cash when your order arrives</p>
              : <p>💳 Payment received via TAP</p>}
            <p>🚚 Delivery within Kuwait — 1-3 business days</p>
          </div>

          {orderId && (
            <p className="text-xs text-gray-400 mb-4 font-mono bg-gray-100 rounded-lg px-3 py-2">
              Order ID: {orderId}
            </p>
          )}

          <div className="space-y-3">
            <Link href="/account/orders" className="btn-primary w-full justify-center">
              <Package className="w-4 h-4" /> Track My Order
            </Link>
            <Link href="/shop" className="btn-secondary w-full justify-center">
              Continue Shopping <ArrowRight className="w-4 h-4" />
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