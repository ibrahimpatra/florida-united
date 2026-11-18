'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Zap, Plus, Pencil, Trash2, X, Clock, Percent, Banknote, Gift, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { NumberInput } from '@/components/ui/NumberInput';
import { EntityPicker, categoryWithDescendants } from '@/components/admin/EntityPicker';
import { TranslateButton } from '@/components/admin/TranslateButton';
import { formatPrice } from '@/lib/utils';
import type { FlashDeal } from '@/lib/shipping';

type Deal = Partial<FlashDeal>;
const SWATCHES = ['#b91c1c', '#c2410c', '#a16207', '#15803d', '#0f766e', '#1d4ed8', '#6d28d9', '#be185d', '#1f2937'];
const DAY = 86400000;

const empty = (): Deal => ({
  title: '', titleAr: '', subtitle: '', subtitleAr: '', badgeText: 'Flash deal', badgeTextAr: '',
  type: 'percentage', discountValue: 10, scope: 'all', categoryIds: [], productIds: [],
  startAt: new Date().toISOString(), endAt: new Date(Date.now() + 3 * DAY).toISOString(),
  bannerColor: '#b91c1c', showCountdown: true, showOnHomepage: true, showOnProductPage: true, isActive: true, isPinned: false,
});

const pad = (n: number) => String(n).padStart(2, '0');
const toLocal = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return isNaN(+d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : '');
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const offerText = (d: Deal) => d.type === 'bogo' ? 'Buy 1 get 1 free' : d.type === 'fixed' ? `${formatPrice(Number(d.discountValue) || 0)} off each` : `${Number(d.discountValue) || 0}% off`;
const status = (d: Deal) => { const n = Date.now(), s = +new Date(d.startAt || 0), e = +new Date(d.endAt || 0); return !d.isActive ? 'off' : e < n ? 'ended' : s > n ? 'soon' : 'live'; };
const BADGE: Record<string, string> = { live: 'bg-green-100 text-green-800', soon: 'bg-blue-100 text-blue-800', ended: 'bg-gray-100 text-gray-600', off: 'bg-amber-100 text-amber-800' };
const LABEL: Record<string, string> = { live: 'Live now', soon: 'Scheduled', ended: 'Ended', off: 'Switched off' };

export default function AdminFlashDealsPage() {
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Deal | null>(null);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [withSubs, setWithSubs] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await fetch('/api/flash-deals?admin=true', { cache: 'no-store' }).then(r => r.json()); setDeals(Array.isArray(d) ? d : []); }
    catch { toast.error('Could not load the deals.'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (patch: Deal) => setForm(f => ({ ...f!, ...patch }));

  const save = async () => {
    const f = form!;
    if (!String(f.title || '').trim()) return toast.error('Give the deal a name.');
    if (f.type !== 'bogo' && !(Number(f.discountValue) > 0)) return toast.error('Enter how much the discount is.');
    if (f.type === 'percentage' && Number(f.discountValue) > 100) return toast.error('A percentage cannot be more than 100.');
    if (f.scope === 'category' && !(f.categoryIds || []).length) return toast.error('Pick at least one category.');
    if (f.scope === 'products' && !(f.productIds || []).length) return toast.error('Pick at least one product.');
    if (!f.startAt || !f.endAt || +new Date(f.endAt) <= +new Date(f.startAt)) return toast.error('The end must be after the start.');
    setSaving(true);
    try {
      // sub-categories: store the chosen categories AND everything under them, so pricing never needs the tree
      let categoryIds = f.categoryIds || [];
      if (f.scope === 'category' && withSubs) categoryIds = [...new Set((await Promise.all(categoryIds.map(categoryWithDescendants))).flat())];
      const isNew = !f.id;
      const res = await fetch(isNew ? '/api/flash-deals' : `/api/flash-deals/${f.id}`, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, categoryIds }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || 'Could not save the deal.'); setSaving(false); return; }
      toast.success(isNew ? 'Deal created. It shows on the home page automatically.' : 'Deal updated.');
      setForm(null); load();
    } catch { toast.error('Network error, please try again.'); }
    setSaving(false);
  };

  const remove = async (d: FlashDeal) => {
    if (!confirm(`Delete "${d.title}"?`)) return;
    const r = await fetch(`/api/flash-deals/${d.id}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(j.error || 'Could not delete the deal.');
    if (j.archived) { setDeals(x => x.map(y => (y.id === d.id ? { ...y, isActive: false } : y))); toast(j.message, { icon: 'i', duration: 6000 }); }
    else { setDeals(x => x.filter(y => y.id !== d.id)); toast.success('Deleted.'); }
  };
  const toggle = async (d: FlashDeal) => {
    const r = await fetch(`/api/flash-deals/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !d.isActive }) });
    if (!r.ok) return toast.error('Could not update the deal.');
    setDeals(x => x.map(y => (y.id === d.id ? { ...y, isActive: !y.isActive } : y)));
  };

  const sorted = useMemo(() => {
    const rank: Record<string, number> = { live: 0, soon: 1, off: 2, ended: 3 };
    return [...deals].sort((a, b) => rank[status(a)] - rank[status(b)]);
  }, [deals]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Zap className="w-6 h-6 text-brand-600" />Deals and promotions</h1>
          <p className="text-sm text-gray-500 mt-1">A deal lowers prices on the shop and at checkout, and puts a banner at the top of the home page while it runs.</p>
        </div>
        <button onClick={() => { setForm(empty()); setMore(false); }} className="btn-primary px-4 py-2.5 text-sm"><Plus className="w-4 h-4" />New deal</button>
      </div>

      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        : !sorted.length ? (
          <div className="card p-10 text-center">
            <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-800">No deals yet</p>
            <p className="text-sm text-gray-500 mt-1 mb-4">Create one in under a minute. The banner and Arabic text are made for you.</p>
            <button onClick={() => { setForm(empty()); setMore(false); }} className="btn-primary px-4 py-2 text-sm"><Plus className="w-4 h-4" />Create the first deal</button>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(d => {
              const st = status(d);
              return (
                <div key={d.id} className="card p-4 flex flex-wrap sm:flex-nowrap items-center gap-4">
                  <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: d.bannerColor }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-gray-900 truncate">{d.title}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE[st]}`}>{LABEL[st]}</span>
                      {d.isPinned && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white">Pinned first</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{offerText(d)} on {d.scope === 'all' ? 'everything' : d.scope === 'category' ? `${d.categoryIds?.length || 0} categories` : `${d.productIds?.length || 0} products`}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(d.startAt)} to {fmt(d.endAt)} · used {d.usedCount || 0} times</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggle(d)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50">{d.isActive ? 'Switch off' : 'Switch on'}</button>
                    <button onClick={() => { setForm({ ...d }); setMore(false); }} aria-label="Edit" className="p-2 rounded-lg hover:bg-gray-100"><Pencil className="w-4 h-4 text-gray-600" /></button>
                    <button onClick={() => remove(d)} aria-label="Delete" className="p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {form && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setForm(null); }}>
          <div className="bg-white w-full sm:max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white border-b">
              <h2 className="font-bold text-lg">{form.id ? 'Edit deal' : 'New deal'}</h2>
              <button onClick={() => setForm(null)} aria-label="Close" className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-7 flex-1">
              {/* 1 */}
              <section>
                <h3 className="font-bold text-gray-900 mb-3">1. Name the deal</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className="label">Name (English)</label><input value={form.title || ''} onChange={e => set({ title: e.target.value })} className="input-field" placeholder="Weekend cable sale" /></div>
                  <div><label className="label">Name (Arabic)</label><input dir="rtl" value={form.titleAr || ''} onChange={e => set({ titleAr: e.target.value })} className="input-field" /></div>
                  <div><label className="label">Short line under the name (English)</label><input value={form.subtitle || ''} onChange={e => set({ subtitle: e.target.value })} className="input-field" placeholder="Wires, sockets and switches" /></div>
                  <div><label className="label">Short line (Arabic)</label><input dir="rtl" value={form.subtitleAr || ''} onChange={e => set({ subtitleAr: e.target.value })} className="input-field" /></div>
                  <div><label className="label">Small badge (English)</label><input value={form.badgeText || ''} onChange={e => set({ badgeText: e.target.value })} className="input-field" /></div>
                  <div><label className="label">Small badge (Arabic)</label><input dir="rtl" value={form.badgeTextAr || ''} onChange={e => set({ badgeTextAr: e.target.value })} className="input-field" /></div>
                </div>
                <div className="mt-3">
                  <TranslateButton context="a sale banner for a hardware store" fields={[
                    { en: form.title, ar: form.titleAr, set: v => set({ titleAr: v }) },
                    { en: form.subtitle, ar: form.subtitleAr, set: v => set({ subtitleAr: v }) },
                    { en: form.badgeText, ar: form.badgeTextAr, set: v => set({ badgeTextAr: v }) },
                  ]} />
                </div>
              </section>

              {/* 2 */}
              <section>
                <h3 className="font-bold text-gray-900 mb-3">2. What does the customer get?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([['percentage', 'Percent off', Percent], ['fixed', 'KD off each', Banknote], ['bogo', 'Buy 1 get 1 free', Gift]] as const).map(([v, label, Icon]) => (
                    <button key={v} type="button" onClick={() => set({ type: v })}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs sm:text-sm font-semibold ${form.type === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <Icon className="w-5 h-5" />{label}
                    </button>
                  ))}
                </div>
                {form.type !== 'bogo' ? (
                  <div className="mt-3 flex items-center gap-2 max-w-xs">
                    <NumberInput type="number" min={0} step={form.type === 'percentage' ? 1 : 0.001} value={form.discountValue ?? ''} onChange={e => set({ discountValue: Number(e.target.value) })} className="input-field" />
                    <span className="text-sm font-semibold text-gray-600 w-12">{form.type === 'percentage' ? '%' : 'KWD'}</span>
                  </div>
                ) : <p className="mt-3 text-sm text-gray-500">Every second unit of the same product is free.</p>}
              </section>

              {/* 3 */}
              <section>
                <h3 className="font-bold text-gray-900 mb-3">3. Which products?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  {([['all', 'Everything'], ['category', 'Categories'], ['products', 'Chosen products']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => set({ scope: v })}
                      className={`py-2.5 px-2 rounded-xl border-2 text-xs sm:text-sm font-semibold ${form.scope === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{label}</button>
                  ))}
                </div>
                {form.scope === 'category' && (
                  <div className="space-y-2">
                    <EntityPicker kind="category" multiple value={form.categoryIds || []} onChange={ids => set({ categoryIds: ids })} placeholder="Search categories and sub-categories…" />
                    <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={withSubs} onChange={e => setWithSubs(e.target.checked)} className="w-4 h-4" />Include every sub-category under the ones I pick</label>
                  </div>
                )}
                {form.scope === 'products' && <EntityPicker kind="product" multiple value={form.productIds || []} onChange={ids => set({ productIds: ids })} />}
                {form.scope === 'all' && <p className="text-sm text-gray-500">The discount applies to every product in the shop.</p>}
              </section>

              {/* 4 */}
              <section>
                <h3 className="font-bold text-gray-900 mb-3">4. When does it run?</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[['Today', 1], ['3 days', 3], ['1 week', 7], ['1 month', 30]].map(([label, days]) => (
                    <button key={label as string} type="button" onClick={() => set({ startAt: new Date().toISOString(), endAt: new Date(Date.now() + (days as number) * DAY).toISOString() })}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-gray-50">{label} from now</button>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className="label">Starts</label><input type="datetime-local" value={toLocal(form.startAt)} onChange={e => set({ startAt: fromLocal(e.target.value) })} className="input-field" /></div>
                  <div><label className="label">Ends</label><input type="datetime-local" value={toLocal(form.endAt)} onChange={e => set({ endAt: fromLocal(e.target.value) })} className="input-field" /></div>
                </div>
              </section>

              {/* 5 */}
              <section>
                <h3 className="font-bold text-gray-900 mb-3">5. Banner on the home page</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {SWATCHES.map(c => <button key={c} type="button" aria-label={c} onClick={() => set({ bannerColor: c })} className={`w-8 h-8 rounded-full border-2 ${form.bannerColor === c ? 'border-gray-900 scale-110' : 'border-white shadow'}`} style={{ background: c }} />)}
                  <input type="color" value={form.bannerColor || '#b91c1c'} onChange={e => set({ bannerColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" aria-label="Custom colour" />
                </div>
                <div className="rounded-xl p-5 text-white" style={{ background: form.bannerColor }}>
                  <p className="text-[11px] font-bold tracking-wide opacity-90">{form.badgeText || 'Flash deal'}</p>
                  <p className="text-xl font-extrabold mt-1">{form.title || 'Your deal name'}</p>
                  <p className="text-sm opacity-90">{form.subtitle || offerText(form)}</p>
                </div>
                <p className="text-xs text-gray-500 mt-2">The real banner also shows the countdown and a Shop now button, in English and Arabic.</p>
              </section>

              {/* advanced */}
              <section>
                <button type="button" onClick={() => setMore(m => !m)} className="flex items-center gap-1.5 text-sm font-semibold text-brand-700"><ChevronDown className={`w-4 h-4 transition-transform ${more ? 'rotate-180' : ''}`} />More options</button>
                {more && (
                  <div className="mt-3 grid sm:grid-cols-3 gap-3">
                    <div><label className="label">Minimum cart (KWD)</label><NumberInput type="number" min={0} step={0.001} value={form.minCartAmount ?? ''} onChange={e => set({ minCartAmount: e.target.value === '' ? (null as any) : Number(e.target.value) })} className="input-field" placeholder="None" /></div>
                    <div><label className="label">Total uses allowed</label><NumberInput type="number" min={0} step={1} value={form.maxUsesTotal ?? ''} onChange={e => set({ maxUsesTotal: e.target.value === '' ? (null as any) : Number(e.target.value) })} className="input-field" placeholder="Unlimited" /></div>
                    <div><label className="label">Uses per customer</label><NumberInput type="number" min={0} step={1} value={form.maxUsesPerUser ?? ''} onChange={e => set({ maxUsesPerUser: e.target.value === '' ? (null as any) : Number(e.target.value) })} className="input-field" placeholder="Unlimited" /></div>
                    {([['showCountdown', 'Show the countdown'], ['showOnHomepage', 'Show on the home page'], ['showOnProductPage', 'Show on product pages'], ['isPinned', 'Show first when several deals run']] as const).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-3"><input type="checkbox" checked={!!(form as any)[k]} onChange={e => set({ [k]: e.target.checked } as any)} className="w-4 h-4" />{label}</label>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex items-center justify-end gap-2">
              <button onClick={() => setForm(null)} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary px-5 py-2 text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{form.id ? 'Save changes' : 'Create deal'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
