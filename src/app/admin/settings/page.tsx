'use client';
import { useState } from 'react';
import { Save, Globe, Mail, Truck, CreditCard, Shield } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    siteName: 'Florida United Company', tagline: 'Hardware & Electrical Supplies — Florida',
    email: 'info@floridaunited.com', phone: '1-800-358-4273',
    address: '123 Commerce Blvd, Miami, FL 33101',
    freeShippingThreshold: 99, taxRate: 7, defaultReturnDays: 30,
    stripeMode: 'test', smtpHost: 'smtp.gmail.com', smtpPort: '587',
    whatsappNumber: '+15550000000', googleAnalyticsId: '',
    metaTitle: 'Florida United Company | Hardware & Electrical Supplies',
    metaDesc: "Florida's premier hardware and electrical supplies store.",
    metaKeywords: 'hardware store florida, electrical supplies florida, tools florida',
  });

  const update = (key: string, val: string | number) => setSettings(s=>({...s,[key]:val}));

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r=>setTimeout(r,800));
    toast.success('Settings saved!');
    setSaving(false);
  };

  const Section = ({ icon: Icon, title, children }: any) => (
    <div className="card p-6 mb-5">
      <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2 text-base"><Icon className="w-5 h-5 text-brand-600"/>{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );

  const Field = ({ label, type='text', value, onChange, placeholder='', hint='' }: any) => (
    <div>
      <label className="label">{label}</label>
      {type==='textarea' ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={2} className="input-field resize-none" placeholder={placeholder}/> : <input type={type} value={value} onChange={e=>onChange(e.target.value)} className="input-field" placeholder={placeholder}/>}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-gray-900 font-display">Site Settings</h1><p className="text-gray-500 text-sm">Manage your store configuration</p></div>
        <button onClick={handleSave} disabled={saving} className="btn-primary py-2.5 px-5 text-sm">
          {saving?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>Save All Settings</>}
        </button>
      </div>

      <div className="max-w-3xl">
        <Section icon={Globe} title="Store Information">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Store Name" value={settings.siteName} onChange={(v:string)=>update('siteName',v)}/>
            <Field label="Tagline" value={settings.tagline} onChange={(v:string)=>update('tagline',v)}/>
            <Field label="Contact Email" type="email" value={settings.email} onChange={(v:string)=>update('email',v)}/>
            <Field label="Phone" value={settings.phone} onChange={(v:string)=>update('phone',v)}/>
          </div>
          <Field label="Address" value={settings.address} onChange={(v:string)=>update('address',v)}/>
          <Field label="WhatsApp Number" value={settings.whatsappNumber} onChange={(v:string)=>update('whatsappNumber',v)} hint="Include country code, e.g. +15550000000"/>
        </Section>

        <Section icon={Truck} title="Shipping & Orders">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Free Shipping Threshold ($)</label>
              <input type="number" value={settings.freeShippingThreshold} onChange={e=>update('freeShippingThreshold',Number(e.target.value))} className="input-field"/>
            </div>
            <div>
              <label className="label">Tax Rate (%)</label>
              <input type="number" step="0.1" value={settings.taxRate} onChange={e=>update('taxRate',Number(e.target.value))} className="input-field"/>
            </div>
            <div>
              <label className="label">Default Return Days</label>
              <input type="number" value={settings.defaultReturnDays} onChange={e=>update('defaultReturnDays',Number(e.target.value))} className="input-field"/>
            </div>
          </div>
        </Section>

        <Section icon={CreditCard} title="Payment (Stripe)">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">⚠️ Payment keys are set in your <code className="bg-amber-100 px-1 rounded">.env</code> file for security. Do not enter them here.</div>
          <div>
            <label className="label">Stripe Mode</label>
            <select value={settings.stripeMode} onChange={e=>update('stripeMode',e.target.value)} className="input-field w-48">
              <option value="test">Test Mode</option>
              <option value="live">Live Mode</option>
            </select>
          </div>
        </Section>

        <Section icon={Mail} title="Email (SMTP)">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">📧 SMTP credentials are set in your <code className="bg-blue-100 px-1 rounded">.env</code> file.</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="SMTP Host" value={settings.smtpHost} onChange={(v:string)=>update('smtpHost',v)}/>
            <Field label="SMTP Port" value={settings.smtpPort} onChange={(v:string)=>update('smtpPort',v)}/>
          </div>
        </Section>

        <Section icon={Shield} title="SEO & Analytics">
          <Field label="Default Meta Title" value={settings.metaTitle} onChange={(v:string)=>update('metaTitle',v)}/>
          <Field label="Default Meta Description" type="textarea" value={settings.metaDesc} onChange={(v:string)=>update('metaDesc',v)}/>
          <Field label="Default Meta Keywords" value={settings.metaKeywords} onChange={(v:string)=>update('metaKeywords',v)}/>
          <Field label="Google Analytics ID" value={settings.googleAnalyticsId} onChange={(v:string)=>update('googleAnalyticsId',v)} placeholder="G-XXXXXXXXXX"/>
        </Section>
      </div>
    </div>
  );
}
