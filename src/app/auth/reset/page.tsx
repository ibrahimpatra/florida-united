'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function ResetForm() {
  const { t } = useLanguage();
  const token = useSearchParams().get('token') || '';
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'bad'>(token ? 'form' : 'bad');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (pw.length < 8) return setErr(t('c2_reset.short'));
    if (pw !== pw2) return setErr(t('c2_reset.mismatch'));
    setBusy(true);
    try {
      const r = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: pw }) });
      if (r.ok) setState('done'); else if (r.status === 400 && (await r.json().catch(() => ({}))).error === 'INVALID') setState('bad'); else setErr(t('c2_reset.fail'));
    } catch { setErr(t('c2_reset.fail')); }
    setBusy(false);
  };
  if (state === 'done') return (
    <div className="text-center"><CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" /><p className="mb-6">{t('c2_reset.done')}</p>
      <Link href="/auth/login" className="btn-primary w-full justify-center">{t('c2_reset.back')}</Link></div>);
  if (state === 'bad') return (
    <div className="text-center"><AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" /><p className="mb-6">{t('c2_reset.badLink')}</p>
      <Link href="/auth/forgot" className="btn-primary w-full justify-center">{t('c2_reset.newLink')}</Link></div>);
  return (
    <form onSubmit={submit}>
      <h1 className="text-xl font-bold mb-5">{t('c2_reset.resetTitle')}</h1>
      <label className="label">{t('c2_reset.newPw')}</label>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} dir="ltr" autoComplete="new-password" className="input-field mb-4" required />
      <label className="label">{t('c2_reset.confirmPw')}</label>
      <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} dir="ltr" autoComplete="new-password" className="input-field mb-4" required />
      {err && <p className="text-red-500 text-sm mb-3">{err}</p>}
      <button disabled={busy} className="btn-primary w-full justify-center">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('c2_reset.save')}</button>
    </form>);
}
export default function ResetPasswordPage() {
  return <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50"><div className="w-full max-w-md card p-6 sm:p-8"><Suspense><ResetForm /></Suspense></div></div>;
}
