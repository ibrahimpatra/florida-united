'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Save, User, Lock, Bell, Eye, EyeOff } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from 'react-hot-toast';

export default function AccountSettingsPage() {
  const { data: session, update } = useSession();
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'profile'|'password'|'notifications'>('profile');

  const profileForm = useForm({ defaultValues: { name: session?.user?.name||'', phone: '', email: session?.user?.email||'' } });
  const passwordForm = useForm<{currentPassword:string;newPassword:string;confirmPassword:string}>();

  const saveProfile = async (data: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/account/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
      if (res.ok) { toast.success('Profile updated!'); await update({ name: data.name }); }
      else toast.error('Update failed');
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  const savePassword = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (data.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/account/password', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
      const result = await res.json();
      if (result.success) { toast.success('Password updated!'); passwordForm.reset(); }
      else toast.error(result.error || 'Failed');
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  if (!session) return null;

  return (
    <><Header/>
    <main className="bg-gray-50 min-h-screen">
      <div className="page-hero"><div className="container-custom"><h1 className="text-2xl font-bold text-gray-900 font-display">Account Settings</h1></div></div>
      <div className="container-custom py-8 max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-8">
          {([['profile','Profile',User],['password','Password',Lock],['notifications','Notifications',Bell]] as const).map(([key,label,Icon]) => (
            <button key={key} onClick={()=>setTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab===key?'border-brand-600 text-brand-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4"/>{label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <form onSubmit={profileForm.handleSubmit(saveProfile)} className="card p-6 space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">Profile Information</h2>
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-16 h-16 bg-brand-100 text-brand-700 rounded-2xl flex items-center justify-center text-2xl font-black">{session.user.name?.[0]||'U'}</div>
              <div><p className="font-bold text-gray-900">{session.user.name}</p><p className="text-sm text-gray-500">{session.user.email}</p><p className="text-xs text-brand-600 mt-0.5 font-medium capitalize">{session.user.role}</p></div>
            </div>
            <div><label className="label">Full Name</label><input {...profileForm.register('name',{required:true})} className="input-field"/></div>
            <div><label className="label">Email Address</label><input {...profileForm.register('email')} type="email" disabled className="input-field opacity-60 cursor-not-allowed" placeholder="Cannot change email"/></div>
            <div><label className="label">Phone Number</label><input {...profileForm.register('phone')} type="tel" className="input-field" placeholder="+1 (305) 000-0000"/></div>
            <button type="submit" disabled={saving} className="btn-primary py-2.5 px-6 text-sm">
              {saving?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Save className="w-4 h-4"/>Save Profile</>}
            </button>
          </form>
        )}

        {tab === 'password' && (
          <form onSubmit={passwordForm.handleSubmit(savePassword)} className="card p-6 space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">Change Password</h2>
            {['currentPassword','newPassword','confirmPassword'].map((field,i) => (
              <div key={field}>
                <label className="label">{['Current Password','New Password','Confirm New Password'][i]}</label>
                <div className="relative">
                  <input {...passwordForm.register(field as any,{required:true,minLength:field!=='currentPassword'?{value:8,message:'Min 8 chars'}:undefined})}
                    type={showPw?'text':'password'} className="input-field pr-10"/>
                  {i===0 && <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><Eye className="w-4 h-4"/></button>}
                </div>
              </div>
            ))}
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              🔒 Password must be at least 8 characters. Use a mix of letters, numbers, and symbols for better security.
            </div>
            <button type="submit" disabled={saving} className="btn-primary py-2.5 px-6 text-sm">
              {saving?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Lock className="w-4 h-4"/>Update Password</>}
            </button>
          </form>
        )}

        {tab === 'notifications' && (
          <div className="card p-6 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Notification Preferences</h2>
            {[
              {label:'Order confirmations', desc:'Receive email when you place an order', defaultChecked:true},
              {label:'Shipping updates', desc:'Get notified when your order ships', defaultChecked:true},
              {label:'Delivery notifications', desc:'Know when your order is delivered', defaultChecked:true},
              {label:'Return updates', desc:'Status updates on return requests', defaultChecked:true},
              {label:'Promotions & deals', desc:'Exclusive offers and discounts', defaultChecked:false},
              {label:'New arrivals', desc:'Be first to know about new products', defaultChecked:false},
              {label:'Newsletter', desc:'Monthly product updates and tips', defaultChecked:false},
            ].map(({label,desc,defaultChecked}) => (
              <label key={label} className="flex items-start gap-4 cursor-pointer group py-2 border-b border-gray-50 last:border-0">
                <input type="checkbox" defaultChecked={defaultChecked} className="w-4 h-4 accent-brand-600 mt-0.5 rounded"/>
                <div><p className="text-sm font-semibold text-gray-800 group-hover:text-brand-700">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
              </label>
            ))}
            <button className="btn-primary py-2.5 px-6 text-sm mt-2" onClick={()=>toast.success('Preferences saved!')}>
              <Save className="w-4 h-4"/>Save Preferences
            </button>
          </div>
        )}
      </div>
    </main>
    <Footer/></>
  );
}
