'use client';
import { useState } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export function NewsletterSection() {
  const { t, lang } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { toast.error(t('c1_home.nlBad')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), lang }) });
      if (!res.ok) throw new Error();
      toast.success(t('c1_home.nlOk')); setEmail('');
    } catch { toast.error(t('c1_home.nlErr')); }
    setLoading(false);
  };
  return (
    <section className="py-10 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 relative overflow-hidden">
      <div className="relative container-custom text-center">
        <div className="max-w-xl mx-auto">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5"><Mail className="w-7 h-7 text-white" /></div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 font-display">{t('c1_home.nlTitle')}</h2>
          <p className="text-brand-200 mb-8">{t('c1_home.nlSub')}</p>
          <form onSubmit={submit} className="flex gap-2 max-w-md mx-auto">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('c1_home.nlPlaceholder')} required dir="ltr"
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-white/15 backdrop-blur-sm border border-white/30 text-white placeholder-blue-200 outline-none focus:bg-white/25 text-sm" />
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-3 bg-white text-brand-700 font-bold rounded-xl hover:bg-brand-50 transition-colors disabled:opacity-70 text-sm whitespace-nowrap">
              {loading ? <div className="w-4 h-4 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" /> : <><span>{t('c1_home.nlBtn')}</span><ArrowRight className="w-4 h-4 rtl:rotate-180" /></>}
            </button>
          </form>
          <p className="text-brand-300 text-xs mt-3">{t('c1_home.nlFine')}</p>
        </div>
      </div>
    </section>
  );
}
