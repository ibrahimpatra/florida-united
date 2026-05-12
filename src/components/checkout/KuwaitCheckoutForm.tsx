'use client';
// Kuwait-specific checkout form — governorates, +965 phone, TAP + COD
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { CreditCard, Banknote, MapPin, Phone, User, ChevronDown, Loader2, Lock } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { KUWAIT_GOVERNORATES } from '@/types';
import type { ShippingOption } from '@/lib/shipping';
import type { CartItem } from '@/types';

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  block: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  address1: string;
  governorate: string;
  city: string;
  notes?: string;
}

interface Props {
  items: CartItem[];
  subtotal: number;
  discount: number;
  shippingOption: ShippingOption | null;
  couponCode?: string;
  userEmail?: string;
}

type PaymentMethod = 'tap' | 'cod';

export function KuwaitCheckoutForm({ items, subtotal, discount, shippingOption, couponCode, userEmail }: Props) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tap');
  const [loading, setLoading] = useState(false);

  const shippingCost = shippingOption?.price ?? 0;
  const total = subtotal - discount + shippingCost;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: { governorate: KUWAIT_GOVERNORATES[0], email: userEmail || '' },
  });

  const block = watch('block');
  const street = watch('street');
  const building = watch('building');

  const buildAddress1 = () => `Block ${block}, Street ${street}, Building ${building}`;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const shippingAddress = {
      id: 'checkout',
      label: 'Delivery Address',
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone.startsWith('+') ? data.phone : `+965${data.phone}`,
      address1: buildAddress1(),
      block: data.block,
      street: data.street,
      building: data.building,
      floor: data.floor,
      apartment: data.apartment,
      city: data.city || data.governorate,
      governorate: data.governorate,
      country: 'Kuwait',
      isDefault: false,
    };

    const orderPayload = {
      items: items.map(i => ({
        productId: i.productId,
        productName: i.name,
        productSku: i.sku,
        variantName: i.variantName,
        price: i.price,
        quantity: i.quantity,
        total: i.price * i.quantity,
        image: i.image,
        isReturnable: i.isReturnable,
      })),
      shippingAddress,
      subtotal,
      discount,
      shippingCost,
      tax: 0, // Kuwait has no VAT on most goods
      total,
      couponCode: couponCode || '',
      notes: data.notes || '',
      currency: 'KWD',
    };

    try {
      if (paymentMethod === 'cod') {
        const res = await fetch('/api/orders/cod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        toast.success('Order placed! Cash on Delivery confirmed.');
        router.push(`/checkout/success?orderId=${result.orderId}`);
      } else {
        // TAP: create order first, then redirect to TAP
        const orderRes = await fetch('/api/orders/cod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...orderPayload, paymentMethod: 'tap', paymentStatus: 'pending' }),
        });
        const orderResult = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderResult.error);

        const tapRes = await fetch('/api/tap/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            total,
            orderId: orderResult.orderId,
            orderNumber: orderResult.orderNumber,
            shippingAddress,
          }),
        });
        const tapData = await tapRes.json();
        if (!tapRes.ok) throw new Error(tapData.error);
        window.location.href = tapData.redirectUrl;
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Contact Info */}
      <section>
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-brand-600" /> Contact Information
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input {...register('firstName', { required: 'Required' })}
              placeholder="First Name" className="input-field" />
            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <input {...register('lastName', { required: 'Required' })}
              placeholder="Last Name" className="input-field" />
            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
          </div>
          <div className="col-span-2">
            <input {...register('email', { required: 'Required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
              type="email" placeholder="Email address" className="input-field" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div className="col-span-2 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">+965</span>
            <input {...register('phone', {
              required: 'Required',
              pattern: { value: /^[569]\d{7}$/, message: 'Enter valid Kuwait number (8 digits starting with 5,6,9)' }
            })}
              placeholder="5x xxx xxxx" className="input-field pl-14"
              maxLength={8} />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
        </div>
      </section>

      {/* Kuwait Address */}
      <section>
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-600" /> Delivery Address (Kuwait)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-semibold mb-1 block">Governorate *</label>
            <div className="relative">
              <select {...register('governorate', { required: true })} className="input-field appearance-none pr-8">
                {KUWAIT_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold mb-1 block">Area / City *</label>
            <input {...register('city', { required: 'Required' })}
              placeholder="e.g. Salmiya" className="input-field" />
            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold mb-1 block">Block *</label>
            <input {...register('block', { required: 'Required' })}
              placeholder="e.g. 7" className="input-field" />
            {errors.block && <p className="text-red-500 text-xs mt-1">{errors.block.message}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold mb-1 block">Street *</label>
            <input {...register('street', { required: 'Required' })}
              placeholder="e.g. 23" className="input-field" />
            {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street.message}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold mb-1 block">Building / House *</label>
            <input {...register('building', { required: 'Required' })}
              placeholder="e.g. 14" className="input-field" />
            {errors.building && <p className="text-red-500 text-xs mt-1">{errors.building.message}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold mb-1 block">Floor</label>
            <input {...register('floor')} placeholder="e.g. 3" className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 font-semibold mb-1 block">Apartment / Office</label>
            <input {...register('apartment')} placeholder="e.g. Flat 5" className="input-field" />
          </div>
          {block && street && building && (
            <div className="col-span-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              📍 {buildAddress1()}, {watch('city') || watch('governorate')}, Kuwait
            </div>
          )}
          <div className="col-span-2">
            <label className="text-xs text-gray-500 font-semibold mb-1 block">Delivery Notes</label>
            <textarea {...register('notes')} placeholder="Any special instructions for delivery..."
              className="input-field resize-none h-16 text-sm" />
          </div>
        </div>
      </section>

      {/* Payment Method */}
      <section>
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-600" /> Payment Method
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setPaymentMethod('tap')}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'tap' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex gap-1 items-center">
              <span className="text-xl">💳</span>
              <span className="text-lg font-black text-brand-700">tap</span>
            </div>
            <span className="text-xs font-semibold text-gray-700">Card / KNET / Apple Pay</span>
            <div className="flex gap-1">
              {['KNET','Visa','MC'].map(b => (
                <span key={b} className="text-[9px] bg-gray-100 px-1 py-0.5 rounded font-bold text-gray-600">{b}</span>
              ))}
            </div>
          </button>

          <button type="button" onClick={() => setPaymentMethod('cod')}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'cod' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <Banknote className="w-6 h-6 text-green-600" />
            <span className="text-xs font-semibold text-gray-700">Cash on Delivery</span>
            <span className="text-[10px] text-gray-400 text-center">Pay when your order arrives</span>
          </button>
        </div>

        {paymentMethod === 'tap' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-xl">
            <Lock className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            You'll be redirected to TAP secure payment. Supports KNET, Visa, Mastercard & Apple Pay.
          </div>
        )}
        {paymentMethod === 'cod' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-green-50 p-3 rounded-xl border border-green-200">
            <Banknote className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            Please have exact change ready. Our delivery team will collect payment on arrival.
          </div>
        )}
      </section>

      {/* Order Summary */}
      <section className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatPrice(discount)}</span></div>}
        <div className="flex justify-between text-gray-600">
          <span>Shipping</span>
          <span>{shippingCost === 0 ? <span className="text-green-600 font-semibold">FREE</span> : formatPrice(shippingCost)}</span>
        </div>
        <div className="flex justify-between font-black text-gray-900 text-base border-t pt-2 mt-2">
          <span>Total</span>
          <span className="text-brand-700">{formatPrice(total)}</span>
        </div>
        <p className="text-xs text-gray-400 text-center pt-1">No VAT — Kuwait</p>
      </section>

      <button type="submit" disabled={loading}
        className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 text-base">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
          paymentMethod === 'tap' ? <><CreditCard className="w-5 h-5" /> Pay with TAP — {formatPrice(total)}</> :
          <><Banknote className="w-5 h-5" /> Place COD Order — {formatPrice(total)}</>
        }
      </button>
    </form>
  );
}
