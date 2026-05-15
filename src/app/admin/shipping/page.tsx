'use client';
import { useState, useEffect } from 'react';
import {
  MapPin, Plus, Trash2, Save, Edit2, ChevronDown, ChevronUp,
  Truck, Package, RefreshCw, X, Navigation, Globe,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { ShippingZone, ShippingRate, ShippingConfig } from '@/lib/shipping';
import { KUWAIT_GOVERNORATES } from '@/types';
import { nanoid } from 'nanoid';

const ZONE_TYPES = [
  { value: 'governorate', label: 'Governorate', icon: '🗺️', desc: 'Kuwait governorate-based' },
  { value: 'area',        label: 'Area / District', icon: '📍', desc: 'Specific areas e.g. Salmiya' },
  { value: 'radius',      label: 'Radius', icon: '🔵', desc: 'Distance from store (km)' },
  { value: 'country',     label: 'Country', icon: '🌍', desc: 'International shipping' },
];

const RATE_METHODS = [
  { value: 'flat',         label: 'Flat Rate' },
  { value: 'free',         label: 'Free Shipping' },
  { value: 'weight',       label: 'Weight Based' },
  { value: 'price_based',  label: 'Order Value Based' },
  { value: 'local_pickup', label: 'Local Pickup' },
];

const emptyRate = (): ShippingRate => ({
  id: nanoid(8),
  name: '',
  method: 'flat',
  carrier: '',
  estimatedDays: 'Same Day',
  isActive: true,
  basePrice: 1.500,
  freeAboveAmount: undefined,
  minOrderAmount: undefined,
  maxOrderAmount: undefined,
  badge: '',
});

const emptyZone = (): Partial<ShippingZone> => ({
  name: '',
  description: '',
  type: 'governorate',
  isActive: true,
  sortOrder: 0,
  governorates: [],
  areas: [],
  countries: ['KW'],
  centerLat: 29.3759,
  centerLng: 47.9774,
  radiusKm: 20,
  rates: [emptyRate()],
});

export default function AdminShippingPage() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [config, setConfig] = useState<Partial<ShippingConfig>>({
    storeLat: 29.3759,
    storeLng: 47.9774,
    storeAddress: 'Kuwait City, Kuwait',
    currency: 'KWD',
    defaultFreeShippingThreshold: 10,
    handlingFee: 0,
    localPickupEnabled: false,
    localPickupAddress: '',
    localPickupInstructions: '',
    codEnabled: true,
    codFee: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editingZone, setEditingZone] = useState<Partial<ShippingZone> | null>(null);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'zones' | 'config' | 'test'>('zones');
  const [testInput, setTestInput] = useState({ governorate: '', area: '', orderAmount: 5 });
  const [testResult, setTestResult] = useState<any>(null);
  const [areaInput, setAreaInput] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/shipping/zones').then(r => r.json()),
      fetch('/api/shipping/config').then(r => r.json()),
    ]).then(([z, c]) => {
      setZones(z || []);
      if (c && Object.keys(c).length) setConfig(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      await fetch('/api/shipping/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      toast.success('Configuration saved!');
    } catch { toast.error('Failed to save'); }
    setConfigSaving(false);
  };

  const saveZone = async () => {
    if (!editingZone?.name) { toast.error('Zone name required'); return; }
    setSaving(true);
    try {
      const isNew = !editingZone.id;
      const url = isNew ? '/api/shipping/zones' : `/api/shipping/zones/${editingZone.id}`;
      await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingZone),
      });
      toast.success(isNew ? 'Zone created!' : 'Zone updated!');
      const z = await fetch('/api/shipping/zones').then(r => r.json());
      setZones(z);
      setEditingZone(null);
    } catch { toast.error('Failed to save zone'); }
    setSaving(false);
  };

  const deleteZone = async (id: string) => {
    if (!confirm('Delete this shipping zone?')) return;
    await fetch(`/api/shipping/zones/${id}`, { method: 'DELETE' });
    setZones(z => z.filter(x => x.id !== id));
    toast.success('Zone deleted');
  };

  const testShipping = async () => {
    try {
      const res = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          governorate: testInput.governorate || undefined,
          area: testInput.area || undefined,
          country: 'Kuwait',
          orderAmount: Number(testInput.orderAmount),
        }),
      });
      setTestResult(await res.json());
    } catch { toast.error('Test failed'); }
  };

  const addRate = () => {
    if (!editingZone) return;
    setEditingZone(z => ({ ...z!, rates: [...(z!.rates || []), emptyRate()] }));
  };

  const updateRate = (rateId: string, field: string, value: any) => {
    setEditingZone(z => ({
      ...z!,
      rates: z!.rates!.map(r => r.id === rateId ? { ...r, [field]: value } : r),
    }));
  };

  const removeRate = (rateId: string) => {
    setEditingZone(z => ({ ...z!, rates: z!.rates!.filter(r => r.id !== rateId) }));
  };

  const toggleGovernorate = (gov: string) => {
    const current = editingZone?.governorates || [];
    setEditingZone(z => ({
      ...z!,
      governorates: current.includes(gov) ? current.filter(g => g !== gov) : [...current, gov],
    }));
  };

  const addArea = () => {
    if (!areaInput.trim()) return;
    const areas = areaInput.split(/[,،]+/).map(a => a.trim()).filter(Boolean);
    setEditingZone(z => ({ ...z!, areas: [...new Set([...(z!.areas || []), ...areas])] }));
    setAreaInput('');
  };

  if (loading) return (
    <div className="p-8 space-y-4">
      {[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full rounded-2xl"/>)}
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-3">
            <Truck className="w-7 h-7 text-brand-600"/> Shipping Management
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Kuwait governorate-based shipping zones · KWD pricing · COD support</p>
        </div>
        {activeTab === 'zones' && (
          <button onClick={() => setEditingZone(emptyZone())} className="btn-primary py-2 px-4 text-sm">
            <Plus className="w-4 h-4"/> Add Zone
          </button>
        )}
        {activeTab === 'config' && (
          <button onClick={saveConfig} disabled={configSaving} className="btn-primary py-2 px-4 text-sm">
            {configSaving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : <><Save className="w-4 h-4"/> Save Config</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([
          ['zones', 'Shipping Zones', Truck],
          ['config', 'Store Config', MapPin],
          ['test', 'Test Calculator', Navigation],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4"/>{label}
          </button>
        ))}
      </div>

      {/* ── ZONES TAB ── */}
      {activeTab === 'zones' && (
        <div className="space-y-4">
          {zones.length === 0 && !editingZone && (
            <div className="card p-16 text-center">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
              <p className="text-gray-500 font-semibold mb-1">No shipping zones configured</p>
              <p className="text-gray-400 text-sm mb-6">Create zones for each Kuwait governorate with delivery rates</p>
              <button onClick={() => setEditingZone(emptyZone())} className="btn-primary py-2 px-6 text-sm">
                <Plus className="w-4 h-4"/> Create First Zone
              </button>
            </div>
          )}

          {zones.map(zone => (
            <div key={zone.id} className="card overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedZone(expandedZone === zone.id ? null : zone.id)}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${zone.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {ZONE_TYPES.find(t => t.value === zone.type)?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{zone.name}</span>
                    <span className={`badge text-xs font-bold ${zone.isActive ? 'badge-green' : 'badge-gray'}`}>{zone.isActive ? 'Active' : 'Inactive'}</span>
                    <span className="badge badge-blue text-xs">{ZONE_TYPES.find(t => t.value === zone.type)?.label}</span>
                    <span className="badge badge-gray text-xs">{zone.rates?.length || 0} rate(s)</span>
                  </div>
                  {zone.description && <p className="text-sm text-gray-500 mt-0.5">{zone.description}</p>}
                  {zone.governorates && zone.governorates.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{zone.governorates.join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); setEditingZone({ ...zone }); }}
                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4"/>
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteZone(zone.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                  {expandedZone === zone.id ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                </div>
              </div>

              {expandedZone === zone.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <div className="table-wrapper">
                    <table className="table">
                      <thead><tr><th>Rate Name</th><th>Method</th><th>Price (KWD)</th><th>Free Above</th><th>Est. Days</th><th>Status</th></tr></thead>
                      <tbody>
                        {zone.rates?.map(rate => (
                          <tr key={rate.id}>
                            <td className="font-semibold text-gray-800">{rate.name}<br/>{rate.carrier && <span className="text-xs text-gray-400">{rate.carrier}</span>}</td>
                            <td className="text-sm capitalize text-gray-600">{rate.method.replace('_', ' ')}</td>
                            <td className="font-bold">{rate.basePrice === 0 ? <span className="text-green-600">FREE</span> : `KWD ${rate.basePrice.toFixed(3)}`}</td>
                            <td className="text-sm text-gray-600">{rate.freeAboveAmount ? `KWD ${rate.freeAboveAmount}` : '—'}</td>
                            <td className="text-sm text-gray-600">{rate.estimatedDays}</td>
                            <td><span className={`badge text-xs font-bold ${rate.isActive ? 'badge-green' : 'badge-gray'}`}>{rate.isActive ? 'Active' : 'Off'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Zone Edit Modal */}
          {editingZone && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-6">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-lg">{editingZone.id ? 'Edit' : 'New'} Shipping Zone</h3>
                  <button onClick={() => setEditingZone(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5"/></button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Basic info */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Zone Name *</label>
                      <input value={editingZone.name || ''} onChange={e => setEditingZone(z => ({ ...z!, name: e.target.value }))}
                        className="input-field" placeholder="e.g. Hawalli Governorate"/>
                    </div>
                    <div>
                      <label className="label">Sort Order</label>
                      <input type="number" value={editingZone.sortOrder || 0}
                        onChange={e => setEditingZone(z => ({ ...z!, sortOrder: Number(e.target.value) }))} className="input-field"/>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Description</label>
                      <input value={editingZone.description || ''} onChange={e => setEditingZone(z => ({ ...z!, description: e.target.value }))}
                        className="input-field" placeholder="Optional description"/>
                    </div>
                  </div>

                  {/* Zone Type */}
                  <div>
                    <label className="label">Zone Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ZONE_TYPES.map(t => (
                        <button key={t.value} type="button"
                          onClick={() => setEditingZone(z => ({ ...z!, type: t.value as any }))}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${editingZone.type === t.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                          <span className="text-xl">{t.icon}</span>{t.label}
                          <span className="text-[10px] text-gray-400 text-center leading-tight">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Governorate selector */}
                  {editingZone.type === 'governorate' && (
                    <div>
                      <label className="label">Select Governorates</label>
                      <div className="flex flex-wrap gap-2 border border-gray-200 rounded-xl p-3 bg-gray-50">
                        {KUWAIT_GOVERNORATES.map(gov => (
                          <button key={gov} type="button" onClick={() => toggleGovernorate(gov)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${(editingZone.governorates || []).includes(gov) ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300'}`}>
                            {gov}
                          </button>
                        ))}
                      </div>
                      {(editingZone.governorates || []).length > 0 && (
                        <p className="text-xs text-brand-600 mt-1.5 font-semibold">
                          Selected: {editingZone.governorates!.length} governorate(s)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Area / District input */}
                  {editingZone.type === 'area' && (
                    <div>
                      <label className="label">Areas / Districts</label>
                      <div className="flex gap-2 mb-2">
                        <input value={areaInput} onChange={e => setAreaInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArea())}
                          className="input-field flex-1 text-sm"
                          placeholder="e.g. Salmiya, Hawalli, Rumaithiya (comma separated)"/>
                        <button type="button" onClick={addArea}
                          className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700">Add</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {(editingZone.areas || []).map(area => (
                          <span key={area} className="flex items-center gap-1 badge badge-blue text-xs">
                            {area}
                            <button type="button"
                              onClick={() => setEditingZone(z => ({ ...z!, areas: z!.areas!.filter(a => a !== area) }))}
                              className="hover:text-red-400"><X className="w-3 h-3"/></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Radius */}
                  {editingZone.type === 'radius' && (
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="label">Centre Latitude</label>
                        <input type="number" step="0.0001" value={editingZone.centerLat || ''}
                          onChange={e => setEditingZone(z => ({ ...z!, centerLat: Number(e.target.value) }))}
                          className="input-field" placeholder="29.3759"/>
                      </div>
                      <div>
                        <label className="label">Centre Longitude</label>
                        <input type="number" step="0.0001" value={editingZone.centerLng || ''}
                          onChange={e => setEditingZone(z => ({ ...z!, centerLng: Number(e.target.value) }))}
                          className="input-field" placeholder="47.9774"/>
                      </div>
                      <div>
                        <label className="label">Radius (km)</label>
                        <input type="number" value={editingZone.radiusKm || ''}
                          onChange={e => setEditingZone(z => ({ ...z!, radiusKm: Number(e.target.value) }))}
                          className="input-field" placeholder="20"/>
                      </div>
                      <div className="sm:col-span-3 bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                        📍 Default coordinates: Kuwait City (29.3759, 47.9774).{' '}
                        <a href="https://www.latlong.net" target="_blank" rel="noreferrer" className="font-bold underline">Find coordinates →</a>
                      </div>
                    </div>
                  )}

                  {/* Country */}
                  {editingZone.type === 'country' && (
                    <div>
                      <label className="label">Countries (ISO codes)</label>
                      <input value={(editingZone.countries || []).join(', ')}
                        onChange={e => setEditingZone(z => ({ ...z!, countries: e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean) }))}
                        className="input-field" placeholder="KW, SA, AE, BH, OM, QA"/>
                      <p className="text-xs text-gray-400 mt-1">Gulf countries: KW, SA, AE, BH, OM, QA</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="zoneActive" checked={editingZone.isActive !== false}
                      onChange={e => setEditingZone(z => ({ ...z!, isActive: e.target.checked }))}
                      className="w-4 h-4 accent-brand-600"/>
                    <label htmlFor="zoneActive" className="text-sm font-semibold text-gray-700">Zone Active</label>
                  </div>

                  {/* Rates */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="label mb-0">Shipping Rates</label>
                      <button type="button" onClick={addRate} className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800">
                        <Plus className="w-3.5 h-3.5"/>Add Rate
                      </button>
                    </div>
                    <div className="space-y-4">
                      {(editingZone.rates || []).map((rate, idx) => (
                        <div key={rate.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rate #{idx + 1}</span>
                            <button type="button" onClick={() => removeRate(rate.id)} className="p-1 text-gray-400 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                          <div className="grid sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Rate Name *</label>
                              <input value={rate.name} onChange={e => updateRate(rate.id, 'name', e.target.value)}
                                className="input-field text-sm py-2" placeholder="Same Day Delivery"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Method</label>
                              <select value={rate.method} onChange={e => updateRate(rate.id, 'method', e.target.value)} className="input-field text-sm py-2">
                                {RATE_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Carrier</label>
                              <input value={rate.carrier || ''} onChange={e => updateRate(rate.id, 'carrier', e.target.value)}
                                className="input-field text-sm py-2" placeholder="Own Fleet, Aramex..."/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Base Price (KWD)</label>
                              <input type="number" step="0.001" min="0" value={rate.basePrice}
                                onChange={e => updateRate(rate.id, 'basePrice', Number(e.target.value))}
                                className="input-field text-sm py-2" placeholder="1.500"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Free Above (KWD)</label>
                              <input type="number" step="0.001" value={rate.freeAboveAmount || ''}
                                onChange={e => updateRate(rate.id, 'freeAboveAmount', e.target.value ? Number(e.target.value) : undefined)}
                                className="input-field text-sm py-2" placeholder="e.g. 10"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Est. Delivery</label>
                              <input value={rate.estimatedDays} onChange={e => updateRate(rate.id, 'estimatedDays', e.target.value)}
                                className="input-field text-sm py-2" placeholder="Same Day / Next Day / 1-2"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Min Order (KWD)</label>
                              <input type="number" step="0.001" value={rate.minOrderAmount || ''}
                                onChange={e => updateRate(rate.id, 'minOrderAmount', e.target.value ? Number(e.target.value) : undefined)}
                                className="input-field text-sm py-2" placeholder="No minimum"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Max Order (KWD)</label>
                              <input type="number" step="0.001" value={rate.maxOrderAmount || ''}
                                onChange={e => updateRate(rate.id, 'maxOrderAmount', e.target.value ? Number(e.target.value) : undefined)}
                                className="input-field text-sm py-2" placeholder="No maximum"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Badge</label>
                              <input value={rate.badge || ''} onChange={e => updateRate(rate.id, 'badge', e.target.value)}
                                className="input-field text-sm py-2" placeholder="FAST, FREE, POPULAR..."/>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <input type="checkbox" id={`rActive-${rate.id}`} checked={rate.isActive}
                              onChange={e => updateRate(rate.id, 'isActive', e.target.checked)}
                              className="w-4 h-4 accent-brand-600"/>
                            <label htmlFor={`rActive-${rate.id}`} className="text-xs font-semibold text-gray-600">Rate Active</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                  <button onClick={() => setEditingZone(null)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
                  <button onClick={saveZone} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
                    {saving
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      : <><Save className="w-4 h-4"/>{editingZone.id ? 'Save Changes' : 'Create Zone'}</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONFIG TAB ── */}
      {activeTab === 'config' && (
        <div className="max-w-2xl space-y-5">
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-600"/>Store Location (Kuwait)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Store Address</label>
                <input value={config.storeAddress || ''} onChange={e => setConfig(c => ({ ...c, storeAddress: e.target.value }))}
                  className="input-field" placeholder="Block 5, Street 12, Kuwait City"/>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Latitude</label>
                  <input type="number" step="0.0001" value={config.storeLat || ''}
                    onChange={e => setConfig(c => ({ ...c, storeLat: Number(e.target.value) }))}
                    className="input-field" placeholder="29.3759"/>
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input type="number" step="0.0001" value={config.storeLng || ''}
                    onChange={e => setConfig(c => ({ ...c, storeLng: Number(e.target.value) }))}
                    className="input-field" placeholder="47.9774"/>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-brand-600"/>Defaults (KWD)
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Free Shipping Above (KWD)</label>
                <input type="number" step="0.001" value={config.defaultFreeShippingThreshold || ''}
                  onChange={e => setConfig(c => ({ ...c, defaultFreeShippingThreshold: Number(e.target.value) }))}
                  className="input-field" placeholder="10.000"/>
                <p className="text-xs text-gray-400 mt-1">Fallback if no zone matched</p>
              </div>
              <div>
                <label className="label">Handling Fee (KWD)</label>
                <input type="number" step="0.001" value={config.handlingFee || ''}
                  onChange={e => setConfig(c => ({ ...c, handlingFee: Number(e.target.value) }))}
                  className="input-field" placeholder="0.000"/>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-bold text-gray-800">💵 Cash on Delivery (COD)</h3>
              <label className="flex items-center gap-2 ml-auto cursor-pointer">
                <input type="checkbox" checked={config.codEnabled ?? true}
                  onChange={e => setConfig(c => ({ ...c, codEnabled: e.target.checked }))}
                  className="w-4 h-4 accent-brand-600"/>
                <span className="text-sm font-semibold text-gray-700">Enable COD</span>
              </label>
            </div>
            {config.codEnabled && (
              <div>
                <label className="label">COD Extra Fee (KWD)</label>
                <input type="number" step="0.001" value={config.codFee || ''}
                  onChange={e => setConfig(c => ({ ...c, codFee: Number(e.target.value) }))}
                  className="input-field" placeholder="0.000 (free)"/>
                <p className="text-xs text-gray-400 mt-1">Extra charge for cash on delivery orders (set 0 for no extra fee)</p>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-brand-600"/>Local Pickup
              </h3>
              <label className="flex items-center gap-2 ml-auto cursor-pointer">
                <input type="checkbox" checked={config.localPickupEnabled || false}
                  onChange={e => setConfig(c => ({ ...c, localPickupEnabled: e.target.checked }))}
                  className="w-4 h-4 accent-brand-600"/>
                <span className="text-sm font-semibold text-gray-700">Enable Pickup</span>
              </label>
            </div>
            {config.localPickupEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="label">Pickup Address</label>
                  <input value={config.localPickupAddress || ''}
                    onChange={e => setConfig(c => ({ ...c, localPickupAddress: e.target.value }))}
                    className="input-field" placeholder="Block 5, Street 12, Salmiya, Kuwait"/>
                </div>
                <div>
                  <label className="label">Pickup Instructions</label>
                  <textarea value={config.localPickupInstructions || ''}
                    onChange={e => setConfig(c => ({ ...c, localPickupInstructions: e.target.value }))}
                    rows={2} className="input-field resize-none"
                    placeholder="e.g. Call us before arriving, open Sat–Thu 8am–6pm"/>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEST TAB ── */}
      {activeTab === 'test' && (
        <div className="max-w-xl space-y-5">
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-brand-600"/>Test Shipping Calculator
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">Governorate</label>
                <select value={testInput.governorate} onChange={e => setTestInput(t => ({ ...t, governorate: e.target.value }))} className="input-field">
                  <option value="">-- Select governorate --</option>
                  {KUWAIT_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Area / District (optional)</label>
                <input value={testInput.area} onChange={e => setTestInput(t => ({ ...t, area: e.target.value }))}
                  className="input-field" placeholder="e.g. Salmiya"/>
              </div>
              <div>
                <label className="label">Order Amount (KWD)</label>
                <input type="number" step="0.001" value={testInput.orderAmount}
                  onChange={e => setTestInput(t => ({ ...t, orderAmount: Number(e.target.value) }))}
                  className="input-field" placeholder="5.000"/>
              </div>
              <button onClick={testShipping} className="btn-primary py-2.5 px-6 text-sm">
                <Navigation className="w-4 h-4"/> Calculate Shipping
              </button>
            </div>
          </div>

          {testResult && (
            <div className="card p-6">
              <h4 className="font-bold text-gray-800 mb-3">Results</h4>
              {testResult.zoneMatched && (
                <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2 mb-3">
                  ✅ Matched zone: <strong>{testResult.zoneMatched}</strong>
                </p>
              )}
              {!testResult.zoneMatched && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-3">
                  ⚠️ No zone matched — using default fallback rate
                </p>
              )}
              {testResult.amountToFreeShipping > 0 && (
                <p className="text-sm text-blue-700 bg-blue-50 rounded-xl px-3 py-2 mb-3">
                  Add <strong>KWD {testResult.amountToFreeShipping?.toFixed(3)}</strong> more for free shipping
                </p>
              )}
              <div className="space-y-2">
                {testResult.options?.map((opt: any) => (
                  <div key={opt.rateId} className={`flex items-center justify-between p-3 rounded-xl border ${opt.isFree ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {opt.name} {opt.badge && <span className={`badge text-xs ml-1 ${opt.isFree ? 'badge-green' : 'badge-blue'}`}>{opt.badge}</span>}
                      </p>
                      <p className="text-xs text-gray-500">{opt.carrier || opt.method} · {opt.estimatedDays}</p>
                    </div>
                    <span className={`font-bold ${opt.isFree ? 'text-green-600' : 'text-gray-900'}`}>
                      {opt.isFree ? 'FREE' : `KWD ${opt.price.toFixed(3)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
