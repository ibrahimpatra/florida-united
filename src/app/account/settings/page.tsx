'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { Save, User, Lock, Eye, EyeOff } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AccountSettingsPage() {
  const { t } = useLanguage();
  const { data: session, update } = useSession();
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  const profileForm = useForm({ defaultValues: { name: session?.user?.name || '', phone: '', email: session?.user?.email || '' } });
  const passwordForm = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>();

  // Load the saved phone number / name
  useEffect(() => {
    fetch('/api/account/profile').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d) profileForm.reset({ name: d.name || session?.user?.name || '', phone: d.phone || '', email: session?.user?.email || '' });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  const saveProfile = async (data: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/account/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: data.name, phone: data.phone }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { toast.success(t('c2_set.updated')); await update({ name: data.name }); }
      else toast.error(j.error || t('c2_set.updFail'));
    } catch { toast.error(t('c2_set.err')); }
    setSaving(false);
  };

  const savePassword = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) { toast.error(t('c2_set.noMatch')); return; }
    if (data.newPassword.length < 8) { toast.error(t('c2_set.min8')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/account/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) { toast.success(t('c2_set.pwUpdated')); passwordForm.reset(); }
      else toast.error(result.error || t('c2_set.failed'));
    } catch { toast.error(t('c2_set.err')); }
    setSaving(false);
  };

  if (!session) return null;
  const tabs = [['profile', t('c2_set.profile'), User], ['password', t('c2_set.password'), Lock]] as const;
  const pwFields = [['currentPassword', t('c2_set.cur')], ['newPassword', t('c2_set.new')], ['confirmPassword', t('c2_set.confirm')]] as const;

  return (
    <><Header />
    <main className="bg-gray-50 min-h-screen">
      <div className="page-hero"><div className="container-custom"><h1 className="text-2xl font-bold text-gray-900 font-display">{t('c2_set.title')}</h1></div></div>
      <div className="container-custom py-5 max-w-2xl">
        <div className="flex gap-1 border-b border-gray-200 mb-5">
          {tabs.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <form onSubmit={profileForm.handleSubmit(saveProfile)} className="card p-6 space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">{t('c2_set.profInfo')}</h2>
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-16 h-16 bg-brand-100 text-brand-700 rounded-2xl flex items-center justify-center text-2xl font-black">{session.user.name?.[0] || 'U'}</div>
              <div><p className="font-bold text-gray-900">{session.user.name}</p><p className="text-sm text-gray-500" dir="ltr">{session.user.email}</p></div>
            </div>
            <div><label className="label">{t('c2_set.fullName')}</label><input {...profileForm.register('name', { required: true })} className="input-field" /></div>
            <div><label className="label">{t('c2_set.email')}</label><input {...profileForm.register('email')} type="email" disabled dir="ltr" className="input-field opacity-60 cursor-not-allowed" title={t('c2_set.emailLocked')} /></div>
            <div><label className="label">{t('c2_set.phone')}</label><input {...profileForm.register('phone')} type="tel" dir="ltr" className="input-field" placeholder="+965 5000 0000" /></div>
            <button type="submit" disabled={saving} className="btn-primary py-2.5 px-6 text-sm">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t('c2_set.saveProfile')}</>}
            </button>
          </form>
        )}

        {tab === 'password' && (
          <form onSubmit={passwordForm.handleSubmit(savePassword)} className="card p-6 space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">{t('c2_set.changePw')}</h2>
            {pwFields.map(([field, label], i) => (
              <div key={field}>
                <label className="label">{label}</label>
                <div className="relative">
                  <input {...passwordForm.register(field, { required: true })} type={showPw ? 'text' : 'password'} dir="ltr" className="input-field pe-10" />
                  {i === 0 && <button type="button" aria-label={t('c2_set.show')} onClick={() => setShowPw(!showPw)} className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
                </div>
              </div>
            ))}
            <div className="bg-brand-50 rounded-xl p-3 text-xs text-brand-700">{t('c2_set.pwHint')}</div>
            <button type="submit" disabled={saving} className="btn-primary py-2.5 px-6 text-sm">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Lock className="w-4 h-4" />{t('c2_set.updatePw')}</>}
            </button>
          </form>
        )}
      </div>
    </main>
    <Footer /></>
  );
}
