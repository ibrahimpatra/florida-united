import { Truck, Shield, RotateCcw, Headphones, Star, Zap } from 'lucide-react';

const badges = [
  { icon: Truck, title: 'Free Shipping', desc: 'Orders over $99', color: 'text-blue-600 bg-blue-50' },
  { icon: Shield, title: 'Secure Checkout', desc: 'SSL encrypted', color: 'text-green-600 bg-green-50' },
  { icon: RotateCcw, title: '30-Day Returns', desc: 'No questions asked', color: 'text-orange-600 bg-orange-50' },
  { icon: Headphones, title: '24/7 Support', desc: 'Expert help always', color: 'text-purple-600 bg-purple-50' },
  { icon: Star, title: 'Top Rated', desc: '4.9/5 from 2,400+', color: 'text-yellow-600 bg-yellow-50' },
  { icon: Zap, title: 'Same-Day Ship', desc: 'Orders before 2PM', color: 'text-red-600 bg-red-50' },
];

export function TrustBadges() {
  return (
    <div className="bg-white border-b border-gray-100">
      <div className="container-custom py-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {badges.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="flex items-center gap-3 py-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 leading-tight">{title}</p>
                <p className="text-xs text-gray-500 leading-tight">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
