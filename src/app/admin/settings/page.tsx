'use client';
import { NumberInput } from '@/components/ui/NumberInput';
import { useState, useEffect } from 'react';
import { Save, Globe, Mail, Truck, CreditCard, Shield, Info, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SITE_CONFIG } from '@/lib/siteConfig';
import { BrandThemeSection } from '@/components/admin/BrandThemeSection';

const DEFAULT_SETTINGS = {
  storeName:             SITE_CONFIG.fullName,
  tagline:               SITE_CONFIG.tagline,
  phone:                 SITE_CONFIG.phone,
  email:                 SITE_CONFIG.email,
  emailOrders:           SITE_CONFIG.emailOrders,
  address:               SITE_CONFIG.addressFull,
  whatsapp:              SITE_CONFIG.whatsapp,
  hoursWeekdays:         SITE_CONFIG.hoursWeekdays,
  hoursSaturday:         SITE_CONFIG.hoursSaturday,
  freeShippingThreshold: SITE_CONFIG.freeShippingThreshold,
  defaultShippingCost:   SITE_CONFIG.defaultShippingCost,
  taxRate:               SITE_CONFIG.taxRate,
  usdRate:               3.25,
  defaultReturnDays:     SITE_CONFIG.defaultReturnDays,
  metaTitle:             SITE_CONFIG.metaTitle,
  metaDesc:              SITE_CONFIG.metaDesc,
  googleAnalyticsId:     '',
  paymentMode:           'test',
  storeNameAr:           SITE_CONFIG.fullNameAr,
  taglineAr:             SITE_CONFIG.taglineAr,
  logoUrl:               '',
  faviconUrl:            '',
  brandColor:            '#234b63',
  accentColor:           '#f5b800',
  onlineProvider:        'auto',
};

type Settings = { [K in keyof typeof DEFAULT_SETTINGS]: (typeof DEFAULT_SETTINGS)[K] extends string ? string : (typeof DEFAULT_SETTINGS)[K] extends number ? number : (typeof DEFAULT_SETTINGS)[K] };

/* Defined at module level on purpose: components declared inside the page are re-created on every keystroke,
   which remounts the inputs and makes them lose focus. */
const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="card p-6 mb-5">
    <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2 text-base">
      <Icon className="w-5 h-5 text-brand-600" />{title}
    </h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const Field = ({ label, type = 'text', value, onChange, placeholder = '', hint = '' }: {
  label: string; type?: string; value: string | number;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
}) => (
  <div>
    <label className="label">{label}</label>
    {type === 'textarea'
      ? <textarea value={value as string} onChange={e => onChange(e.target.value)} rows={2} className="input-field resize-none" placeholder={placeholder} />
      : <input type={type} value={value} onChange={e => onChange(e.target.value)} className="input-field" placeholder={placeholder} />
    }
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const NumField = ({ label, value, onChange, step = 1, hint = '' }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string;
}) => (
  <div>
    <label className="label">{label}</label>
    <NumberInput type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="input-field" />
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [providers, setProviders] = useState<{ id: string; name: string; currency: string; configured: boolean }[]>([]);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => { if (!d.error) setSettings({ ...DEFAULT_SETTINGS, ...d }); else toast.error(d.error); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch('/api/admin/payment-status').then(r => r.json()).then(d => setProviders(d.providers || [])).catch(() => {}); }, []);

  const update = (key: keyof Settings, val: string | number) =>
    setSettings(s => ({ ...s, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('Settings saved. Name, logo and colours appear on the storefront within a minute.');
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error — settings not saved');
    }
    setSaving(false);
  };




  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-gray-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Loading settings…
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Store Settings</h1>
          <p className="text-gray-500 text-sm">All changes save to Firestore and apply site-wide instantly — no code edits needed.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary py-2.5 px-5 text-sm">
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />Save All</>}
        </button>
      </div>

      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-6 flex gap-3">
        <Info className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-brand-700">
          <strong>Single source of truth.</strong> Phone, address, email, and free shipping threshold set here
          update everywhere — header, footer, contact page, cart, and all outgoing order emails — with one save.
        </p>
      </div>

      <div className="max-w-3xl">
        <BrandThemeSection values={settings} onChange={patch => setSettings(s => ({ ...s, ...patch }))} />

        <Section icon={Globe} title="Contact Information">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Phone (display)" value={settings.phone} onChange={v => update('phone', v)} placeholder="+965 XXXX XXXX" hint="Header, footer, contact page" />
            <Field label="WhatsApp Number" value={settings.whatsapp} onChange={v => update('whatsapp', v)} placeholder="96522225050" hint="Digits only, no + or spaces" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Main Email" type="email" value={settings.email} onChange={v => update('email', v)} hint="Footer and contact page" />
            <Field label="Orders Email" type="email" value={settings.emailOrders} onChange={v => update('emailOrders', v)} hint="'From' address in order confirmation emails" />
          </div>
          <Field label="Full Address" value={settings.address} onChange={v => update('address', v)} placeholder="Block 12, Street 5, Salmiya, Kuwait" hint="Footer, contact page, email footer" />
        </Section>

        <Section icon={Globe} title="Business Hours">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Weekdays" value={settings.hoursWeekdays} onChange={v => update('hoursWeekdays', v)} placeholder="Sun–Thu: 9:00 AM – 6:00 PM" />
            <Field label="Saturday" value={settings.hoursSaturday} onChange={v => update('hoursSaturday', v)} placeholder="Saturday: 10:00 AM – 4:00 PM" />
          </div>
        </Section>

        <Section icon={Truck} title="Shipping & Orders">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 mb-2">
            Cart totals at or above the threshold get free shipping. You can also mark individual products as
            <strong> "Always Free Shipping"</strong> in the product form — they ship free regardless of cart total.
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <NumField label="Free Shipping Threshold (KWD)" value={settings.freeShippingThreshold} onChange={v => update('freeShippingThreshold', v)} step={0.5} hint="Set to 0 = always free" />
            <NumField label="Default Shipping Cost (KWD)" value={settings.defaultShippingCost} onChange={v => update('defaultShippingCost', v)} step={0.25} hint="Charged below threshold" />
            <NumField label="Default Return Days" value={settings.defaultReturnDays} onChange={v => update('defaultReturnDays', v)} hint="Override per-product in product form" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <NumField label="Tax Rate (%)" value={settings.taxRate} onChange={v => update('taxRate', v)} step={0.1} hint="Kuwait has 0% VAT — change only if regulations require" />
          </div>
        </Section>

        <Section icon={CreditCard} title="Payment">
          <div>
            <label className="label">Online card payment</label>
            <select value={settings.onlineProvider} onChange={e => update('onlineProvider', e.target.value)} className="input-field sm:w-72">
              <option value="auto">Automatic (first provider that has keys)</option>
              <option value="stripe">Stripe</option>
              <option value="tap">Tap Payments</option>
              <option value="myfatoorah">MyFatoorah</option>
              <option value="none">Off (cash on delivery only)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Customers only see the card option when the chosen provider has keys on the server.</p>
          </div>
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
            {providers.length === 0 && <p className="p-3 text-gray-400">Checking providers…</p>}
            {providers.map(p => (
              <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                <span className="font-medium text-gray-800">{p.name} <span className="text-xs text-gray-400">({p.currency})</span></span>
                <span className={`text-xs font-semibold ${p.configured ? 'text-green-700' : 'text-gray-400'}`}>{p.configured ? 'Keys found' : 'No keys'}</span>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 space-y-1">
            <p>Keys are never stored here. Add them as environment variables on the host, then redeploy:</p>
            <p><code>STRIPE_SECRET_KEY</code> + <code>STRIPE_WEBHOOK_SECRET</code> · <code>TAP_SECRET_KEY</code> · <code>MYFATOORAH_API_KEY</code> (optional <code>MYFATOORAH_BASE_URL</code> for the test server)</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <NumField label="USD per 1 KWD" value={settings.usdRate} onChange={v => update('usdRate', v)} step={0.001} hint="Used by Stripe only (it charges in USD). Tap and MyFatoorah charge in KWD." />
          </div>
          <div>
            <label className="label">Payment Mode (reminder label)</label>
            <select value={settings.paymentMode} onChange={e => update('paymentMode', e.target.value)} className="input-field w-48">
              <option value="test">Test Mode</option>
              <option value="live">Live Mode</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Actual mode is controlled by which key you put in .env</p>
          </div>
        </Section>

        <Section icon={Shield} title="SEO & Analytics">
          <Field label="Default Meta Title" value={settings.metaTitle} onChange={v => update('metaTitle', v)} />
          <Field label="Default Meta Description" type="textarea" value={settings.metaDesc} onChange={v => update('metaDesc', v)} />
          <Field label="Google Analytics ID" value={settings.googleAnalyticsId} onChange={v => update('googleAnalyticsId', v)} placeholder="G-XXXXXXXXXX" />
        </Section>
      </div>
    </div>
  );
}
