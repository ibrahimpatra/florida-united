export function BrandsSection() {
  const brands = ['Siemens','Eaton','Leviton','Hubbell','Panduit','Milwaukee','DeWalt','Klein Tools','Fluke','3M','Honeywell','ABB'];
  return (
    <section className="py-10 bg-gray-50 border-y border-gray-100">
      <div className="container-custom">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">Trusted Brands We Carry</p>
        <div className="flex flex-wrap justify-center gap-3">
          {brands.map(b=>(
            <span key={b} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-default shadow-sm">
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
