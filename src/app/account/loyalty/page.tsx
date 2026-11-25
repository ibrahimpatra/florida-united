'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Gift, Clock, ArrowDownCircle, ArrowUpCircle, Sparkles, Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice, formatDate } from '@/lib/utils';
import { useLoyaltyState } from '@/components/loyalty/useLoyalty';

const TX = {
  en: { title: 'Rewards', join: 'Join rewards', joining: 'Joining…', intro: 'Earn points on every order and use them as discount at checkout. It is free and takes one tap.', pts: 'points', worth: 'Worth {v} at checkout', pending: 'Pending', pendingHint: 'Points are added after the return period ends.', onHold: 'On hold: return in progress', releases: 'Added on {d}', history: 'Activity', none: 'No activity yet. Your points show here after your first delivered order.', off: 'The rewards programme is not running right now.', signin: 'Sign in to see your rewards.', next: 'Spend {a} in total to reach {n}', earn: 'Earn {e} point per 1 KWD', redeem: 'Every {p} points = 1 KWD off (up to {m}% of an order)', back: 'Account', joined: 'Welcome to rewards!', fail: 'Could not join. Please try again.' },
  ar: { title: 'المكافآت', join: 'انضم إلى المكافآت', joining: 'جارٍ الانضمام…', intro: 'اكسب نقاطاً على كل طلب واستخدمها كخصم عند الدفع. مجاني وبنقرة واحدة.', pts: 'نقطة', worth: 'تساوي {v} عند الدفع', pending: 'قيد الانتظار', pendingHint: 'تُضاف النقاط بعد انتهاء فترة الإرجاع.', onHold: 'معلّقة: طلب إرجاع قيد المعالجة', releases: 'تُضاف في {d}', history: 'النشاط', none: 'لا يوجد نشاط بعد. ستظهر نقاطك هنا بعد أول طلب يتم تسليمه.', off: 'برنامج المكافآت غير متاح حالياً.', signin: 'سجّل الدخول لعرض مكافآتك.', next: 'أنفق {a} إجمالاً للوصول إلى {n}', earn: 'اكسب {e} نقطة لكل 1 د.ك', redeem: 'كل {p} نقطة = خصم 1 د.ك (حتى {m}% من الطلب)', back: 'حسابي', joined: 'أهلاً بك في المكافآت!', fail: 'تعذّر الانضمام. حاول مرة أخرى.' },
};
const fill = (s: string, v: Record<string, any>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

export default function LoyaltyPage() {
  const { isArabic } = useLanguage(); const x = isArabic ? TX.ar : TX.en;
  const { status } = useSession();
  const { info, loading, reload } = useLoyaltyState();
  const [joining, setJoining] = useState(false);

  const join = async () => {
    setJoining(true);
    try { const r = await fetch('/api/loyalty', { method: 'POST' }); if (!r.ok) throw new Error(); toast.success(x.joined); reload(); }
    catch { toast.error(x.fail); }
    setJoining(false);
  };

  const body = () => {
    if (status === 'loading' || loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;
    if (status === 'unauthenticated') return <div className="text-center py-6"><p className="text-gray-600 mb-4">{x.signin}</p><Link href="/auth/login?callbackUrl=/account/loyalty" className="btn-primary">Sign in</Link></div>;
    if (!info?.enabled || !info.settings) return <p className="text-center text-gray-500 py-6">{x.off}</p>;
    const s = info.settings;
    const tierName = info.tier ? (isArabic && info.tier.nameAr ? info.tier.nameAr : info.tier.name) : '';
    if (!info.joined) return (
      <div className="rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white p-7 text-center shadow-lg">
        <Gift className="w-10 h-10 mx-auto mb-3 opacity-90" />
        <h2 className="text-2xl font-black mb-2">{x.title}</h2>
        <p className="text-white/90 text-sm max-w-sm mx-auto mb-4">{x.intro}</p>
        <ul className="text-xs text-white/90 space-y-1 mb-5"><li>{fill(x.earn, { e: s.earnPerKwd })}</li><li>{fill(x.redeem, { p: Math.round(1 / s.pointValueKwd), m: s.maxRedeemPct })}</li></ul>
        <button onClick={join} disabled={joining} className="bg-white text-orange-600 font-bold rounded-xl px-6 py-3 text-sm disabled:opacity-60 inline-flex items-center gap-2">{joining && <Loader2 className="w-4 h-4 animate-spin" />}{joining ? x.joining : x.join}</button>
      </div>
    );
    const pend = info.pending;
    return (
      <div className="space-y-5">
        <div className="rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-brand-700 text-white p-6 shadow-lg relative overflow-hidden">
          <Sparkles className="absolute -top-3 -right-3 rtl:right-auto rtl:-left-3 w-24 h-24 text-white/5" />
          <div className="flex items-center justify-between"><span className="text-sm text-white/70">{x.title}</span>{tierName && <span className="text-xs bg-white/15 rounded-full px-3 py-1 font-semibold">{tierName}</span>}</div>
          <p className="text-5xl font-black mt-4 tracking-tight">{info.points || 0}<span className="text-base font-semibold text-white/70 ms-2">{x.pts}</span></p>
          <p className="text-sm text-white/80 mt-1">{fill(x.worth, { v: formatPrice(info.valueKwd || 0) })}</p>
          {info.next && <p className="text-xs text-amber-200 mt-4">{fill(x.next, { a: formatPrice(info.next.minSpent), n: isArabic && info.next.nameAr ? info.next.nameAr : info.next.name })}</p>}
        </div>

        {pend && pend.total > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-bold text-amber-900 text-sm"><Clock className="w-4 h-4" />{x.pending}</span><b className="text-amber-900">+{pend.total}</b></div>
            <p className="text-xs text-amber-800 mt-1">{x.pendingHint}</p>
            <ul className="mt-2 divide-y divide-amber-100 text-xs text-amber-900">
              {pend.rows.map(r => <li key={r.orderId} className="py-1.5 flex justify-between gap-2"><span>#{r.orderNumber} · {r.onHold ? x.onHold : r.releaseAt ? fill(x.releases, { d: formatDate(r.releaseAt) }) : ''}</span><b>+{r.points}</b></li>)}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-2">{x.history}</h3>
          {info.history?.length ? (
            <ul className="divide-y divide-gray-100">
              {info.history.map((h: any) => (
                <li key={h.id} className="py-2.5 flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center ${h.points > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{h.points > 0 ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}</span>
                  <span className="flex-1 min-w-0"><span className="block text-sm text-gray-800 truncate">{h.note}</span><span className="block text-xs text-gray-400">{formatDate(h.createdAt)}</span></span>
                  <b className={h.points > 0 ? 'text-green-600' : 'text-red-600'}>{h.points > 0 ? '+' : ''}{h.points}</b>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500 py-4 text-center">{x.none}</p>}
        </div>
        <p className="text-xs text-gray-400 text-center">{fill(x.earn, { e: s.earnPerKwd })} · {fill(x.redeem, { p: Math.round(1 / s.pointValueKwd), m: s.maxRedeemPct })}</p>
      </div>
    );
  };

  return (
    <><Header />
      <main className="container-custom py-6 max-w-xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-4"><ChevronLeft className="w-4 h-4 rtl:rotate-180" />{x.back}</Link>
        {body()}
      </main>
      <Footer /></>
  );
}
