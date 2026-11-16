'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Mail, MailCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); } catch {}
    setSent(true); setBusy(false);
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md card p-6 sm:p-8">
        {sent ? (
          <div className="text-center">
            <MailCheck className="w-12 h-12 text-brand-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">{t('c2_reset.sentTitle')}</h1>
            <p className="text-gray-500 text-sm mb-6">{t('c2_reset.sentBody')}</p>
            <Link href="/auth/login" className="btn-primary w-full justify-center"><ArrowLeft className="w-4 h-4 rtl:rotate-180" />{t('c2_reset.back')}</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="text-xl font-bold mb-1">{t('c2_reset.forgotTitle')}</h1>
            <p className="text-gray-500 text-sm mb-5">{t('c2_reset.forgotSub')}</p>
            <label className="label">{t('c2_reset.email')}</label>
            <div className="relative mb-4">
              <Mail className="w-4 h-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} dir="ltr" autoComplete="email" className="input-field ps-10" />
            </div>
            <button disabled={busy} className="btn-primary w-full justify-center">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('c2_reset.send')}</button>
            <Link href="/auth/login" className="block text-center text-sm text-brand-600 mt-4 hover:underline">{t('c2_reset.back')}</Link>
          </form>
        )}
      </div>
    </div>
  );
}
