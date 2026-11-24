'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { sendClientIssue } from '@/components/layout/ClientIssueLogger';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const isAdmin = String((session?.user as any)?.role || '').toLowerCase() === 'admin';
  useEffect(() => { console.error(error); sendClientIssue('render', `${error?.message || 'render error'}${error?.digest ? ` (digest ${error.digest})` : ''}`); }, [error]);
  return (
    <main className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto mb-5" />
        <h1 className="text-3xl font-bold text-gray-900 mb-3">{t('c1_err.errTitle')}</h1>
        <p className="text-gray-500 mb-8">{t('c1_err.errBody')}</p>
        {isAdmin && <p className="mb-6 rounded-lg bg-red-50 p-3 text-start text-xs text-red-800 break-words" dir="ltr">[admin only] {error?.message}{error?.digest ? ` (digest ${error.digest})` : ''}</p>}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary py-3 px-6">{t('c1_err.retry')}</button>
          <Link href="/" className="btn-secondary py-3 px-6">{t('c1_err.home')}</Link>
        </div>
      </div>
    </main>
  );
}
