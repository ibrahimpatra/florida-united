'use client';
// Smart Return Flow - auto-eligibility check + camera photo verification
import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, CheckCircle, XCircle, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Order, OrderItem } from '@/types';

interface Props {
  order: Order;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'eligibility' | 'select_items' | 'reason' | 'photo' | 'submitting' | 'done' | 'ineligible';

const RETURN_REASONS = [
  'Item damaged / defective',
  'Wrong item received',
  'Item not as described',
  'Changed my mind',
  'Better price found elsewhere',
  'Item arrived too late',
  'Missing parts or accessories',
  'Other',
];

export function SmartReturnFlow({ order, onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<Step>('eligibility');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [ineligibleReason, setIneligibleReason] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Eligibility check ---
  const returnableItems = order.items.filter(i => i.isReturnable);
  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
  const daysSinceDelivery = deliveredAt
    ? Math.floor((Date.now() - deliveredAt.getTime()) / 86400000)
    : null;
  const isDelivered = order.status === 'delivered';

  const checkEligibility = () => {
    if (!isDelivered) {
      setIneligibleReason('Returns can only be requested after delivery.');
      setStep('ineligible');
      return;
    }
    if (returnableItems.length === 0) {
      setIneligibleReason('None of the items in this order are returnable.');
      setStep('ineligible');
      return;
    }
    if (daysSinceDelivery !== null && daysSinceDelivery > 14) {
      setIneligibleReason(`Return window has expired. Returns must be requested within 14 days of delivery.`);
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
      toast.error('Camera access denied. Please allow camera or upload a photo instead.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoDataUrl(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhotoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (!photoDataUrl) { toast.error('Please take or upload a photo of the item'); return; }
    setStep('submitting');

    try {
      // Upload photo to Firebase Storage via API
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: photoDataUrl, folder: 'returns' }),
      });
      const { url: imageUrl } = await uploadRes.json();

      const res = await fetch('/api/orders/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          reason,
          description,
          images: [imageUrl],
          selectedProductIds: selectedItems,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit');
      setStep('done');
    } catch {
      toast.error('Failed to submit return. Please try again.');
      setStep('photo');
    }
  };

  // ── RENDER ──────────────────────────────────────────────────
  if (step === 'eligibility') return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div>
          <p className="font-semibold text-blue-900 text-sm">Return Policy</p>
          <p className="text-blue-700 text-xs mt-0.5">Returns accepted within 14 days of delivery for eligible items. Photo verification required.</p>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between py-2 border-b">
          <span className="text-gray-500">Order Status</span>
          <span className={`font-semibold ${isDelivered ? 'text-green-600' : 'text-orange-500'}`}>
            {isDelivered ? 'Delivered ✓' : order.status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b">
          <span className="text-gray-500">Returnable Items</span>
          <span className="font-semibold">{returnableItems.length} of {order.items.length}</span>
        </div>
        {daysSinceDelivery !== null && (
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Days Since Delivery</span>
            <span className={`font-semibold ${daysSinceDelivery > 14 ? 'text-red-600' : 'text-green-600'}`}>
              {daysSinceDelivery} days
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={checkEligibility} className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700">Check Eligibility</button>
      </div>
    </div>
  );

  if (step === 'ineligible') return (
    <div className="text-center space-y-4 py-4">
      <XCircle className="w-14 h-14 text-red-500 mx-auto" />
      <h3 className="font-bold text-gray-900">Return Not Eligible</h3>
      <p className="text-gray-600 text-sm">{ineligibleReason}</p>
      <button onClick={onCancel} className="btn-primary w-full">Close</button>
    </div>
  );

  if (step === 'select_items') return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900">Select Items to Return</h3>
      <div className="space-y-2">
        {returnableItems.map(item => (
          <label key={item.productId} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedItems.includes(item.productId) ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <input type="checkbox" className="w-4 h-4 accent-brand-600"
              checked={selectedItems.includes(item.productId)}
              onChange={() => toggleItem(item.productId)} />
            {item.image && <img src={item.image} alt={item.productName} className="w-10 h-10 object-cover rounded-lg" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{item.productName}</p>
              <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => setStep('eligibility')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Back</button>
        <button onClick={() => setStep('reason')} disabled={selectedItems.length === 0}
          className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">Next</button>
      </div>
    </div>
  );

  if (step === 'reason') return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900">Reason for Return</h3>
      <div className="space-y-2">
        {RETURN_REASONS.map(r => (
          <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${reason === r ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
            <input type="radio" name="reason" className="w-4 h-4 accent-brand-600" value={r} checked={reason === r} onChange={() => setReason(r)} />
            <span className="text-sm font-medium text-gray-800">{r}</span>
          </label>
        ))}
      </div>
      <textarea value={description} onChange={e => setDescription(e.target.value)}
        placeholder="Additional details (optional)..."
        className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none h-20 focus:outline-none focus:border-brand-500" />
      <div className="flex gap-3">
        <button onClick={() => setStep('select_items')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Back</button>
        <button onClick={() => setStep('photo')} disabled={!reason}
          className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">Next</button>
      </div>
    </div>
  );

  if (step === 'photo') return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-gray-900">Photo Verification Required</h3>
        <p className="text-sm text-gray-500 mt-1">Take a clear photo of the item(s) you're returning. This speeds up approval.</p>
      </div>

      {cameraActive && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full rounded-xl" autoPlay playsInline muted />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button onClick={capturePhoto} className="w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
              <Camera className="w-7 h-7 text-gray-800" />
            </button>
            <button onClick={stopCamera} className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✕</button>
          </div>
        </div>
      )}

      {photoDataUrl && !cameraActive && (
        <div className="relative">
          <img src={photoDataUrl} alt="Return photo" className="w-full rounded-xl object-cover max-h-64" />
          <button onClick={() => setPhotoDataUrl(null)}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold hover:bg-red-600">✕</button>
          <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Photo ready
          </div>
        </div>
      )}

      {!cameraActive && !photoDataUrl && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={startCamera}
            className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-colors">
            <Camera className="w-8 h-8 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Open Camera</span>
            <span className="text-xs text-gray-400">Take photo now</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-colors">
            <Upload className="w-8 h-8 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Upload Photo</span>
            <span className="text-xs text-gray-400">From gallery</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setStep('reason')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Back</button>
        <button onClick={handleSubmit} disabled={!photoDataUrl}
          className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> Submit Return
        </button>
      </div>
    </div>
  );

  if (step === 'submitting') return (
    <div className="text-center py-10 space-y-4">
      <Loader2 className="w-12 h-12 text-brand-600 animate-spin mx-auto" />
      <p className="font-semibold text-gray-700">Submitting your return request...</p>
    </div>
  );

  if (step === 'done') return (
    <div className="text-center space-y-4 py-4">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
      <h3 className="font-bold text-gray-900 text-lg">Return Request Submitted!</h3>
      <p className="text-gray-600 text-sm">Your return has been submitted with photo verification. Our team will review within 24 hours. If approved, we'll arrange pickup.</p>
      <button onClick={onSuccess} className="btn-primary w-full">Done</button>
    </div>
  );

  return null;
}
