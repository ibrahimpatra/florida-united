import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
export default function NotFoundPage() {
  return (
    <><Header/>
    <main className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6">🔍</div>
        <h1 className="text-6xl font-black text-brand-700 mb-2 font-display">404</h1>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Page Not Found</h2>
        <p className="text-gray-500 mb-8">Looks like this page took a wrong turn at the hardware aisle.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary py-3 px-8">Go Home</Link>
          <Link href="/shop" className="btn-secondary py-3 px-8">Browse Products</Link>
        </div>
      </div>
    </main>
    <Footer/></>
  );
}
