'use client';
import { useState } from 'react';
import { Phone, Mail, MapPin, Clock, MessageCircle, Send } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { toast } from 'react-hot-toast';

export default function ContactPage() {
  const [form, setForm] = useState({ name:'', email:'', subject:'', message:'' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch('/api/contact', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      if (res.ok) { toast.success('Message sent! We\'ll reply within 24 hours. 📧'); setForm({ name:'', email:'', subject:'', message:'' }); }
      else toast.error('Failed to send');
    } catch { toast.error('Error sending message'); }
    setSending(false);
  };

  return (
    <><AnnouncementBar/><Header/>
    <main>
      <div className="page-hero">
        <div className="container-custom text-center">
          <h1 className="text-3xl font-bold text-gray-900 font-display mb-2">Get In Touch</h1>
          <p className="text-gray-500">Our expert team is ready to help with your hardware & electrical needs</p>
        </div>
      </div>
      <div className="container-custom py-12">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-5 font-display">Contact Information</h2>
              {[
                { icon:Phone, title:'Phone', lines:['1-800-FLU-HARD (358-4273)','Mon-Fri 8AM–6PM, Sat 9AM–4PM'], href:'tel:+18003584273' },
                { icon:Mail, title:'Email', lines:['info@floridaunited.com','orders@floridaunited.com'], href:'mailto:info@floridaunited.com' },
                { icon:MapPin, title:'Address', lines:['123 Commerce Blvd','Miami, Florida 33101'], href:'https://maps.google.com' },
                { icon:Clock, title:'Hours', lines:['Mon–Fri: 8:00 AM – 6:00 PM','Saturday: 9:00 AM – 4:00 PM','Sunday: Closed'], href:null },
              ].map(({icon:Icon,title,lines,href})=>(
                <div key={title} className="flex gap-4 mb-5">
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-brand-600"/></div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm mb-1">{title}</p>
                    {lines.map((l,i)=> href && i===0 ? <a key={i} href={href} className="block text-sm text-brand-600 hover:underline">{l}</a> : <p key={i} className="text-sm text-gray-600">{l}</p>)}
                  </div>
                </div>
              ))}
            </div>
            {/* WhatsApp CTA */}
            <a href="https://wa.me/18003584273" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl hover:bg-green-100 transition-colors group">
              <div className="w-11 h-11 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-600 transition-colors"><MessageCircle className="w-6 h-6 text-white"/></div>
              <div><p className="font-bold text-green-800">Chat on WhatsApp</p><p className="text-sm text-green-600">Quick answers from our team</p></div>
            </a>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <div className="card p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 font-display">Send Us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="label">Full Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required className="input-field" placeholder="John Smith"/></div>
                  <div><label className="label">Email Address</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required className="input-field" placeholder="you@example.com"/></div>
                </div>
                <div>
                  <label className="label">Subject</label>
                  <select value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} required className="input-field">
                    <option value="">Select a subject</option>
                    {['Order Inquiry','Product Question','Technical Support','Bulk/Wholesale Pricing','Return Request','Shipping Question','General Inquiry','Partnership','Other'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Message</label>
                  <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} required rows={5} className="input-field resize-none" placeholder="How can we help you today?..."/>
                </div>
                <button type="submit" disabled={sending} className="btn-primary py-3 px-8">
                  {sending?<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Send className="w-4 h-4"/>Send Message</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
    <Footer/></>
  );
}
