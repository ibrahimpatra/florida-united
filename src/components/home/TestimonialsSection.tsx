import { Star } from 'lucide-react';
const reviews = [
  { name:'Khalid M.', role:'Electrical Contractor', text:'Florida Kuwait has been my go-to for 6 years. Best prices on circuit breakers and conduit in Kuwait. Fast delivery every time.', rating:5, avatar:'KM' },
  { name:'Sara K.', role:'Homeowner', text:'Ordered online, arrived next day! The quality of the electrical outlets and switches exceeded my expectations. Will definitely order again.', rating:5, avatar:'SK' },
  { name:'Mohammed T.', role:'HVAC Technician', text:'Great selection of industrial supplies. Their support team helped me find the exact motor I needed for a tricky job. 10/10 recommend.', rating:5, avatar:'MT' },
  { name:'Dana R.', role:'Construction Manager', text:'Bulk orders handled perfectly. They even called to confirm specs before shipping. That level of service is rare online.', rating:5, avatar:'DR' },
];
export function TestimonialsSection() {
  return (
    <section className="section">
      <div className="container-custom">
        <div className="text-center mb-10">
          <h2 className="section-title">What Our Customers Say</h2>
          <p className="section-subtitle">Trusted by 50,000+ contractors and homeowners across Kuwait</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            {[1,2,3,4,5].map(s=><Star key={s} className="w-5 h-5 text-yellow-400 fill-yellow-400"/>)}
            <span className="font-bold text-gray-800">4.9</span>
            <span className="text-gray-500 text-sm">from 2,400+ reviews</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {reviews.map((r)=>(
            <div key={r.name} className="card p-5 hover:shadow-hover hover:-translate-y-1 transition-all duration-300">
              <div className="flex mb-3">{[1,2,3,4,5].map(s=><Star key={s} className="w-4 h-4 text-yellow-400 fill-yellow-400"/>)}</div>
              <p className="text-sm text-gray-700 leading-relaxed mb-4 line-clamp-3">"{r.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{r.avatar}</div>
                <div><p className="text-sm font-semibold text-gray-800">{r.name}</p><p className="text-xs text-gray-500">{r.role}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
