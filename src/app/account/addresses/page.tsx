'use client';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Plus, Edit2, Trash2, MapPin, Star, Loader2, X, Save, Check, Home, Briefcase } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { KUWAIT_GOVERNORATES } from '@/types';
import { govLabel } from '@/lib/utils';
import type { ShippingAddress } from '@/types';

const EMPTY: Partial<ShippingAddress> & { label?: string } = {
  label: 'Home', firstName: '', lastName: '', phone: '',
  block: '', street: '', building: '', floor: '', apartment: '',
  city: '', governorate: KUWAIT_GOVERNORATES[0], country: 'Kuwait', isDefault: false,
};

export default function AddressBookPage() {
  const { t, isArabic } = useLanguage();
  const lbl = (l?: string) => (l && ['Home', 'Work', 'Other'].includes(l) ? t(`c2_addr.${l}`) : l || t('c2_addr.addrFallback'));
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<any | null>(null);
  const [creating, setCreating]   = useState(false);
  const [form, setForm]           = useState<any>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/account/addresses')
      .then(r => r.json())
      .then(d => { setAddresses(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { toast.error(t('c2_addr.loadFail')); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const startEdit = (addr: any) => {
    setEditing(addr);
    setCreating(false);
    setForm({ ...addr });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm({ ...EMPTY });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!form.firstName?.trim() || !form.block?.trim() || !form.governorate) {
      toast.error(t('addr.fillRequired')); return;
    }
    setSaving(true);
    try {
      const url    = editing ? `/api/account/addresses/${editing.id}` : '/api/account/addresses';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t('c2_addr.saveFail')); setSaving(false); return; }
      toast.success(t('addr.saved'));
      setEditing(null); setCreating(false); setForm(EMPTY);
      load();
    } catch { toast.error(t('c2_addr.saveFail')); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('addr.deleteConfirm'))) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(t('c2_addr.delFail')); setDeleting(null); return; }
      setAddresses(a => a.filter(x => x.id !== id));
      toast.success(t('addr.deleted'));
    } catch { toast.error(t('c2_addr.delFail')); }
    setDeleting(null);
  };

  const setDefault = async (addr: any) => {
    try {
      const r = await fetch(`/api/account/addresses/${addr.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addr, isDefault: true }),
      });
      if (!r.ok) throw new Error();
      load();
      toast.success(t('c2_addr.defUpdated'));
    } catch { toast.error(t('c2_addr.failed')); }
  };

  const f = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  return (
    <div>
      <Header />
      <main className="bg-gray-50 min-h-screen">
        <div className="page-hero">
          <div className="container-custom">
            <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
              <MapPin className="w-6 h-6 text-brand-600" /> {t('addr.title')}
            </h1>
            <p className="text-gray-500 text-sm mt-1">{t('addr.subtitle')}</p>
          </div>
        </div>

        <div className="container-custom py-5 max-w-2xl">
          {/* Add button */}
          {!creating && !editing && (
            <button onClick={startCreate}
              className="w-full mb-6 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-brand-300 text-brand-700 rounded-2xl font-semibold hover:bg-brand-50 transition-colors">
              <Plus className="w-5 h-5" /> {t('addr.addNew')}
            </button>
          )}

          {/* ── Form ── */}
          {(creating || editing) && (
            <div className="card p-5 mb-6 border-2 border-brand-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{editing ? t('addr.edit') : t('addr.new')}</h3>
                <button onClick={() => { setEditing(null); setCreating(false); }} aria-label={t('c2_addr.close')} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Label */}
                <div className="col-span-2">
                  <label className="label">{t('addr.label')}</label>
                  <div className="flex gap-2">
                    {['Home', 'Work', 'Other'].map(l => (
                      <button key={l} type="button" onClick={() => f('label', l)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-colors ${form.label === l ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                        {l === 'Home' ? <Home className="w-4 h-4 inline" /> : l === 'Work' ? <Briefcase className="w-4 h-4 inline" /> : <MapPin className="w-4 h-4 inline" />} {lbl(l)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">{t('c2_addr.first')} *</label>
                  <input value={form.firstName || ''} onChange={e => f('firstName', e.target.value)} className="input-field" placeholder="" />
                </div>
                <div>
                  <label className="label">{t('c2_addr.last')} *</label>
                  <input value={form.lastName || ''} onChange={e => f('lastName', e.target.value)} className="input-field" placeholder="" />
                </div>
                <div className="col-span-2 relative">
                  <label className="label">{t('c2_addr.phone')} *</label>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold" dir="ltr">+965</span>
                    <input value={form.phone || ''} onChange={e => f('phone', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="input-field ps-14" dir="ltr" placeholder="5xxxxxxx" />
                  </div>
                </div>

                {/* Governorate */}
                <div>
                  <label className="label">{t('c2_addr.gov')} *</label>
                  <select value={form.governorate || ''} onChange={e => f('governorate', e.target.value)} className="input-field">
                    {KUWAIT_GOVERNORATES.map(g => <option key={g} value={g}>{govLabel(g, isArabic)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('c2_addr.city')} *</label>
                  <input value={form.city || ''} onChange={e => f('city', e.target.value)} className="input-field" placeholder="" />
                </div>
                <div>
                  <label className="label">{t('c2_addr.block')} *</label>
                  <input value={form.block || ''} onChange={e => f('block', e.target.value)} className="input-field" placeholder="7" />
                </div>
                <div>
                  <label className="label">{t('c2_addr.street')} *</label>
                  <input value={form.street || ''} onChange={e => f('street', e.target.value)} className="input-field" placeholder="23" />
                </div>
                <div>
                  <label className="label">{t('c2_addr.building')} *</label>
                  <input value={form.building || ''} onChange={e => f('building', e.target.value)} className="input-field" placeholder="14" />
                </div>
                <div>
                  <label className="label">{t('c2_addr.floor')}</label>
                  <input value={form.floor || ''} onChange={e => f('floor', e.target.value)} className="input-field" placeholder="3" />
                </div>
                <div className="col-span-2">
                  <label className="label">{t('c2_addr.apt')}</label>
                  <input value={form.apartment || ''} onChange={e => f('apartment', e.target.value)} className="input-field" placeholder="" />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isDefault || false} onChange={e => f('isDefault', e.target.checked)}
                      className="w-4 h-4 accent-brand-600 rounded" />
                    <span className="text-sm text-gray-700 font-medium">{t('addr.defaultCheckbox')}</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => { setEditing(null); setCreating(false); }} className="btn-secondary flex-1 py-2.5 text-sm">
                  {t('addr.cancel')}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editing ? t('addr.save') : t('addr.add')}
                </button>
              </div>
            </div>
          )}

          {/* ── Address Cards ── */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="card p-5 h-32 skeleton" />)}
            </div>
          ) : addresses.length === 0 && !creating ? (
            <div className="card p-12 text-center">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">{t('addr.none')}</p>
              <p className="text-gray-400 text-sm mt-1">{t('addr.noneSub')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map(addr => (
                <div key={addr.id} className={`card p-4 ${addr.isDefault ? 'border-2 border-brand-200 bg-brand-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${addr.isDefault ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                        {addr.label === 'Home' ? <Home className="w-4 h-4" /> : addr.label === 'Work' ? <Briefcase className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-gray-800 text-sm">{lbl(addr.label)}</p>
                          {addr.isDefault && (
                            <span className="flex items-center gap-1 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                              <Check className="w-2.5 h-2.5" /> {t('addr.defaultBadge')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 font-medium">{addr.firstName} {addr.lastName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t('c2_addr.addrLine', { block: addr.block, street: addr.street, building: addr.building })}
                          {addr.floor ? `، ${t('c2_addr.floorN', { n: addr.floor })}` : ''}
                          {addr.apartment ? `, ${addr.apartment}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">{addr.city}, {govLabel(addr.governorate, isArabic)}, {t('c2_addr.kuwait')}</p>
                        {addr.phone && <p className="text-xs text-gray-400 mt-0.5" dir="ltr">+965 {addr.phone}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => startEdit(addr)} aria-label={t('c2_addr.edit')}
                        className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(addr.id)} disabled={deleting === addr.id} aria-label={t('c2_addr.delete')}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                        {deleting === addr.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {!addr.isDefault && (
                    <button onClick={() => setDefault(addr)}
                      className="mt-3 pt-3 w-full border-t border-gray-100 flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors font-semibold">
                      <Star className="w-3.5 h-3.5" /> {t('addr.setDefault')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
