'use client';
import { useState } from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async(e:React.FormEvent) => {
    e.preventDefault();
    if(!email) return;
    setLoading(true);
    await new Promise(r=>setTimeout(r,800));
    toast.success('You\'re subscribed! Check your inbox for a 10% off coupon 🎉');
    setEmail('');
    setLoading(false);
  };
  return (
    <section className="py-16 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 1px 1px,white 1px,transparent 0)',backgroundSize:'40px 40px'}}/>
      <div className="relative container-custom text-center">
        <div className="max-w-xl mx-auto">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5"><Mail className="w-7 h-7 text-white"/></div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 font-display">Get 10% Off Your First Order</h2>
          <p className="text-blue-200 mb-8">Subscribe for deals, new arrivals & expert tips. No spam ever.</p>
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email address" required
              className="flex-1 px-4 py-3 rounded-xl bg-white/15 backdrop-blur-sm border border-white/30 text-white placeholder-blue-200 outline-none focus:bg-white/25 text-sm"/>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-3 bg-white text-brand-700 font-bold rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-70 text-sm whitespace-nowrap">
              {loading ? <div className="w-4 h-4 border-2 border-brand-700 border-t-transparent rounded-full animate-spin"/> : <><span>Subscribe</span><ArrowRight className="w-4 h-4"/></>}
            </button>
          </form>
          <p className="text-blue-300 text-xs mt-3">No spam. Unsubscribe anytime. 🔒</p>
        </div>
      </div>
    </section>
  );
}
