'use client';
import { useEffect } from 'react';
import Link from 'next/link';
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html><body className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6">⚡</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Something went wrong</h1>
        <p className="text-gray-500 mb-8">We hit a snag. Don't worry — our team has been notified.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary py-3 px-6">Try Again</button>
          <Link href="/" className="btn-secondary py-3 px-6">Go Home</Link>
        </div>
      </div>
    </body></html>
  );
}
