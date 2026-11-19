'use client';
// Smart Return Flow - auto-eligibility check + camera photo verification
import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, CheckCircle, XCircle, AlertCircle, RotateCcw, Loader2, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import { statusText } from '@/lib/utils';
import { useStoreSettings } from '@/lib/useStoreSettings';
import { returnDaysLeft, returnWindowDays } from '@/lib/returns';
import type { Order, OrderItem } from '@/types';

const MAX_PHOTOS = 6;

/** Phone photos are 3-8 MB; shrink to 1280 px JPEG (about 150-300 KB) before sending so it never hits the upload size limit. */
async function shrink(src: Blob | string): Promise<string> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('decode')); i.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { if (typeof src !== 'string') URL.revokeObjectURL(url); }
}

interface Props {
  order: Order;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'eligibility' | 'select_items' | 'reason' | 'photo' | 'submitting' | 'done' | 'ineligible';

const RETURN_REASONS = [
  'Item damaged / defective', 'Wrong item received', 'Item not as described', 'Changed my mind',
  'Better price found elsewhere', 'Item arrived too late', 'Missing parts or accessories', 'Other',
]; // values are stored in English for the admin team; labels are translated

export function SmartReturnFlow({ order, onSuccess, onCancel }: Props) {
  const { t, L } = useLanguage();
  const nm = (i: any) => L({ name: i.productName, nameAr: i.productNameAr }, 'name');
  const [step, setStep] = useState<Step>('eligibility');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const settings = useStoreSettings();
  const windowDays = returnWindowDays(settings.returnWindowDays);
  const daysLeft = returnDaysLeft(order, windowDays);
  const [cameraActive, setCameraActive] = useState(false);
  const [ineligibleReason, setIneligibleReason] = useState('');
  const [submitErr, setSubmitErr] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Eligibility check ---
  const returnableItems = order.items.filter(i => (i as any).isReturnable !== false);
  const isDelivered = order.status === 'delivered';

  const checkEligibility = () => {
    if (!isDelivered) {
      setIneligibleReason(t('c2_ret.inel1'));
      setStep('ineligible');
      return;
    }
    if (returnableItems.length === 0) {
      setIneligibleReason(t('c2_ret.inel2'));
      setStep('ineligible');
      return;
    }
    if (daysLeft !== null && daysLeft < 0) {
      setIneligibleReason(t('c2_ret.inel3', { n: windowDays }));
      setStep('ineligible');
      return;
    }
    setStep('select_items');
  };

  const toggleItem = (productId: string) => {
    setSelectedItems(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // --- Camera ---
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      toast.error(t('c2_ret.camDenied'));
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const addPhoto = async (src: Blob | string) => {
    try {
      const d = await shrink(src);
      setPhotos(p => (p.length >= MAX_PHOTOS ? p : [...p, d]));
    } catch { toast.error(t('c2_ret.readFail')); }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    addPhoto(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS - photos.length);
    e.target.value = ''; // lets the same file be chosen again
    for (const f of files) await addPhoto(f);
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (!photos.length) { toast.error(t('c2_ret.needPhoto')); return; }
    setStep('submitting');
    try {
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setProgress(t('c2_ret.uploadN', { n: i + 1, total: photos.length }));
        const up = await fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: photos[i], folder: 'returns' }),
        }).then(async r => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }));
        if (!up.ok || !up.body?.url) { setStep('photo'); toast.error(up.body?.error || (up.status === 413 ? t('c2_ret.uploadFail') : t('c2_ret.uploadFail'))); return; }
        urls.push(up.body.url);
      }
      setProgress('');
      const res = await fetch('/api/orders/returns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, reason, description, images: urls, selectedProductIds: selectedItems }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setStep('photo'); toast.error(j?.error || t('c2_ret.submitFail')); return; }
      setStep('done');
    } catch {
      toast.error(t('c2_ret.submitFail'));
      setStep('photo');
    }
  };

  // ── RENDER ──────────────────────────────────────────────────
  if (step === 'eligibility') return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-brand-50 rounded-xl">
        <AlertCircle className="w-5 h-5 text-brand-600 flex-shrink-0" />
        <div>
          <p className="font-semibold text-brand-900 text-sm">{t('c2_ret.policy')}</p>
          <p className="text-brand-700 text-xs mt-0.5">{t('c2_ret.policyD', { n: windowDays })}</p>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between py-2 border-b">
          <span className="text-gray-500">{t('c2_ret.orderStatus')}</span>
          <span className={`font-semibold ${isDelivered ? 'text-green-600' : 'text-orange-500'}`}>
            {isDelivered ? t('c2_ret.delivered') : statusText(t, order.status)}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b">
          <span className="text-gray-500">{t('c2_ret.returnable')}</span>
          <span className="font-semibold">{t('c2_ret.ofN', { a: returnableItems.length, b: order.items.length })}</span>
        </div>
        {daysLeft !== null && (
          <div className="flex justify-between py-2">
            <span className="text-gray-500">{t('c2_ret.winTitle')}</span>
            <span className={`font-semibold ${daysLeft < 0 ? 'text-red-600' : daysLeft === 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {daysLeft < 0 ? t('c2_ret.winClosed') : daysLeft === 0 ? t('c2_ret.lastDay') : t('c2_ret.daysLeftN', { n: daysLeft })}
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">{t('c2_ret.cancel')}</button>
        <button onClick={checkEligibility} className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700">{t('c2_ret.check')}</button>
      </div>
    </div>
  );

  if (step === 'ineligible') return (
    <div className="text-center space-y-4 py-4">
      <XCircle className="w-14 h-14 text-red-500 mx-auto" />
      <h3 className="font-bold text-gray-900">{t('c2_ret.notEligible')}</h3>
      <p className="text-gray-600 text-sm">{ineligibleReason}</p>
      <button onClick={onCancel} className="btn-primary w-full">{t('c2_ret.close')}</button>
    </div>
  );

  if (step === 'select_items') return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900">{t('c2_ret.selectItems')}</h3>
      <div className="space-y-2">
        {returnableItems.map(item => (
          <label key={item.productId} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedItems.includes(item.productId) ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <input type="checkbox" className="w-4 h-4 accent-brand-600"
              checked={selectedItems.includes(item.productId)}
              onChange={() => toggleItem(item.productId)} />
            {item.image && <img src={item.image} alt={nm(item)} className="w-10 h-10 object-cover rounded-lg" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{nm(item)}</p>
              <p className="text-xs text-gray-500">{t('c2_ret.qty', { n: item.quantity })}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => setStep('eligibility')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">{t('c2_ret.back')}</button>
        <button onClick={() => setStep('reason')} disabled={selectedItems.length === 0}
          className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">{t('c2_ret.next')}</button>
      </div>
    </div>
  );

  if (step === 'reason') return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900">{t('c2_ret.reasonTitle')}</h3>
      <div className="space-y-2">
        {RETURN_REASONS.map((r, ri) => (
          <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${reason === r ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
            <input type="radio" name="reason" className="w-4 h-4 accent-brand-600" value={r} checked={reason === r} onChange={() => setReason(r)} />
            <span className="text-sm font-medium text-gray-800">{t(`c2_ret.r${ri + 1}`)}</span>
          </label>
        ))}
      </div>
      <textarea value={description} onChange={e => setDescription(e.target.value)}
        placeholder={t('c2_ret.details')}
        className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none h-20 focus:outline-none focus:border-brand-500" />
      <div className="flex gap-3">
        <button onClick={() => setStep('select_items')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">{t('c2_ret.back')}</button>
        <button onClick={() => setStep('photo')} disabled={!reason}
          className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">{t('c2_ret.next')}</button>
      </div>
    </div>
  );

  if (step === 'photo') return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-gray-900">{t('c2_ret.photoTitle')}</h3>
        <p className="text-sm text-gray-500 mt-1">{t('c2_ret.photoSub', { max: MAX_PHOTOS })}</p>
      </div>

      {cameraActive && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full rounded-xl" autoPlay playsInline muted />
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
            <button onClick={capturePhoto} aria-label={t('c2_ret.capture')} className="w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
              <Camera className="w-7 h-7 text-gray-800" />
            </button>
            <button onClick={stopCamera} aria-label={t('c2_ret.cancel')} className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {photos.length > 0 && !cameraActive && (
        <div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square">
                <img src={p} alt={t('c2_ret.photoAlt')} className="w-full h-full object-cover rounded-xl border border-gray-200" />
                <button onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))} aria-label={t('c2_ret.removePhoto')}
                  className="absolute -top-1.5 -end-1.5 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 shadow"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-500" />{t('c2_ret.photosN', { n: photos.length, max: MAX_PHOTOS })}</p>
        </div>
      )}

      {!cameraActive && photos.length < MAX_PHOTOS && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={startCamera}
            className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-colors">
            <Camera className="w-7 h-7 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">{photos.length ? t('c2_ret.addMore') : t('c2_ret.openCam')}</span>
            <span className="text-xs text-gray-400">{t('c2_ret.takeNow')}</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-colors">
            <Upload className="w-7 h-7 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">{t('c2_ret.upload')}</span>
            <span className="text-xs text-gray-400">{t('c2_ret.gallery')}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setStep('reason')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">{t('c2_ret.back')}</button>
        <button onClick={handleSubmit} disabled={photos.length === 0}
          className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> {t('c2_ret.submit')}
        </button>
      </div>
    </div>
  );

  if (step === 'submitting') return (
    <div className="text-center py-10 space-y-4">
      <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto" />
      <p className="font-semibold text-gray-700">{progress || t('c2_ret.submitting')}</p>
    </div>
  );

  if (step === 'done') return (
    <div className="text-center space-y-4 py-4">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
      <h3 className="font-bold text-gray-900 text-lg">{t('c2_ret.doneTitle')}</h3>
      <p className="text-gray-600 text-sm">{t('c2_ret.doneBody')}</p>
      <button onClick={onSuccess} className="btn-primary w-full">{t('c2_ret.done')}</button>
    </div>
  );

  return null;
}
