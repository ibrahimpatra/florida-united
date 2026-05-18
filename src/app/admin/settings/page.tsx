'use client';
import { useState, useEffect } from 'react';
import { Save, Globe, Mail, Truck, CreditCard, Shield, Info, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SITE_CONFIG } from '@/lib/siteConfig';

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
  defaultReturnDays:     SITE_CONFIG.defaultReturnDays,
  metaTitle:             SITE_CONFIG.metaTitle,
  metaDesc:              SITE_CONFIG.metaDesc,
  googleAnalyticsId:     '',
  paymentMode:           'test',
};

type Settings = typeof DEFAULT_SETTINGS;

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => { if (!d.error) setSettings({ ...DEFAULT_SETTINGS, ...d }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      const data = await res.json();
      if (data.success) {
        toast.success('✅ Settings saved — changes are live across the site!');
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error — settings not saved');
    }
    setSaving(false);
  };

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
      <input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="input-field" />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-gray-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Loading settings…
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
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
        <Section icon={Globe} title="Contact Information">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Store Name" value={settings.storeName} onChange={v => update('storeName', v)} hint="Shown in header, footer, emails" />
            <Field label="Tagline" value={settings.tagline} onChange={v => update('tagline', v)} />
          </div>
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
            🚚 Cart totals at or above the threshold get free shipping. You can also mark individual products as
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
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            ⚠️ TAP and Stripe API keys are set in your <code className="bg-amber-100 px-1 rounded">.env</code> file for security.
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
