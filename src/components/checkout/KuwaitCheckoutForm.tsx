'use client';
// Kuwait checkout form: address book picker, server-priced totals, double-submit-proof.
import { errorText } from '@/lib/error-text';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { useState, useRef, useEffect, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { CreditCard, Banknote, MapPin, User, ChevronDown, Loader2, Lock, AlertTriangle, Plus } from 'lucide-react';
import { formatPrice, govLabel } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { KUWAIT_GOVERNORATES } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CartItem } from '@/types';

interface FormData {
  firstName: string; lastName: string; phone: string; email: string;
  block: string; street: string; building: string; floor?: string; apartment?: string;
  city: string; notes?: string; saveAddress?: boolean;
}
interface Props {
  items: CartItem[];
  governorate: string; onGovernorateChange: (g: string) => void;
  rateId?: string; quoteReady: boolean; codFee: number; total: number;
  couponCode?: string; redeemPoints?: number; userEmail?: string; shippingSlot: ReactNode;
}
type Pay = 'card' | 'cod';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function readJson(res: Response): Promise<any | null> {
  if (!(res.headers.get('content-type') || '').includes('application/json')) return null;
  try { return await res.json(); } catch { return null; }
}

export function KuwaitCheckoutForm({ items, governorate, onGovernorateChange, rateId, quoteReady, codFee, total, couponCode, redeemPoints, userEmail, shippingSlot }: Props) {
  const router = useRouter();
  const { t, isArabic } = useLanguage();
  const { clearCart, removeCoupon } = useCartStore();
  const [pay, setPay] = useState<Pay>('cod');
  const settings = useStoreSettings();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [govError, setGovError] = useState(false);
  const [saved, setSaved] = useState<any[]>([]);
  const [pickedId, setPickedId] = useState<string>('new');
  const inFlight = useRef(false);          // synchronous guard — state updates are async and a fast double-click beats them
  const idemKey = useRef(newKey());         // one key per attempt; regenerated after any failed attempt

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { email: userEmail || '', saveAddress: true },
  });

  // ── address book ──
  useEffect(() => {
    let alive = true;
    fetch('/api/account/addresses').then(r => (r.ok ? r.json() : [])).then((list: any[]) => {
      if (!alive || !Array.isArray(list) || !list.length) return;
      setSaved(list);
      const def = list.find(a => a.isDefault) || list[0];
      applyAddress(def);
    }).catch(() => {});
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyAddress(a: any) {
    setPickedId(a.id);
    const phone = String(a.phone || '').replace(/\D/g, '').replace(/^965/, '');
    reset({
      firstName: a.firstName || '', lastName: a.lastName || '', phone, email: watch('email') || userEmail || '',
      block: a.block || '', street: a.street || '', building: a.building || '', floor: a.floor || '',
      apartment: a.apartment || '', city: a.city || '', notes: watch('notes') || '', saveAddress: false,
    });
    const g = (KUWAIT_GOVERNORATES as readonly string[]).find(x => x === a.governorate) || a.governorate || '';
    onGovernorateChange(g); setGovError(false);
  }
  function startNew() {
    setPickedId('new');
    reset({ email: watch('email') || userEmail || '', saveAddress: true });
    onGovernorateChange('');
  }

  const onSubmit = async (d: FormData) => {
    if (inFlight.current || done) return;
    if (!governorate) { setGovError(true); toast.error(t('checkout.selectGovernorate')); return; }
    if (!quoteReady || !rateId) { toast.error(t('checkout.quoteFailed')); return; }
    inFlight.current = true; setBusy(true);

    const shippingAddress = {
      firstName: d.firstName, lastName: d.lastName, phone: d.phone, city: d.city, governorate,
      block: d.block, street: d.street, building: d.building, floor: d.floor || '', apartment: d.apartment || '',
    };
    const payload = {
      idempotencyKey: idemKey.current, paymentMethod: pay, shippingRateId: rateId, contactEmail: d.email,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId, variantName: i.variantName })),
      shippingAddress, couponCode: couponCode || '', redeemPoints: redeemPoints || 0, notes: d.notes || '',
    };

    let orderCreated = false;
    // True when we cannot tell whether the server saved the order (connection dropped / unreadable answer).
    // Then the SAME idempotency key is reused on retry, so a second click can never create a second order.
    let unknownOutcome = false;
    try {
      let res: Response;
      try { res = await fetch('/api/orders/cod', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
      catch { unknownOutcome = true; throw new Error(t('c2_chk.failGeneric')); }
      const r = await readJson(res);
      if (res.ok && !r?.orderId) unknownOutcome = true;
      if (!res.ok || !r?.orderId) {
        if (r?.code === 'BAD_COUPON') removeCoupon();
        const msg = r?.error || (res.status >= 500 || !r
          ? t('c2_chk.failGeneric')
          : t('c2_chk.failShort'));
        throw new Error(msg);
      }
      orderCreated = true;

      // optionally remember the address (fire-and-forget; never blocks the order)
      if (d.saveAddress && pickedId === 'new') {
        fetch('/api/account/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...shippingAddress, label: 'Home', country: 'Kuwait', isDefault: saved.length === 0 }) }).catch(() => {});
      }

      if (pay === 'cod') {
        setDone(true); clearCart(); removeCoupon();
        toast.success(t('checkout.orderPlaced'));
        router.push(`/checkout/success?orderId=${r.orderId}&n=${encodeURIComponent(r.orderNumber)}&cod=1`);
        return;
      }

      // Online payment: the provider (Stripe / Tap / MyFatoorah) and the amount are decided on the server from the saved order.
      const tapRes = await fetch('/api/payments/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: r.orderId }) });
      const tap = await readJson(tapRes);
      if (!tapRes.ok || !tap?.url) {
        // Payment could not start → cancel the unpaid order so no ghost order / stock hold remains.
        await fetch(`/api/orders/${r.orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled', note: 'Payment could not be started' }) }).catch(() => {});
        orderCreated = false;
        throw new Error(errorText(tap, t('c2_chk.cardFail')));
      }
      setDone(true); clearCart(); removeCoupon();
      window.location.href = tap.url;
    } catch (e: any) {
      if (!unknownOutcome) idemKey.current = newKey(); // a definite failure must not poison the next attempt
      inFlight.current = false; setBusy(false);
      toast.error(e?.message || t('c2_chk.wrong'), { duration: 7000 });
      if (orderCreated) toast(t('checkout.checkOrders'), { duration: 9000 });
    }
  };

  const L = ({ k, req }: { k: string; req?: boolean }) => <label className="text-xs text-gray-500 font-semibold mb-1 block">{t(k)}{req ? ' *' : ''}</label>;
  const E = ({ m }: { m?: string }) => (m ? <p className="text-red-500 text-xs mt-1">{m}</p> : null);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7" noValidate>
      {saved.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-600" />{t('checkout.savedAddresses')}</h3>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {saved.map(a => (
              <button key={a.id} type="button" onClick={() => applyAddress(a)}
                className={`flex-shrink-0 text-start rounded-xl border-2 px-3 py-2 text-xs min-w-[170px] ${pickedId === a.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                <div className="font-bold text-gray-800">{a.label || t('c2_chk.addrLabel')} {a.isDefault && <span className="text-brand-600">({t('c2_chk.default')})</span>}</div>
                <div className="text-gray-500 truncate">{a.firstName} {a.lastName}</div>
                <div className="text-gray-400 truncate">{a.city}, {govLabel(a.governorate, isArabic)}</div>
              </button>
            ))}
            <button type="button" onClick={startNew}
              className={`flex-shrink-0 rounded-xl border-2 border-dashed px-3 py-2 text-xs flex items-center gap-1 ${pickedId === 'new' ? 'border-brand-500 text-brand-700' : 'border-gray-300 text-gray-500'}`}>
              <Plus className="w-3.5 h-3.5" />{t('checkout.newAddress')}
            </button>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2"><User className="w-4 h-4 text-brand-600" />{t('checkout.contactInfo')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><input {...register('firstName', { required: t('checkout.required') })} placeholder={t('checkout.firstName')} className="input-field" autoComplete="given-name" /><E m={errors.firstName?.message} /></div>
          <div><input {...register('lastName')} placeholder={t('checkout.lastName')} className="input-field" autoComplete="family-name" /></div>
          <div className="col-span-2">
            <input {...register('email', { required: t('checkout.required'), pattern: { value: /\S+@\S+\.\S+/, message: t('checkout.invalidEmail') } })}
              type="email" placeholder={t('checkout.email')} className="input-field" dir="ltr" autoComplete="email" /><E m={errors.email?.message} />
          </div>
          <div className="col-span-2 relative">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold" dir="ltr">+965</span>
            <input {...register('phone', { required: t('checkout.required'), setValueAs: v => String(v || '').replace(/\D/g, '').replace(/^965/, ''), pattern: { value: /^[569]\d{7}$/, message: t('checkout.invalidPhone') } })}
              inputMode="numeric" placeholder={t('checkout.mobile')} className="input-field ps-14" maxLength={12} dir="ltr" autoComplete="tel-national" />
            <E m={errors.phone?.message} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-600" />{t('checkout.deliveryAddress')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <L k="checkout.governorate" req />
            <div className="relative">
              <select value={governorate} onChange={e => { onGovernorateChange(e.target.value); setGovError(false); }}
                className={`input-field appearance-none pe-8 ${govError ? 'border-red-400' : ''}`}>
                <option value="">{t('checkout.selectGovernorate')}</option>
                {KUWAIT_GOVERNORATES.map(g => <option key={g} value={g}>{govLabel(g, isArabic)}</option>)}
              </select>
              <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {govError && <E m={t('checkout.required')} />}
          </div>
          <div><L k="checkout.areaCity" req /><input {...register('city', { required: t('checkout.required') })} className="input-field" /><E m={errors.city?.message} /></div>
          <div><L k="checkout.block" req /><input {...register('block', { required: t('checkout.required') })} className="input-field" /><E m={errors.block?.message} /></div>
          <div><L k="checkout.street" req /><input {...register('street', { required: t('checkout.required') })} className="input-field" /><E m={errors.street?.message} /></div>
          <div><L k="checkout.building" req /><input {...register('building', { required: t('checkout.required') })} className="input-field" /><E m={errors.building?.message} /></div>
          <div><L k="checkout.floor" /><input {...register('floor')} className="input-field" /></div>
          <div className="col-span-2"><L k="checkout.apartment" /><input {...register('apartment')} className="input-field" /></div>
          <div className="col-span-2"><L k="checkout.notes" /><textarea {...register('notes')} placeholder={t('checkout.notesPlaceholder')} className="input-field resize-none h-16 text-sm" /></div>
          {pickedId === 'new' && (
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" {...register('saveAddress')} className="w-4 h-4 accent-brand-600" />{t('checkout.saveAddress')}
            </label>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-gray-900 mb-3">{t('checkout.deliveryOptions')}</h3>
        {shippingSlot}
      </section>

      <section>
        <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-brand-600" />{t('checkout.paymentMethod')}</h3>
        <div className={`grid gap-3 ${settings.cardEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button type="button" onClick={() => setPay('cod')}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all ${pay === 'cod' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
            <Banknote className="w-6 h-6 text-green-600" />
            <span className="text-xs font-semibold text-gray-700">{t('checkout.codTitle')}</span>
            {codFee > 0 && <span className="text-[10px] text-gray-400">+ {formatPrice(codFee)}</span>}
          </button>
          {settings.cardEnabled && (
            <button type="button" onClick={() => setPay('card')}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all ${pay === 'card' ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
              <CreditCard className="w-6 h-6 text-brand-700" />
              <span className="text-xs font-semibold text-gray-700">{t('c2_pay.cardTitle')}</span>
            </button>
          )}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-xl">
          {pay === 'card' ? <Lock className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> : <Banknote className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
          {pay === 'card' ? t('c2_pay.cardNote') : t('checkout.codNote')}
        </p>
        {pay === 'card' && quoteReady && settings.cardEnabled && settings.onlineCurrency === 'USD' && (
          <p className="mt-2 text-xs text-gray-500">{t('c2_pay.usdNote', { usd: (total * settings.usdRate).toFixed(2), rate: String(settings.usdRate) })}</p>
        )}
      </section>

      {done && (
        <div className="flex items-center gap-2 p-3 bg-brand-50 border border-brand-200 rounded-xl text-sm text-brand-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{t('checkout.submitted')}
        </div>
      )}

      <button type="submit" disabled={busy || done || !quoteReady}
        className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-base">
        {busy ? <><Loader2 className="w-5 h-5 animate-spin" />{t('checkout.processing')}</>
          : pay === 'card' ? <><CreditCard className="w-5 h-5" />{t('c2_pay.payCard')} — {quoteReady ? formatPrice(total) : '...'}</>
          : <><Banknote className="w-5 h-5" />{t('checkout.placeCod')} — {quoteReady ? formatPrice(total + codFee) : '...'}</>}
      </button>
    </form>
  );
}
