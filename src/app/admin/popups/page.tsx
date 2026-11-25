'use client';
import { SeoFields } from '@/components/admin/SeoFields';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { AiFillButton } from '@/components/admin/SeoFields';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, X, Eye, EyeOff, Megaphone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TranslateButton } from '@/components/admin/TranslateButton';
import { NumberInput } from '@/components/ui/NumberInput';
import { PopupCard } from '@/components/layout/PopupManager';

const EMPTY = {
  name: '', isActive: true, priority: 0, title: '', titleAr: '', body: '', bodyAr: '', image: '', imageAlt: '', imageAltAr: '', ctaText: 'Shop now', ctaTextAr: 'تسوق الآن', ctaLink: '/shop', couponCode: '',
  layout: 'center', style: 'light', trigger: 'delay', delaySeconds: 6, scrollPercent: 40, audience: 'everyone', pages: [] as string[], frequency: 'once', startsAt: '', endsAt: '',
};
const TEMPLATES: { label: string; data: Partial<typeof EMPTY> }[] = [
  { label: '20% off first order', data: { name: 'First order 20% off', title: '20% off your first order', body: 'Create an account and use this code at checkout.', ctaText: 'Start shopping', ctaLink: '/shop', couponCode: 'WELCOME20', audience: 'guests', trigger: 'delay', delaySeconds: 6, frequency: 'once', style: 'brand' } },
  { label: 'Free delivery offer', data: { name: 'Free delivery', title: 'Free delivery on bigger orders', body: 'Add a few more items and delivery is on us.', ctaText: 'See deals', ctaLink: '/deals', trigger: 'scroll', scrollPercent: 50, frequency: 'daily', style: 'accent', layout: 'corner' } },
  { label: 'Leaving? Last chance', data: { name: 'Exit offer', title: 'Before you go', body: 'Your cart is waiting. Use this code for a little extra off.', ctaText: 'Back to cart', ctaLink: '/cart', trigger: 'exit', pages: ['cart', 'product'], frequency: 'session', couponCode: 'STAY5' } },
];
const PAGES = [['home', 'Home'], ['shop', 'Shop & categories'], ['product', 'Product pages'], ['cart', 'Cart'], ['deals', 'Deals']] as const;

const toLocal = (iso: string) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : '');

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <div><label className="label">{label}</label><select value={value} onChange={e => onChange(e.target.value)} className="input-field">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
}

export default function AdminPopupsPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/popups?all=true', { cache: 'no-store' }); const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to load');
      setList(Array.isArray(d) ? d : []);
    } catch (e: any) { toast.error(e.message || 'Failed to load popups'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (saving || !form) return;
    setSaving(true);
    try {
      const r = await fetch(form.id ? `/api/popups/${form.id}` : '/api/popups', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || `Could not save (${r.status})`); return; }
      toast.success(form.id ? 'Popup updated.' : 'Popup created.'); setForm(null); load();
    } catch { toast.error('Network error, not saved'); } finally { setSaving(false); }
  };
  const toggle = async (p: any) => {
    const r = await fetch(`/api/popups/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !p.isActive }) });
    if (!r.ok) { toast.error('Could not update.'); return; }
    setList(l => l.map(x => x.id === p.id ? { ...x, isActive: !x.isActive } : x));
  };
  const remove = async (p: any) => {
    if (!confirm(`Delete the popup "${p.name}"?`)) return;
    const r = await fetch(`/api/popups/${p.id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('Could not delete.'); return; }
    toast.success('Popup deleted.'); load();
  };
  const togglePage = (k: string) => f('pages', form.pages.includes(k) ? form.pages.filter((x: string) => x !== k) : [...form.pages, k]);

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Popups</h1>
          <p className="text-gray-500 text-sm">Offers and messages that appear on the storefront. Choose when, to whom and how often.</p>
        </div>
        <button onClick={() => setForm({ ...EMPTY })} className="btn-primary py-2 px-4 text-sm"><Plus className="w-4 h-4" />New popup</button>
      </div>

      {form && (
        <div className="card p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">{form.id ? 'Edit popup' : 'New popup'}</h3>
            <button onClick={() => setForm(null)} aria-label="Close" className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
          {!form.id && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Start from:</span>
              {TEMPLATES.map(t => <button key={t.label} type="button" onClick={() => setForm({ ...EMPTY, ...t.data })} className="px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-400 bg-white text-gray-700">{t.label}</button>)}
            </div>
          )}
          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="space-y-4">
              <TranslateButton context="a popup offer in a hardware store" fields={[
                { en: form.title, ar: form.titleAr, set: v => f('titleAr', v) }, { en: form.body, ar: form.bodyAr, set: v => f('bodyAr', v) }, { en: form.ctaText, ar: form.ctaTextAr, set: v => f('ctaTextAr', v) },
              ]} />
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Headline *</label><input value={form.title} onChange={e => f('title', e.target.value)} className="input-field" placeholder="20% off your first order" /></div>
                <div><label className="label">Headline (Arabic)</label><input dir="rtl" value={form.titleAr} onChange={e => f('titleAr', e.target.value)} className="input-field" /></div>
                <div><label className="label">Message</label><textarea rows={2} value={form.body} onChange={e => f('body', e.target.value)} className="input-field" /></div>
                <div><label className="label">Message (Arabic)</label><textarea dir="rtl" rows={2} value={form.bodyAr} onChange={e => f('bodyAr', e.target.value)} className="input-field" /></div>
                <div><label className="label">Button text</label><input value={form.ctaText} onChange={e => f('ctaText', e.target.value)} className="input-field" /></div>
                <div><label className="label">Button text (Arabic)</label><input dir="rtl" value={form.ctaTextAr} onChange={e => f('ctaTextAr', e.target.value)} className="input-field" /></div>
                <div><label className="label">Button goes to</label><input value={form.ctaLink} onChange={e => f('ctaLink', e.target.value)} className="input-field" placeholder="/shop or /deals" /></div>
                <div><label className="label">Coupon code to show</label><input value={form.couponCode} onChange={e => f('couponCode', e.target.value.toUpperCase().replace(/\s/g, ''))} className="input-field font-mono" placeholder="WELCOME20" />
                  <p className="text-xs text-gray-400 mt-1">Create this code under Coupons first. The popup only displays it.</p></div>
                <div className="sm:col-span-2"><ImageUploadField label="Picture (optional)" value={form.image || ''} onChange={v => f('image', v)} folder="banners" name={form.title} maxSide={1000} /></div>
                {form.image && <div className="sm:col-span-2"><SeoFields value={form} onChange={p => setForm((x: any) => ({ ...x, ...p }))} meta={false} /></div>}
                <div className="sm:col-span-2"><AiFillButton collection="popups" doc={form} onPatch={p => setForm((x: any) => ({ ...x, ...p }))} label="Fill Arabic text with AI" /></div>
              </div>

              <div className="border-t border-gray-100 pt-4 grid sm:grid-cols-2 gap-4">
                <Select label="When to show" value={form.trigger} onChange={v => f('trigger', v)} options={[['delay', 'After some seconds'], ['scroll', 'After scrolling down'], ['exit', 'When leaving the page (desktop)']]} />
                {form.trigger === 'delay' && <div><label className="label">Seconds</label><NumberInput type="number" value={form.delaySeconds} onChange={e => f('delaySeconds', Number(e.target.value))} className="input-field" /></div>}
                {form.trigger === 'scroll' && <div><label className="label">Scrolled percent</label><NumberInput type="number" value={form.scrollPercent} onChange={e => f('scrollPercent', Number(e.target.value))} className="input-field" /></div>}
                <Select label="Who sees it" value={form.audience} onChange={v => f('audience', v)} options={[['everyone', 'Everyone'], ['guests', 'Visitors not signed in'], ['customers', 'Signed-in customers']]} />
                <Select label="How often" value={form.frequency} onChange={v => f('frequency', v)} options={[['once', 'Once per visitor'], ['session', 'Once per visit'], ['daily', 'Once a day'], ['always', 'Every page load']]} />
                <Select label="Shape" value={form.layout} onChange={v => f('layout', v)} options={[['center', 'Centre window'], ['corner', 'Small corner card'], ['bar', 'Bottom bar']]} />
                <Select label="Colour" value={form.style} onChange={v => f('style', v)} options={[['light', 'White'], ['brand', 'Brand colour'], ['accent', 'Highlight colour']]} />
                <div><label className="label">Priority</label><NumberInput type="number" value={form.priority} onChange={e => f('priority', Number(e.target.value))} className="input-field" />
                  <p className="text-xs text-gray-400 mt-1">Only one popup shows at a time. Higher number goes first.</p></div>
                <div><label className="label">Start (optional)</label><input type="datetime-local" value={toLocal(form.startsAt)} onChange={e => f('startsAt', fromLocal(e.target.value))} className="input-field" /></div>
                <div><label className="label">End (optional)</label><input type="datetime-local" value={toLocal(form.endsAt)} onChange={e => f('endsAt', fromLocal(e.target.value))} className="input-field" /></div>
              </div>
              <div>
                <p className="label">Pages</p>
                <div className="flex flex-wrap gap-2">
                  {PAGES.map(([k, l]) => <label key={k} className={`px-3 py-1.5 rounded-full border text-xs cursor-pointer ${form.pages.includes(k) ? 'bg-brand-50 border-brand-400 text-brand-800' : 'border-gray-200 text-gray-600'}`}><input type="checkbox" hidden checked={form.pages.includes(k)} onChange={() => togglePage(k)} />{l}</label>)}
                </div>
                <p className="text-xs text-gray-400 mt-1">{form.pages.length ? '' : 'None selected = every public page (never checkout, account or admin).'}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4"><div><label className="label">Internal name</label><input value={form.name} onChange={e => f('name', e.target.value)} className="input-field" placeholder="Only you see this" /></div>
                <label className="flex items-center gap-2 text-sm font-medium self-end pb-2"><input type="checkbox" checked={form.isActive} onChange={e => f('isActive', e.target.checked)} className="w-4 h-4 accent-brand-600" />Active</label></div>
            </div>
            <div>
              <p className="label">Preview</p>
              <div className="rounded-xl bg-gray-100 p-3"><PopupCard p={form} lang="en" preview /></div>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setForm(null)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">{saving ? 'Saving...' : form.id ? 'Save changes' : 'Create popup'}</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : list.length === 0 ? (
        <div className="card p-10 text-center text-gray-500"><Megaphone className="w-10 h-10 mx-auto text-gray-300" /><p className="mt-3 font-medium text-gray-700">No popups yet</p><p className="text-sm">Create one, for example a first-order discount for new visitors.</p></div>
      ) : (
        <div className="space-y-3">
          {list.map(p => (
            <div key={p.id} className={`card p-4 flex flex-wrap items-center gap-3 ${p.isActive ? '' : 'opacity-60'}`}>
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">{p.trigger === 'delay' ? `after ${p.delaySeconds}s` : p.trigger === 'scroll' ? `after ${p.scrollPercent}% scroll` : 'on exit'} · {p.audience === 'everyone' ? 'everyone' : p.audience === 'guests' ? 'not signed in' : 'signed in'} · {p.frequency} · {p.pages.length ? p.pages.join(', ') : 'all pages'}{p.couponCode ? ` · code ${p.couponCode}` : ''}</p>
              </div>
              <p className="text-xs text-gray-500 tabular-nums">{p.views || 0} views · {p.clicks || 0} clicks</p>
              <div className="flex gap-1">
                <button onClick={() => toggle(p)} aria-label={p.isActive ? 'Switch off' : 'Switch on'} className="p-2 hover:bg-gray-100 rounded-lg">{p.isActive ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}</button>
                <button onClick={() => setForm({ ...EMPTY, ...p })} aria-label="Edit" className="p-2 hover:bg-gray-100 rounded-lg"><Pencil className="w-4 h-4 text-gray-600" /></button>
                <button onClick={() => remove(p)} aria-label="Delete" className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
