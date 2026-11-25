'use client';
import { useInApp } from '@/lib/use-in-app';
import { useBrand } from '@/contexts/BrandContext';
import { BrandMark } from '@/components/layout/BrandMark';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { signIn } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/layout/LanguageToggle';

interface FormData { name: string; email: string; phone: string; password: string; confirm: string; }

export default function RegisterPage() {
  const inApp = useInApp();
  const SITE_CONFIG = useBrand();
  const { t, isArabic } = useLanguage();
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
      const json = await res.json();
      if (!res.ok) { toast.error((json.error || t('c2_auth.regFail')) + (json.hint ? ` (${json.hint})` : ''), { duration: json.hint ? 9000 : 4000 }); setLoading(false); return; }
      toast.success(t('c2_auth.created'));
      await signIn('credentials', { email: data.email, password: data.password, redirect: false });
      router.push('/');
    } catch { toast.error(t('c2_auth.wrong')); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 end-4"><LanguageToggle /></div>
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl font-display"><BrandMark /></span>
            </div>
            <div className="text-start">
              <div className="text-brand-700 font-bold text-lg font-display">{isArabic ? SITE_CONFIG.fullNameAr : SITE_CONFIG.name}</div>
              <div className="text-gray-500 text-xs">{t('c2_auth.tagline')}</div>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('c2_auth.regTitle')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('c2_auth.regSub')}</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">{t('c2_auth.fullName')}</label>
              <input {...register('name', { required: t('c2_auth.nameReq'), minLength:{value:2,message:t('c2_auth.nameMin')} })}
                type="text" className="input-field" placeholder={t('c2_auth.fullName')} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">{t('c2_auth.email')}</label>
              <input {...register('email', { required: t('c2_auth.emailReq'), pattern:{value:/^\S+@\S+\.\S+$/,message:t('c2_auth.emailBad')} })}
                type="email" className="input-field" dir="ltr" placeholder="you@example.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">{t('c2_auth.phone')} <span className="text-gray-400 font-normal">{t('c2_auth.optional')}</span></label>
              <input {...register('phone')} type="tel" className="input-field" dir="ltr" placeholder="+965 5000 0000" />
            </div>
            <div>
              <label className="label">{t('c2_auth.password')}</label>
              <div className="relative">
                <input {...register('password', { required:t('c2_auth.pwReq'), minLength:{value:8,message:t('c2_auth.pwMin')} })}
                  type={showPw?'text':'password'} className="input-field pe-10" dir="ltr" />
                <button type="button" onClick={()=>setShowPw(!showPw)} aria-label={showPw ? t('c2_auth.hidePw') : t('c2_auth.showPw')} className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">{t('c2_auth.confirm')}</label>
              <input {...register('confirm', { required:t('c2_auth.confirmReq'), validate: v => v === watch('password') || t('c2_auth.noMatch') })}
                type={showPw?'text':'password'} className="input-field" dir="ltr" />
              {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><UserPlus className="w-4 h-4"/>{t('c2_auth.createBtn')}</>}
            </button>
          </form>
          {!inApp && (<>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"/></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">{t('c2_auth.or')}</span></div>
          </div>
          <button onClick={()=>signIn('google',{callbackUrl:'/'})} className="w-full flex items-center justify-center gap-3 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {t('c2_auth.google')}
          </button>
          </>)}
        </div>
        <p className="text-center text-sm text-gray-500 mt-5">{t('c2_auth.haveAcct')} <Link href="/auth/login" className="text-brand-600 font-semibold hover:underline">{t('c2_auth.signIn')}</Link></p>
      </div>
    </div>
  );
}
