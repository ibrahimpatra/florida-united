'use client';
import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Camera, Eye, Loader2, RefreshCw, Filter } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { ReturnRequest, ReturnStatus } from '@/types';

const STATUS_COLORS: Record<ReturnStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  photo_submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  picked_up: 'bg-purple-100 text-purple-700',
  completed: 'bg-gray-100 text-gray-700',
  returned: 'bg-gray-100 text-gray-700',
  refunded: 'bg-emerald-100 text-emerald-700',
};

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReturnStatus | 'all'>('all');
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [adminPhotoUrl, setAdminPhotoUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders/returns');
      const data = await res.json();
      setReturns(data.items || []);
    } catch { toast.error('Failed to load returns'); }
    setLoading(false);
  };

  useEffect(() => { fetchReturns(); }, []);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
    } catch { toast.error('Camera unavailable'); }
  };

  const captureAdminPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    setAdminPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  };

  const handleAction = async (status: ReturnStatus) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/orders/returns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnId: selected.id,
          status,
          refundAmount: selected.refundAmount,
          adminNote,
          photoVerified: !!adminPhotoUrl,
          adminImages: adminPhotoUrl ? [adminPhotoUrl] : [],
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Return ${status === 'approved' ? 'approved ✓' : status === 'rejected' ? 'rejected ✗' : 'updated'}`);
      setSelected(null);
      setAdminNote('');
      setAdminPhotoUrl(null);
      fetchReturns();
    } catch { toast.error('Action failed'); }
    setActionLoading(false);
  };

  const filtered = filter === 'all' ? returns : returns.filter(r => r.status === filter);
  const pendingCount = returns.filter(r => ['pending', 'photo_submitted'].includes(r.status)).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Return Requests</h1>
          {pendingCount > 0 && <p className="text-sm text-orange-600 font-semibold mt-0.5">{pendingCount} pending review</p>}
        </div>
        <button onClick={fetchReturns} className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-600 border border-gray-200 px-3 py-2 rounded-xl">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(['all', 'pending', 'photo_submitted', 'approved', 'rejected', 'refunded'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? `All (${returns.length})` : s.replace('_', ' ')}
            {s === 'photo_submitted' && returns.filter(r => r.status === s).length > 0 && (
              <span className="ml-1 bg-blue-500 text-white rounded-full px-1.5">{returns.filter(r => r.status === s).length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ret => (
            <div key={ret.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-gray-900">#{ret.orderNumber}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[ret.status as ReturnStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                      {ret.status.replace('_', ' ')}
                    </span>
                    {ret.autoApproved && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Auto-approved</span>}
                    {ret.photoVerified && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">📷 Photo verified</span>}
                  </div>
                  <p className="text-sm text-gray-600 mb-1"><strong>Reason:</strong> {ret.reason}</p>
                  {ret.description && <p className="text-xs text-gray-500 mb-1">{ret.description}</p>}
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>{formatDate(ret.createdAt)}</span>
                    {ret.refundAmount !== undefined && <span className="font-semibold text-brand-600">Refund: {formatPrice(ret.refundAmount)}</span>}
                  </div>
                </div>

                {/* Customer photo */}
                {ret.images && ret.images.length > 0 && (
                  <div className="flex gap-1">
                    {ret.images.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noreferrer">
                        <img src={img} alt="return" className="w-14 h-14 object-cover rounded-xl border border-gray-200 hover:scale-105 transition-transform" />
                      </a>
                    ))}
                  </div>
                )}

                <button onClick={() => { setSelected(ret); setAdminNote(ret.adminNote || ''); }}
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 border border-brand-200 px-3 py-2 rounded-xl flex-shrink-0">
                  <Eye className="w-4 h-4" /> Review
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="font-semibold">No returns in this category</p>
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="font-bold text-gray-900 text-lg">Review Return #{selected.orderNumber}</h2>
              <button onClick={() => { setSelected(null); setCameraActive(false); streamRef.current?.getTracks().forEach(t => t.stop()); }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <div className="space-y-2 text-sm bg-gray-50 rounded-xl p-3">
              <div className="flex justify-between"><span className="text-gray-500">Reason</span><span className="font-semibold">{selected.reason}</span></div>
              {selected.description && <div><span className="text-gray-500">Details: </span>{selected.description}</div>}
              <div className="flex justify-between"><span className="text-gray-500">Refund Amount</span><span className="font-bold text-brand-700">{formatPrice(selected.refundAmount || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[selected.status as ReturnStatus] ?? 'bg-gray-100 text-gray-700'}`}>{selected.status}</span></div>
            </div>

            {/* Customer photos */}
            {selected.images && selected.images.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-600 mb-2">Customer Photos</p>
                <div className="flex gap-2 flex-wrap">
                  {selected.images.map((img, i) => (
                    <a key={i} href={img} target="_blank" rel="noreferrer">
                      <img src={img} alt="" className="w-20 h-20 object-cover rounded-xl border hover:scale-105 transition-transform" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Admin camera verification */}
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">Admin Verification Photo (Optional)</p>
              {cameraActive && (
                <div className="relative rounded-xl overflow-hidden bg-black mb-2">
                  <video ref={videoRef} className="w-full rounded-xl" autoPlay playsInline muted />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                    <button onClick={captureAdminPhoto} className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <Camera className="w-6 h-6 text-gray-800" />
                    </button>
                    <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setCameraActive(false); }}
                      className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✕</button>
                  </div>
                </div>
              )}
              {adminPhotoUrl && !cameraActive && (
                <div className="relative inline-block">
                  <img src={adminPhotoUrl} alt="admin capture" className="w-28 h-28 object-cover rounded-xl border" />
                  <button onClick={() => setAdminPhotoUrl(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                </div>
              )}
              {!cameraActive && !adminPhotoUrl && (
                <button onClick={openCamera} className="flex items-center gap-2 text-sm text-brand-600 border border-brand-200 px-3 py-2 rounded-xl hover:bg-brand-50">
                  <Camera className="w-4 h-4" /> Take Verification Photo
                </button>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Admin Note</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                placeholder="Add a note for the customer..."
                className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none h-20 focus:outline-none focus:border-brand-500" />
            </div>

            {['pending', 'photo_submitted'].includes(selected.status) && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleAction('rejected')} disabled={actionLoading}
                  className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 disabled:opacity-50">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Reject
                </button>
                <button onClick={() => handleAction('approved')} disabled={actionLoading}
                  className="flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approve
                </button>
              </div>
            )}
            {selected.status === 'approved' && (
              <button onClick={() => handleAction('refunded')} disabled={actionLoading}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '💸'} Mark as Refunded
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
